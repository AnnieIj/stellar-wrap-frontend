import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Export CSV | Stellar Wrap",
  description:
    "Connect your Freighter wallet and export your Stellar wrap data — transaction history, dApp interactions, and vibes — as CSV files.",
  openGraph: {
    title: "Export CSV | Stellar Wrap",
    description:
      "Export your Stellar on-chain wrap data as CSV files using your Freighter wallet.",
    type: "website",
  },
};

export default function ExportCsvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
