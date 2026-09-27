"use client";

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Wallet, CheckCircle, XCircle, Copy, ChevronRight, QrCode } from "lucide-react";
import { logger } from "@/app/utils/logger";
import { Horizon } from "stellar-sdk";
import { useTranslations } from "next-intl";
import { useWrapStore } from "../../store/wrapStore";
import { useTransactionStore } from "../../store/transactionStore";
import { useMultiTimeframeStore } from "../../store/multiTimeframeStore";
import { useWalletStore } from "../../store/walletStore";
import { useSound } from "../../hooks/useSound";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useStellarAddressValidation } from "../../../src/hooks/useStellarAddressValidation";
import { ProgressIndicator } from "../../components/ProgressIndicator";
import { MuteToggle } from "../../components/MuteToggle";
import { ConnectWalletButton } from "../../components/ConnectWalletButton";
import {
  connectFreighter,
  getFreighterNetwork,
  connectAlbedo,
  connectXBull,
  isXBullInstalled,
  NetworkMismatchError,
} from "../../utils/walletConnect";
import { connectWalletConnect } from "../../utils/walletConnectManager";
import { getHorizonServer } from "../../utils/stellarClient";
import { SOUND_NAMES } from "../../utils/soundManager";
import { useRouter } from "next/navigation";
import {
  DEMO_STELLAR_ADDRESS,
  markDemoMode,
  clearDemoMode,
} from "@/app/data/demoAccount";

const log = logger.child("connect");

export default function ConnectPage() {
  const router = useRouter();
  const t = useTranslations("ConnectPage");
  const { setAddress, setError, setStatus, network, reset } = useWrapStore();
  const { resetTransaction } = useTransactionStore();
  const { reset: resetMultiTimeframe } = useMultiTimeframeStore();
  const {
    connect: connectWalletSession,
    address: connectedAddress,
    provider: connectedProvider,
    isConnected,
  } = useWalletStore();
  const { playSound } = useSound();
  const isOnline = useOnlineStatus();

  const {
    address: walletAddress,
    validationState,
    errorMessage,
    handleAddressChange: handleRawAddressChange,
    isValid,
  } = useStellarAddressValidation({ network });

  const [isConnecting, setIsConnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  /**
   * When set, the user's Freighter wallet is on a different network than the
   * app expects. The object holds both sides so the UI can show an actionable
   * switch-network prompt.
   */
  const [networkMismatch, setNetworkMismatch] = useState<{
    expected: string;
    actual: string;
  } | null>(null);

  // Last-used address (remembered across sessions so returning users can
  // reconnect in one tap instead of re-typing their address).
  const [lastUsedAddress, setLastUsedAddress] = useState<string | null>(null);

  // Account preview shown after a manual address is entered and validated,
  // before the user commits to continuing into the wrap flow.
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewBalance, setPreviewBalance] = useState<string>("0");
  const [previewTxCount, setPreviewTxCount] = useState<number>(0);

  // Refs for focus management
  const mainContentRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const freighterButtonRef = useRef<HTMLButtonElement>(null);
  const demoButtonRef = useRef<HTMLButtonElement>(null);

  // Load last-used address from localStorage on mount
  useEffect(() => {
    // Returning to /connect always leaves demo mode; handleDemoMode re-arms it.
    clearDemoMode();

    const saved = localStorage.getItem("lastUsedStellarAddress");
    if (saved) {
      setLastUsedAddress(saved);
    }
    // Focus the main content area on mount
    if (mainContentRef.current) {
      mainContentRef.current.focus();
    }
  }, []);

  // Freighter does not provide a reliable cross-browser network-change event.
  // Poll its read-only network details while connected so a switch in the
  // extension is surfaced persistently and cannot be bypassed at Continue.
  useEffect(() => {
    if (!isConnected || connectedProvider !== "freighter" || !connectedAddress) {
      return;
    }

    let active = true;
    const checkNetwork = async () => {
      const actual = await getFreighterNetwork();
      if (!active || actual === null) return;

      if (actual !== network) {
        setNetworkMismatch({ expected: network, actual });
      } else {
        setNetworkMismatch(null);
      }
    };

    void checkNetwork();
    const interval = window.setInterval(checkNetwork, 3_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [connectedAddress, connectedProvider, isConnected, network]);

  /**
   * Persist the most recently used wallet address to localStorage so it can
   * be offered as a one-tap reconnect option on a future visit.
   */
  const saveAddressToLocalStorage = (address: string) => {
    try {
      localStorage.setItem("lastUsedStellarAddress", address);
      setLastUsedAddress(address);
    } catch {
      // localStorage can throw in private-browsing / storage-full states;
      // failing to remember the address is non-fatal, so we swallow it.
    }
  };

  /**
   * Clear the remembered last-used address (e.g. when the user explicitly
   * chooses "Use a different wallet").
   */
  const clearSavedAddress = () => {
    try {
      localStorage.removeItem("lastUsedStellarAddress");
    } catch {
      // non-fatal
    }
    setLastUsedAddress(null);
    useWalletStore.getState().disconnect();
  };

  /**
   * Fetch a lightweight account preview (native XLM balance and a recent
   * transaction count) for the given address, to show the user what they're
   * about to wrap before they commit to continuing.
   *
   * Transaction count is derived from a single bounded page (most recent
   * 200 transactions) rather than the true lifetime total, since Horizon
   * does not expose a cheap total-count endpoint. This is an approximation
   * ("recent activity"), not the account's full history size.
   */
  const fetchAccountPreview = async (address: string) => {
    setShowPreview(true);
    setPreviewLoading(true);
    try {
      const server = getHorizonServer(network === "testnet" ? "testnet" : "mainnet");
      const account = await server.loadAccount(address);
      const nativeBalance = account.balances.find(
        (b): b is Horizon.HorizonApi.BalanceLineNative => b.asset_type === "native",
      );
      setPreviewBalance(nativeBalance ? nativeBalance.balance : "0");

      const txPage = await server
        .transactions()
        .forAccount(address)
        .limit(200)
        .call();
      setPreviewTxCount(txPage.records.length);
    } catch (error) {
      log.error("Failed to fetch account preview:", error);
      setPreviewBalance("0");
      setPreviewTxCount(0);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFreighterConnect = async () => {
    if (!isOnline) {
      setLocalError(t("errors.offlineConnect"));
      return;
    }

    setIsConnecting(true);
    setLocalError(null);
    setNetworkMismatch(null);
    setStatus("loading");
    // Reset all stores before connecting
    reset();
    resetTransaction();
    resetMultiTimeframe();

    try {
      const publicKey = await connectFreighter(network);
      setAddress(publicKey);
      connectWalletSession(publicKey, "freighter", network);
      saveAddressToLocalStorage(publicKey);
      setError(null);
      playSound(SOUND_NAMES.SLIDE_WHOOSH);
      await fetchAccountPreview(publicKey);
    } catch (error: unknown) {
      if (error instanceof NetworkMismatchError) {
        // Surface a targeted switch-network prompt instead of a generic error
        setNetworkMismatch({ expected: error.expected, actual: error.actual });
        setStatus("idle");
      } else {
        const msg =
          error instanceof Error ? error.message : t("errors.walletConnectFailed");
        setError(msg);
        setLocalError(msg);
        setStatus("error");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAlbedoConnect = async () => {
    if (!isOnline) {
      setLocalError(t("errors.offlineConnect"));
      return;
    }

    setIsConnecting(true);
    setLocalError(null);
    setStatus("loading");
    // Reset all stores before connecting
    reset();
    resetTransaction();
    resetMultiTimeframe();

    try {
      const publicKey = await connectAlbedo(network);
      setAddress(publicKey);
      connectWalletSession(publicKey, "albedo", network);
      saveAddressToLocalStorage(publicKey);
      setError(null);
      playSound(SOUND_NAMES.SLIDE_WHOOSH);
      await fetchAccountPreview(publicKey);
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : t("errors.walletConnectFailed");
      setError(errMsg);
      setLocalError(errMsg);
      setStatus("error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleXBullConnect = async () => {
    if (!isOnline) {
      setLocalError(t("errors.offlineConnect"));
      return;
    }

    if (!isXBullInstalled()) {
      setLocalError(t("errors.xbullNotFoundShort"));
      window.open(
        "https://chromewebstore.google.com/detail/xbull-wallet/klpfklhikflhefnndkhiokkdbndlfhno",
        "_blank"
      );
      return;
    }

    setIsConnecting(true);
    setLocalError(null);
    setStatus("loading");
    // Reset all stores before connecting
    reset();
    resetTransaction();
    resetMultiTimeframe();

    try {
      const publicKey = await connectXBull(network);
      setAddress(publicKey);
      connectWalletSession(publicKey, "xbull", network);
      setError(null);
      playSound(SOUND_NAMES.SLIDE_WHOOSH);
      router.push("/loading");
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : t("errors.walletConnectFailed");
      setError(errMsg);
      setLocalError(errMsg);
      setStatus("error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleWalletConnectConnect = async () => {
    if (!isOnline) {
      setLocalError(t("errors.offlineConnect"));
      return;
    }

    setIsConnecting(true);
    setLocalError(null);
    setStatus("loading");
    // Reset all stores before connecting
    reset();
    resetTransaction();
    resetMultiTimeframe();

    try {
      const publicKey = await connectWalletConnect(network);
      setAddress(publicKey);
      connectWalletSession(publicKey, "walletconnect", network);
      setError(null);
      playSound(SOUND_NAMES.SLIDE_WHOOSH);
      router.push("/loading");
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : t("errors.walletConnectFailed");
      setError(errMsg);
      setLocalError(errMsg);
      setStatus("error");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();

    if (!isOnline) {
      setLocalError(t("errors.offlineIndexing"));
      return;
    }

    if (!walletAddress.trim()) {
      setLocalError(t("errors.emptyAddress"));
      return;
    }

    // Validate Stellar address format
    if (validationState === 'validating') {
      setLocalError(t("errors.validatingWait"));
      return;
    }

    if (!isValid) {
      setLocalError(t("errors.invalidAddress"));
      setError(t("errors.invalidAddressShort"));
      return;
    }

    // Reset all stores before connecting
    reset();
    resetTransaction();
    resetMultiTimeframe();

    const trimmedAddress = walletAddress.trim();
    setAddress(trimmedAddress);
    setStatus("loading");
    setError(null);
    connectWalletSession(trimmedAddress, "manual", network);
    saveAddressToLocalStorage(trimmedAddress);
    playSound(SOUND_NAMES.SLIDE_WHOOSH);
    fetchAccountPreview(walletAddress.trim());
  };

  const handleContinue = () => {
    if (networkMismatch) return;
    router.push("/loading");
  };

  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleRawAddressChange(e.target.value);
    setLocalError(null);
    setError(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleRawAddressChange(text);
      setLocalError(null);
      setError(null);
      // Keep focus on input after paste
      if (addressInputRef.current) {
        addressInputRef.current.focus();
      }
    } catch {
      const pasteError = t("errors.clipboardFailed");
      setLocalError(pasteError);
      setError(pasteError);
      addressInputRef.current?.focus();
    }
  };

  const handleConnect = () => {
    handleManualSubmit();
  };

  const handleDemoMode = () => {
    if (!isOnline) {
      setLocalError(t("errors.demoOffline"));
      return;
    }

    // Demo mode is mock-only; the flag makes the loading screen skip Horizon.
    markDemoMode();
    handleRawAddressChange(DEMO_STELLAR_ADDRESS);
    setTimeout(() => {
      setAddress(DEMO_STELLAR_ADDRESS);
      setStatus("loading");
      connectWalletSession(DEMO_STELLAR_ADDRESS, "demo", network);
      playSound(SOUND_NAMES.SLIDE_WHOOSH);
      router.push("/loading");
    }, 100);
  };

  const onBack = () => {
    router.push("/");
  };

  // Keyboard event handlers
  const handleBackKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onBack();
    }
  };

  const handleConnectKeyDown = (e: KeyboardEvent) => {
    if (
      (e.key === "Enter" || e.key === " ") &&
      !isConnecting &&
      walletAddress.trim() &&
      isValid
    ) {
      e.preventDefault();
      handleConnect();
    }
  };

  const handleFreighterKeyDown = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !isConnecting) {
      e.preventDefault();
      handleFreighterConnect();
    }
  };

  const handleAlbedoKeyDown = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !isConnecting) {
      e.preventDefault();
      handleAlbedoConnect();
    }
  };

  const handleXBullKeyDown = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !isConnecting) {
      e.preventDefault();
      handleXBullConnect();
    }
  };

  const handleWalletConnectKeyDown = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !isConnecting) {
      e.preventDefault();
      handleWalletConnectConnect();
    }
  };

  const handleDemoKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDemoMode();
    }
  };

  const handlePasteKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePaste();
    }
  };

  const handleAddressKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && walletAddress.trim() && isValid) {
      e.preventDefault();
      handleManualSubmit();
    }
  };

  // Keyboard navigation for the entire page
  const handlePageKeyDown = (e: KeyboardEvent) => {
    // Handle Escape key to go back, except when inside the input where it should just blur
    if (e.key === "Escape") {
      if (document.activeElement === addressInputRef.current) {
        addressInputRef.current?.blur();
        return;
      }
      e.preventDefault();
      onBack();
    }
    // Tab behavior is left un-intercepted intentionally.
    // This allows the focus to escape into the browser chrome (e.g. URL bar),
    // which is required for full-page accessibility compliance.
  };

  const errorId = localError ? "address-error" : undefined;

  return (
    <main
      ref={mainContentRef}
      tabIndex={-1}
      onKeyDown={handlePageKeyDown}
      className="relative w-full min-h-screen h-screen overflow-hidden flex items-center justify-center bg-theme-background focus:outline-none" style={{ touchAction: "pan-y" }}
    >
      {/* Progress Indicator */}
      <ProgressIndicator currentStep={2} totalSteps={6} showNext={false} />

      {/* Background elements */}
      <div className="absolute inset-0 bg-linear-to-br from-black via-black to-black opacity-60" />

      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-20">
        <motion.div
          className="w-full h-full"
          style={{
            backgroundImage: `linear-gradient(rgba(var(--color-theme-primary-rgb), 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(var(--color-theme-primary-rgb), 0.3) 1px, transparent 1px)`,
            backgroundSize: "100px 100px",
          }}
          animate={{
            backgroundPosition: ["0px 0px", "100px 100px"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* Glowing orbs */}
      <motion.div
        className="absolute w-96 h-96 rounded-full blur-[120px]"
        style={{ backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.3)" }}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [-50, 50, -50],
          y: [-50, 50, -50],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <nav aria-label="Primary">
        {/* Back button */}
        <motion.button
          ref={backButtonRef}
          onClick={onBack}
          onKeyDown={handleBackKeyDown}
          className="absolute top-6 left-6 md:top-8 md:left-8 z-20 group focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black focus:rounded-xl"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          tabIndex={0}
          aria-label={t("backAria")}
          role="button"
        >
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          >
            <ArrowLeft
              className="w-5 h-5 text-white group-hover:text-white/80 transition-colors"
              aria-hidden="true"
            />
            <span className="text-sm font-black text-white/80 group-hover:text-white transition-colors hidden sm:inline">
              {t("back")}
            </span>
          </div>
        </motion.button>

        <motion.div
          className="absolute top-6 right-6 md:top-8 md:right-8 z-20"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <MuteToggle />
        </motion.div>
      </nav>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl w-full mx-auto px-4 sm:px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8 md:mb-12"
        >
          <motion.div
            className="inline-block mb-6"
            animate={{
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 blur-2xl rounded-full"
                style={{
                  backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.4)",
                }}
                animate={{
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />
              <div
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center border-2"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  borderColor: "rgba(var(--color-theme-primary-rgb), 0.5)",
                }}
              >
                <Wallet
                  className="w-10 h-10 sm:w-12 sm:h-12"
                  style={{ color: "var(--color-theme-primary)" }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </motion.div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-3 md:mb-4 tracking-tight leading-none"
            style={{
              background: `linear-gradient(180deg, #ffffff 0%, var(--color-theme-primary) 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {t("title")}
          </h1>
          <p className="text-base sm:text-lg md:text-xl font-bold text-white/70 leading-relaxed">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Last-used address shortcut */}
        {lastUsedAddress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-6 max-w-2xl mx-auto"
          >
            <motion.button
              onClick={() => {
                reset();
                resetTransaction();
                resetMultiTimeframe();
                setAddress(lastUsedAddress);
                connectWalletSession(lastUsedAddress, "manual", network);
                playSound(SOUND_NAMES.SLIDE_WHOOSH);
                router.push("/loading");
              }}
              className="w-full px-6 py-4 bg-gradient-to-r from-white/10 to-white/5 border-2 rounded-xl font-bold text-white hover:from-white/20 hover:to-white/10 transition-all flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
              style={{
                borderColor: "rgba(var(--color-theme-primary-rgb), 0.5)",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              tabIndex={0}
              aria-label={t("continueAs", { shortAddress: `${lastUsedAddress.slice(0, 4)}...${lastUsedAddress.slice(-4)}` })}
              role="button"
            >
              <CheckCircle
                className="w-5 h-5"
                style={{ color: "var(--color-theme-primary)" }}
                aria-hidden="true"
              />
              <span className="text-sm sm:text-base">
                {t("continueAs", { shortAddress: `${lastUsedAddress.slice(0, 4)}...${lastUsedAddress.slice(-4)}` })}
              </span>
            </motion.button>
            <button
              onClick={clearSavedAddress}
              className="w-full mt-2 text-xs sm:text-sm text-white/50 hover:text-white/70 transition-colors font-medium"
              tabIndex={0}
              aria-label={t("useDifferentWallet")}
            >
              {t("useDifferentWallet")}
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative"
        >
          <motion.div
            className="absolute -inset-1 rounded-2xl blur-xl"
            style={{
              backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.3)",
            }}
            animate={{
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />

          <div
            className="relative backdrop-blur-xl p-6 sm:p-8 rounded-2xl border"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              borderColor: "rgba(var(--color-theme-primary-rgb), 0.3)",
            }}
          >
            <label
              htmlFor="wallet-address"
              className="block text-sm font-black text-white/70 mb-3 tracking-wider"
            >
              {t("stellarAddressLabel")}
            </label>

            <div className="relative mb-6">
              <input
                ref={addressInputRef}
                id="wallet-address"
                type="text"
                value={walletAddress}
                onChange={handleAddressChange}
                onKeyDown={handleAddressKeyDown}
                placeholder={t("addressPlaceholder")}
                className="w-full px-5 py-4 rounded-xl font-mono text-sm sm:text-base border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  borderColor: localError
                    ? "rgba(239, 68, 68, 0.5)"
                    : "rgba(255, 255, 255, 0.1)",
                  color: "white",
                }}
                tabIndex={0}
                aria-label={t("addressInputAria")}
                aria-required="true"
                aria-invalid={!!localError}
                aria-describedby={errorId}
                aria-errormessage={errorId}
                autoComplete="off"
              />

              <motion.button
                onClick={handlePaste}
                onKeyDown={handlePasteKeyDown}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                tabIndex={0}
                aria-label={t("pasteAria")}
                role="button"
              >
                <Copy
                  className="w-5 h-5"
                  style={{ color: "var(--color-theme-primary)" }}
                  aria-hidden="true"
                />
              </motion.button>
              <AnimatePresence mode="popLayout">
                {validationState === "validating" ||
                validationState === "indexing" ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute right-12 top-1/2 -translate-y-1/2 pr-2 border-r border-white/20"
                  >
                    <div className="w-5 h-5 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
                  </motion.div>
                ) : validationState === "valid" ? (
                  <motion.div
                    key="valid"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute right-12 top-1/2 -translate-y-1/2 pr-2 border-r border-white/20"
                  >
                    <CheckCircle
                      className="w-5 h-5 text-green-500"
                      aria-hidden="true"
                    />
                  </motion.div>
                ) : validationState === "invalid" ||
                  validationState === "invalid-format" ||
                  validationState === "wrong-network" ||
                  validationState === "not-found" ||
                  validationState === "error" ? (
                  <motion.div
                    key="invalid"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute right-12 top-1/2 -translate-y-1/2 pr-2 border-r border-white/20"
                  >
                    <XCircle
                      className="w-5 h-5 text-red-500"
                      aria-hidden="true"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Validation State Feedback Messages */}
            <AnimatePresence mode="popLayout">
              {validationState === "validating" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-xl text-yellow-500 text-sm text-center font-medium"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    {t("checkingAccount")}
                  </div>
                </motion.div>
              )}
              {validationState === "indexing" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-theme-primary/10 border-2 border-theme-primary/50 rounded-xl text-theme-primary text-sm text-center font-medium"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
                    {t("indexingTransactions")}
                  </div>
                </motion.div>
              )}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  id="address-error"
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                  className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/50 rounded-xl text-red-400 text-sm text-center font-medium"
                >
                  ⚠️ {errorMessage}
                </motion.div>
              )}
              {localError && !errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/50 rounded-xl text-red-400 text-sm text-center font-medium"
                >
                  ⚠️ {localError}
                  {localError.includes("Freighter") && localError.includes("installed") && (
                    <a
                      href="https://www.freighter.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 underline font-bold"
                    >
                      {t("freighterInstallLink")}
                    </a>
                  )}
                </motion.div>
              )}
              {/* ── Network mismatch prompt ───────────────────────────── */}
              {networkMismatch && (
                <motion.div
                  data-testid="network-mismatch-prompt"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-xl text-yellow-300 text-sm font-medium"
                >
                  <p className="font-bold mb-1">{t("networkMismatchTitle")}</p>
                  <p className="text-yellow-400/80 text-xs mb-3">
                    {t.rich("networkMismatchDescription", {
                      actual: (chunks) => (
                        <span className="font-bold text-yellow-300">{chunks}</span>
                      ),
                      expected: (chunks) => (
                        <span className="font-bold text-yellow-300">{chunks}</span>
                      ),
                    })}
                  </p>
                  <button
                    data-testid="network-mismatch-retry"
                    onClick={() => {
                      setNetworkMismatch(null);
                      handleFreighterConnect();
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 font-bold text-xs hover:bg-yellow-500/30 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  >
                    {t("networkMismatchRetry")}
                  </button>
                </motion.div>
              )}
              {!isOnline && !localError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-yellow-500/10 border-2 border-yellow-500/50 rounded-xl text-yellow-400 text-sm text-center font-medium"
                >
                  {t("offlineNotice")}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              {showPreview ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-6 bg-theme-primary/10 border-2 border-theme-primary/50 rounded-xl"
                >
                  <h2 className="text-sm font-bold text-white/80 mb-4 tracking-wide">
                    {t("accountSummary.title")}
                  </h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">{t("accountSummary.network")}</span>
                      <span className="text-white font-bold">
                        {network === "testnet" ? t("accountSummary.testnet") : t("accountSummary.mainnet")}
                      </span>
                    </div>
                    {previewLoading ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">{t("accountSummary.balance")}</span>
                          <div className="w-20 h-5 bg-white/10 rounded animate-pulse" />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">{t("accountSummary.recentTransactions")}</span>
                          <div className="w-20 h-5 bg-white/10 rounded animate-pulse" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">{t("accountSummary.xlmBalance")}</span>
                          <span className="text-white font-bold">{previewBalance} XLM</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">{t("accountSummary.totalOperations")}</span>
                          <span className="text-white font-bold">{previewTxCount}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <motion.button
                    onClick={handleContinue}
                    disabled={Boolean(networkMismatch)}
                    className="w-full mt-4 px-6 py-3 rounded-xl font-bold text-black bg-theme-primary hover:bg-theme-primary/90 transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>{t("accountSummary.continue")}</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  key="manual-connect"
                  ref={connectButtonRef}
                  onClick={handleConnect}
                  onKeyDown={handleConnectKeyDown}
                  disabled={
                    !isOnline || !walletAddress.trim() || isConnecting || !isValid
                  }
                  className="w-full relative group disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                  whileHover={{
                    scale:
                      !isOnline || !walletAddress.trim() || isConnecting || !isValid
                        ? 1
                        : 1.02,
                  }}
                  whileTap={{
                    scale:
                      !isOnline || !walletAddress.trim() || isConnecting || !isValid
                        ? 1
                        : 0.98,
                  }}
                  tabIndex={0}
                  aria-label={
                    !isOnline
                      ? t("offlineAria")
                      : isConnecting
                        ? t("connectingAria")
                        : t("startWrappingAria")
                  }
                  aria-disabled={
                    !isOnline || !walletAddress.trim() || isConnecting || !isValid
                  }
                  role="button"
                >
                  <motion.div
                    className="absolute -inset-1 rounded-xl blur-lg"
                    style={{
                      backgroundColor: "rgba(var(--color-theme-primary-rgb), 0.4)",
                    }}
                    animate={{
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                  />

                  <div
                    className="relative px-8 py-5 rounded-xl font-black text-lg sm:text-xl tracking-tight transition-all duration-200 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                    style={{
                      backgroundColor: isConnecting
                        ? "rgba(var(--color-theme-primary-rgb), 0.5)"
                        : "var(--color-theme-primary)",
                      color: "#000000",
                      cursor:
                        !isOnline || !walletAddress.trim() || isConnecting || !isValid
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {!isOnline ? (
                      t("offline")
                    ) : isConnecting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>{t("connecting")}</span>
                      </>
                    ) : (
                      t("startWrapping")
                    )}
                  </div>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Wallet Connect Options */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              <p className="text-center text-sm font-medium text-white/50 mb-4">
                {t("orConnectWith")}
              </p>
              <motion.button
                ref={freighterButtonRef}
                onClick={handleFreighterConnect}
                onKeyDown={handleFreighterKeyDown}
                disabled={!isOnline || isConnecting}
                className="w-full px-6 py-4 bg-transparent border-2 rounded-xl font-bold text-white/70 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                style={{
                  borderColor: "rgba(var(--color-theme-primary-rgb), 0.3)",
                }}
                whileHover={{ scale: !isOnline || isConnecting ? 1 : 1.02 }}
                whileTap={{ scale: !isOnline || isConnecting ? 1 : 0.98 }}
                tabIndex={0}
                aria-label={t("freighterButtonAria")}
                aria-disabled={!isOnline || isConnecting}
                role="button"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    <span>{t("connecting")}</span>
                  </>
                ) : (
                  <>
                    <Wallet
                      className="w-5 h-5"
                      style={{ color: "var(--color-theme-primary)" }}
                      aria-hidden="true"
                    />
                    <span>{t("freighterButton")}</span>
                  </>
                )}
              </motion.button>

              <motion.button
                onClick={handleAlbedoConnect}
                onKeyDown={handleAlbedoKeyDown}
                disabled={!isOnline || isConnecting}
                className="w-full px-6 py-4 bg-transparent border-2 rounded-xl font-bold text-white/70 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                style={{
                  borderColor: "rgba(var(--color-theme-primary-rgb), 0.3)",
                }}
                whileHover={{ scale: !isOnline || isConnecting ? 1 : 1.02 }}
                whileTap={{ scale: !isOnline || isConnecting ? 1 : 0.98 }}
                tabIndex={0}
                aria-label={t("albedoButtonAria")}
                aria-disabled={!isOnline || isConnecting}
                role="button"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    <span>{t("connecting")}</span>
                  </>
                ) : (
                  <>
                    <Wallet
                      className="w-5 h-5"
                      style={{ color: "var(--color-theme-primary)" }}
                      aria-hidden="true"
                    />
                    <span>{t("albedoButton")}</span>
                  </>
                )}
              </motion.button>

              <motion.button
                onClick={handleXBullConnect}
                onKeyDown={handleXBullKeyDown}
                disabled={!isOnline || isConnecting}
                className="w-full px-6 py-4 bg-transparent border-2 rounded-xl font-bold text-white/70 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                style={{
                  borderColor: "rgba(var(--color-theme-primary-rgb), 0.3)",
                }}
                whileHover={{ scale: !isOnline || isConnecting ? 1 : 1.02 }}
                whileTap={{ scale: !isOnline || isConnecting ? 1 : 0.98 }}
                tabIndex={0}
                aria-label={t("xbullButtonAria")}
                aria-disabled={!isOnline || isConnecting}
                role="button"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    <span>{t("connecting")}</span>
                  </>
                ) : (
                  <>
                    <Wallet
                      className="w-5 h-5"
                      style={{ color: "var(--color-theme-primary)" }}
                      aria-hidden="true"
                    />
                    <span>{t("xbullButton")}</span>
                  </>
                )}
              </motion.button>

              <motion.button
                onClick={handleWalletConnectConnect}
                onKeyDown={handleWalletConnectKeyDown}
                disabled={!isOnline || isConnecting}
                className="w-full px-6 py-4 bg-transparent border-2 rounded-xl font-bold text-white/70 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black"
                style={{
                  borderColor: "rgba(var(--color-theme-primary-rgb), 0.3)",
                }}
                whileHover={{ scale: !isOnline || isConnecting ? 1 : 1.02 }}
                whileTap={{ scale: !isOnline || isConnecting ? 1 : 0.98 }}
                tabIndex={0}
                aria-label={t("walletConnectButtonAria")}
                aria-disabled={!isOnline || isConnecting}
                role="button"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    <span>{t("connecting")}</span>
                  </>
                ) : (
                  <>
                    <QrCode
                      className="w-5 h-5"
                      style={{ color: "var(--color-theme-primary)" }}
                      aria-hidden="true"
                    />
                    <span>{t("walletConnectButton")}</span>
                  </>
                )}
              </motion.button>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs sm:text-sm text-white/50 text-center mb-3">
                {t("noWalletPrompt")}{" "}
                <a
                  href="https://stellar.org/wallets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold hover:text-white/80 transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black focus:rounded"
                  style={{ color: "var(--color-theme-primary)" }}
                  tabIndex={0}
                  aria-label={t("getOneHereAria")}
                >
                  {t("getOneHere")}
                </a>
              </p>
              <motion.button
                ref={demoButtonRef}
                onClick={handleDemoMode}
                onKeyDown={handleDemoKeyDown}
                className="w-full text-xs sm:text-sm font-bold text-white/40 hover:text-white/60 transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 focus:ring-offset-black focus:rounded"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                tabIndex={0}
                aria-label={t("tryDemoModeAria")}
                role="button"
              >
                {t("tryDemoMode")}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
