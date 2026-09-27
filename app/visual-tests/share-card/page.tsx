"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShareImageCard } from "@/app/components/ShareImageCard";
import { themeColors, type ThemeColor } from "@/app/context/theme-constants";

const validThemes = new Set<ThemeColor>(["green", "pink", "yellow", "red", "purple"]);

const scenarioData = {
  short: {
    username: "stellar_legend",
    transactions: 1,
    persona: "The Hodler",
    vibes: [{ percentage: 72, label: "Diamond Hands" }],
  },
  long: {
    username: "stellar_legend",
    transactions: 100,
    persona: "The Soroban Architect",
    vibes: [{ percentage: 88, label: "Contract Builder" }],
  },
  max: {
    username: "stellar_legend",
    transactions: 999999,
    persona: "The Wizard",
    vibes: [{ percentage: 60, label: "DeFi Sorcerer" }],
  },
  missing: {
    username: "stellar_legend",
    transactions: 100,
    persona: "The Soroban Architect",
    vibes: [],
  },
};

type ScenarioName = keyof typeof scenarioData;

function ShareCardVisualFixture() {
  const searchParams = useSearchParams();
  const themeParam = searchParams.get("theme") as ThemeColor | null;
  const scenarioParam = searchParams.get("scenario") as ScenarioName | null;
  const theme = themeParam && validThemes.has(themeParam) ? themeParam : "green";
  const scenario = scenarioParam && scenarioParam in scenarioData ? scenarioParam : "short";
  const archetypeImage = scenario === "missing" ? null : "/archetypes/wizard.png";

  return (
    <main
      style={{
        width: "1080px",
        height: "1080px",
        margin: 0,
        overflow: "hidden",
        backgroundColor: "#020202",
      }}
    >
      <div data-testid="share-image-card">
        <ShareImageCard
          themeColor={themeColors[theme].primary}
          archetypeImage={archetypeImage}
          data={scenarioData[scenario]}
        />
      </div>
    </main>
  );
}

export default function ShareCardVisualTestPage() {
  return (
    <Suspense fallback={null}>
      <ShareCardVisualFixture />
    </Suspense>
  );
}
