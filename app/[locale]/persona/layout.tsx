/**
 * Persona route layout — Server Component.
 *
 * Provides metadata and JSON-LD for the /persona page without modifying
 * the client component that renders the archetype reveal experience.
 */
import type { Metadata } from "next";
import { JsonLd } from "@/app/components/JsonLd";

export const metadata: Metadata = {
  title: "Your On-Chain Persona | Stellar Wrap",
  description:
    "Discover your Stellar blockchain persona archetype — are you The Wizard, The Pioneer, or something else entirely? Find out with Stellar Wrap.",
  openGraph: {
    title: "Your On-Chain Persona | Stellar Wrap",
    description:
      "Discover your Stellar blockchain persona archetype — are you The Wizard, The Pioneer, or something else entirely?",
    url: "/persona",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 1200,
        alt: "Stellar Wrap persona reveal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Your On-Chain Persona | Stellar Wrap",
    description:
      "Discover your Stellar blockchain persona archetype with Stellar Wrap.",
    images: ["/api/og"],
  },
  /**
   * Persona and intermediate flow pages should not be indexed — they
   * require a connected wallet and are ephemeral session states.
   */
  robots: {
    index: false,
    follow: false,
  },
};

/** ProfilePage JSON-LD for the persona archetype reveal screen. */
const personaPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  name: "Stellar Wrap — On-Chain Persona Reveal",
  description:
    "Reveals the user's Stellar blockchain persona archetype based on their on-chain transaction history and DeFi activity patterns.",
  about: {
    "@type": "Person",
    description:
      "A Stellar network user with a unique on-chain activity persona archetype.",
  },
  creator: {
    "@type": "WebApplication",
    name: "Stellar Wrap",
    url: "https://stellarwrap.vercel.app",
  },
  inLanguage: "en",
};

export default function PersonaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={personaPageJsonLd} />
      {children}
    </>
  );
}
