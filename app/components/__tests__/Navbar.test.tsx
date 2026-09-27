/**
 * @jest-environment jsdom
 */

import type * as React from "react";
import type { ThemeMode } from "@/app/context/ThemeContext";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("framer-motion", () => ({
  motion: {
    nav: ({
      children,
      initial: _initial,
      animate: _animate,
      ...props
    }: React.HTMLAttributes<HTMLElement> & {
      initial?: unknown;
      animate?: unknown;
    }) => <nav {...props}>{children}</nav>,
  },
}));

jest.mock("lucide-react", () => ({
  LogOut: ({ size }: { size?: number }) => (
    <svg aria-hidden="true" data-testid="logout-icon" width={size} height={size} />
  ),
}));

jest.mock("../ColorToggle", () => ({
  ColorToggle: () => <button aria-label="Theme picker. Current theme: Spotify Green" />,
}));

jest.mock("../DarkLightToggle", () => ({
  DarkLightToggle: () => <button aria-label="Toggle dark/light mode" />,
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
  },
}));

jest.mock("@/app/store/wrapStore", () => ({
  useWrapStore: jest.fn(),
  resetCache: jest.fn(),
}));

jest.mock("@/app/context/ThemeContext", () => ({
  useTheme: jest.fn(),
}));

const { fireEvent, render, screen } = jest.requireActual(
  "@testing-library/react",
) as typeof import("@testing-library/react");
const { toast } = jest.requireMock("sonner") as typeof import("sonner");
const { Navbar } = jest.requireActual("../Navbar") as typeof import("../Navbar");
const { resetCache, useWrapStore } = jest.requireMock(
  "@/app/store/wrapStore",
) as typeof import("@/app/store/wrapStore");
const { useTheme } = jest.requireMock(
  "@/app/context/ThemeContext",
) as typeof import("@/app/context/ThemeContext");
const { useRouter } = jest.requireMock(
  "next/navigation",
) as typeof import("next/navigation");

const mockPush = jest.fn();
const mockReset = jest.fn();
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseWrapStore = useWrapStore as unknown as jest.MockedFunction<
  () => { address: string | null; reset: () => void }
>;
const mockUseTheme = useTheme as jest.MockedFunction<() => { mode: ThemeMode }>;
const mockResetCache = resetCache as jest.MockedFunction<typeof resetCache>;
const mockToastSuccess = toast.success as jest.MockedFunction<typeof toast.success>;

function mockNavbarState({
  address = null,
  mode = "dark",
}: {
  address?: string | null;
  mode?: ThemeMode;
} = {}) {
  mockUseRouter.mockReturnValue({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  });
  mockUseWrapStore.mockReturnValue({ address, reset: mockReset });
  mockUseTheme.mockReturnValue({ mode });
}

describe("Navbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavbarState();
  });

  it("renders the brand and theme controls without wallet-only actions", () => {
    render(<Navbar />);

    expect(screen.getByText("Zimma")).toBeInTheDocument();
    expect(screen.getByText("Z")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle dark/light mode" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Theme picker. Current theme: Spotify Green",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "History" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Disconnect wallet" }),
    ).not.toBeInTheDocument();
  });

  it("renders connected wallet navigation with a truncated address", () => {
    mockNavbarState({
      address: "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ",
    });

    render(<Navbar />);

    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/history",
    );
    expect(screen.getByText(/^GDRZ.+AZVQ$/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disconnect wallet" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("logout-icon")).toBeInTheDocument();
  });

  it("disconnects the wallet, clears cache, shows feedback, and returns home", () => {
    mockNavbarState({
      address: "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ",
    });

    render(<Navbar />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect wallet" }));

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockResetCache).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith("Wallet disconnected");
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("applies dark theme colors to the shell and connected controls", () => {
    mockNavbarState({
      address: "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ",
      mode: "dark",
    });

    render(<Navbar />);

    expect(screen.getByRole("navigation")).toHaveStyle({
      backgroundColor: "rgba(0,0,0,0.2)",
      borderColor: "rgba(255,255,255,0.05)",
    });
    expect(screen.getByText("Zimma")).toHaveStyle({ color: "#fff" });
    expect(screen.getByText(/^GDRZ.+AZVQ$/)).toHaveStyle({
      backgroundColor: "rgba(255,255,255,0.06)",
      color: "rgba(255,255,255,0.7)",
    });
  });

  it("applies light theme colors to the shell and connected controls", () => {
    mockNavbarState({
      address: "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ",
      mode: "light",
    });

    render(<Navbar />);

    expect(screen.getByRole("navigation")).toHaveStyle({
      backgroundColor: "rgba(255,255,255,0.8)",
      borderColor: "rgba(0,0,0,0.05)",
    });
    expect(screen.getByText("Zimma")).toHaveStyle({ color: "#000" });
    expect(screen.getByText(/^GDRZ.+AZVQ$/)).toHaveStyle({
      backgroundColor: "rgba(0,0,0,0.05)",
      color: "rgba(0,0,0,0.7)",
    });
  });

  it("restores History link color after hover for the current theme", () => {
    mockNavbarState({
      address: "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ",
      mode: "light",
    });

    render(<Navbar />);

    const historyLink = screen.getByRole("link", { name: "History" });
    expect(historyLink).toHaveStyle({ color: "rgba(0,0,0,0.8)" });

    fireEvent.mouseEnter(historyLink);

    historyLink.style.color = "rgb(10, 10, 10)";
    fireEvent.mouseLeave(historyLink);
    expect(historyLink).toHaveStyle({ color: "rgba(0,0,0,0.8)" });
  });

  it("updates and restores disconnect button hover styles for the current theme", () => {
    mockNavbarState({
      address: "GDRZZGQDRBLJBAY24O3EMZFDGZ4EY6A7L24OERKQTPLT4T7SZKLUAZVQ",
      mode: "dark",
    });

    render(<Navbar />);

    const disconnectButton = screen.getByRole("button", {
      name: "Disconnect wallet",
    });
    expect(disconnectButton).toHaveStyle({
      backgroundColor: "transparent",
      color: "rgba(255,255,255,0.6)",
    });

    fireEvent.mouseEnter(disconnectButton);
    expect(disconnectButton).toHaveStyle({
      backgroundColor: "rgba(255,255,255,0.05)",
      color: "#fff",
    });

    fireEvent.mouseLeave(disconnectButton);
    expect(disconnectButton).toHaveStyle({
      backgroundColor: "transparent",
      color: "rgba(255,255,255,0.6)",
    });
  });
});
