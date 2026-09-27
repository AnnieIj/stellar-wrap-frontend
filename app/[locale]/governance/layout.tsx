import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Governance Voting | Stellar Wrap",
  description:
    "Participate in on-chain governance for the Stellar ecosystem. Cast your vote on active proposals using your Freighter wallet.",
  openGraph: {
    title: "Governance Voting | Stellar Wrap",
    description:
      "Participate in on-chain governance — cast votes on active Stellar ecosystem proposals.",
    type: "website",
  },
};

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
