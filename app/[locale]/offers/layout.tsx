import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offer Creation | Stellar Wrap",
  description:
    "Create DEX sell offers on the Stellar network. Optimistic UI updates show your offer instantly while the transaction confirms on-chain.",
  openGraph: {
    title: "Offer Creation | Stellar Wrap",
    description:
      "Create Stellar DEX sell offers with instant optimistic UI feedback.",
    type: "website",
  },
};

export default function OffersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
