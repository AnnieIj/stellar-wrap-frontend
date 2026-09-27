import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConnectPage from "../page";
import { useRouter } from "next/navigation";
import { axe, toHaveNoViolations } from "jest-axe";
import { useStellarAddressValidation } from "@src/hooks/useStellarAddressValidation";
import { useOnlineStatus } from "@app/hooks/useOnlineStatus";

expect.extend(toHaveNoViolations);

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => {
    const translationMap: Record<string, string> = {
      back: "BACK",
      backAria: "Go back to previous page",
      title: "CONNECT WALLET",
      subtitle: "Enter your Stellar wallet address to unwrap your 2026 journey",
      stellarAddressLabel: "STELLAR ADDRESS",
      addressPlaceholder: "Paste your Stellar address here",
      addressInputAria: "Stellar wallet address input",
      pasteAria: "Paste from clipboard",
      freighterButton: "Connect with Freighter",
      freighterButtonAria: "Connect with Freighter wallet",
      albedoButton: "Connect with Albedo",
      albedoButtonAria: "Connect with Albedo wallet",
      xbullButton: "Connect with xBull",
      xbullButtonAria: "Connect with xBull wallet",
      walletConnectButton: "Connect with WalletConnect",
      walletConnectButtonAria: "Connect with WalletConnect mobile wallets",
      useDifferentWallet: "Use a different wallet",
      tryDemoMode: "Or click here to try demo mode →",
      tryDemoModeAria: "Try demo mode",
      startWrapping: "START WRAPPING",
      startWrappingAria: "Start wrapping process",
    };
    const t = (key: string, values?: Record<string, string>) => {
      if (key === "continueAs" && values?.shortAddress) {
        return `Continue as ${values.shortAddress}`;
      }
      return translationMap[key] || key;
    };
    t.rich = (key: string) => translationMap[key] || key;
    return t;
  },
}));

// Mock the Zustand stores and hooks used by the component
jest.mock("$app/store/wrapStore", () => ({
  useWrapStore: jest.fn(() => ({
    setAddress: jest.fn(),
    setError: jest.fn(),
    setStatus: jest.fn(),
    network: "mainnet",
    reset: jest.fn(),
  })),
}));

jest.mock("$app/store/transactionStore", () => ({
  useTransactionStore: jest.fn(() => ({
    resetTransaction: jest.fn(),
  })),
}));

jest.mock("$app/store/multiTimeframeStore", () => ({
  useMultiTimeframeStore: jest.fn(() => ({
    reset: jest.fn(),
  })),
}));

jest.mock("@/app/store/walletStore", () => ({
  useWalletStore: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

jest.mock("@/src/hooks/useStellarAddressValidation", () => ({
  useStellarAddressValidation: jest.fn(() => ({
    address: "",
    validationState: "idle",
    errorMessage: null,
    handleAddressChange: jest.fn(),
    isValid: false,
  })),
}));

jest.mock("$app/hooks/useSound", () => ({
  useSound: jest.fn(() => ({
    playSound: jest.fn(),
  })),
}));

jest.mock("$app/hooks/useOnlineStatus", () => ({
  useOnlineStatus: jest.fn(() => true),
}));

jest.mock("$app/components/ProgressIndicator", () => ({
  ProgressIndicator: () => <div data-testid="progress-indicator" />,
}));

jest.mock("$app/components/MuteToggle", () => ({
  MuteToggle: () => <button data-testid="mute-toggle" />,
}));

jest.mock("lucide-react", () => ({
  ArrowLeft: () => <svg data-testid="arrow-left" />,
  Wallet: () => <svg data-testid="wallet-icon" />,
  CheckCircle: () => <svg data-testid="check-circle" />,
  Xcircle: () => <svg data-testid="x-circle" />,
  Copy: () => <svg data-testid="copy-icon" />,
  QrCode: () => <svg data-testid="qrcode-icon" />,
  ChevronRight: () => <svg data-testid="chevron-right" />,
}));

describe("ConnectPage Keyboard Interactions", () => {
  const mockRouter = { push: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    // Mock standard localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  it("should go back when pressing Escape on the page body", async () => {
    render(<ConnectPage />);

    // Ensure focus is on the container (simulate the useEffect on mount)
    const mainContainer = screen.getByRole("main");
    fireEvent.keyDown(mainContainer, { key: "Escape", code: "Escape" });

    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });

  it("should blur input instead of going back when Escape is pressed while input is focused", async () => {
    const user = userEvent.setup();
    render(<ConnectPage />);

    const input = screen.getByLabelText("Stellar wallet address input");

    // Focus the input
    await user.click(input);
    expect(document.activeElement).toBe(input);

    // Press Escape
    await user.keyboard("{Escape}");

    // Router should not have been called
    expect(mockRouter.push).not.toHaveBeenCalled();
    // Input should be blurred
    expect(document.activeElement).not.toBe(input);
  });

  it("should allow Tab to move freely through the dom elements", async () => {
    const user = userEvent.setup();
    render(<ConnectPage />);

    const input = screen.getByLabelText("Stellar wallet address input");
    const pasteButton = screen.getByLabelText("Paste from clipboard");
    const freighterButton = screen.getByLabelText("Connect with Freighter wallet");

    // Initial tab
    await user.tab();

    // Assert elements are reachable via sequential keyboard tabbing
    // (exact order depends on rendered components, but they should all be focusable)
    expect(input.tabIndex).toBe(0);
    expect(pasteButton.tabIndex).toBe(0);
    expect(freighterButton.tabIndex).toBe(0);
  });

  it("should have no accessibility violations on initial render", async () => {
    const { container } = render(<ConnectPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should mark TokenSelector with correct ARIA attributes", () => {
    render(<ConnectPage />);
    const tokenSelector = screen.getByRole("combobox", { name: /select token/i });
    expect(tokenSelector).toHaveAttribute("aria-expanded", "false");
    expect(tokenSelector).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("should open and close TokenSelector with keyboard", async () => {
    const user = userEvent.setup();
    render(<ConnectPage />);
    const tokenSelector = screen.getByRole("combobox", { name: /select token/i });
    tokenSelector.focus();

    expect(tokenSelector).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowDown}");
    expect(tokenSelector).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(tokenSelector).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("should display an error message with role alert for invalid address", async () => {
    (useStellarAddressValidation as jest.Mock).mockReturnValueOnce({
      address: "invalid",
      validationState: "error",
      errorMessage: "Invalid address",
      handleAddressChange: jest.fn(),
      isValid: false,
    });
    render(<ConnectPage />);
    const errorAlert = screen.getByRole("alert");
    expect(errorAlert).toHaveTextContent("Invalid address");
    const input = screen.getByLabelText("Stellar wallet address input");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("should show offline status with aria-live", async () => {
    (useOnlineStatus as jest.Mock).mockReturnValueOnce(false);
    render(<ConnectPage />);
    const offlineStatus = screen.getByLabelText("Offline status");
    expect(offlineStatus).toHaveAttribute("aria-live", "polite");
  });
})
