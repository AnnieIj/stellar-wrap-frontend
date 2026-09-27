/**
 * Loading route layout — Server Component.
 *
 * The loading/indexing screen is an ephemeral step in the wrap flow
 * and should not be indexed by search engines.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wrapping Your Journey | Stellar Wrap",
  description:
    "Indexing your Stellar on-chain activity — hang tight while we wrap your year.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoadingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
