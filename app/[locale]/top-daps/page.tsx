"use client";

import { StoryShell } from "../../components/StoryShell";
import { TopDapps } from "../../components/TopDapps";
export default function ResultsPage() {
  return (
    <StoryShell activeSegment={1}>
      <TopDapps />
    </StoryShell>
  );
}
