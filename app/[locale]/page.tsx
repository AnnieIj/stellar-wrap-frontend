import { Metadata } from "next";
import { JsonLd } from "../components/JsonLd";
import { LandingPage } from "../components/LandingPage";

export const metadata: Metadata = {
  title: "Stellar Wrap | Reveal Your On-Chain Persona",
  description:
    "Connect your Stellar wallet and discover your blockchain year in review — transactions, DeFi persona, vibes, and more. Share your wrap with the world.",
  openGraph: {
    title: "Stellar Wrap | Reveal Your On-Chain Persona",
    description:
      "Connect your Stellar wallet and discover your blockchain year in review — transactions, DeFi persona, vibes, and more.",
    url: "/",
  },
};

/** FAQ structured data surfaced in Google rich results for the landing page. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Stellar Wrap?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stellar Wrap is a free web application that analyses your Stellar blockchain wallet activity and generates a personalised year-in-review — showing your total transactions, top DeFi applications, on-chain persona archetype, and vibes.",
      },
    },
    {
      "@type": "Question",
      name: "How do I use Stellar Wrap?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Connect your Stellar wallet address (or use your Freighter or Albedo browser extension), and Stellar Wrap will index your on-chain activity and generate your personalised wrap. It supports both mainnet and testnet.",
      },
    },
    {
      "@type": "Question",
      name: "Is Stellar Wrap free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, Stellar Wrap is completely free to use.",
      },
    },
    {
      "@type": "Question",
      name: "Which Stellar wallets are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stellar Wrap supports manual address entry, Freighter wallet browser extension, and Albedo wallet browser extension.",
      },
    },
  ],
};

export default function Home() {
  return (
    <main id="main-content">
      <JsonLd data={faqJsonLd} />
      <LandingPage />
    </main>
  );
}
