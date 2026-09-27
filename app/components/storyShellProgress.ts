export const STORY_SEGMENT_COUNT = 7;

export const STORY_SEGMENT_LABELS = [
  "Connect wallet",
  "Top dapps",
  "Transactions of Fury",
  "Vibe check",
  "Persona reveal",
  "Share wrap",
  "Complete",
] as const;

export type StorySegmentVisualState = "active" | "completed" | "upcoming";

export function getStorySegmentVisualState(
  segmentIndex: number,
  activeSegment: number,
): StorySegmentVisualState {
  if (segmentIndex === activeSegment) {
    return "active";
  }
  if (segmentIndex < activeSegment) {
    return "completed";
  }
  return "upcoming";
}

export function getStorySegmentClassName(
  segmentIndex: number,
  activeSegment: number,
): string {
  const base = "h-1.5 rounded-full transition-all duration-500";
  const state = getStorySegmentVisualState(segmentIndex, activeSegment);

  switch (state) {
    case "active":
      return `${base} w-10 bg-[#1DB954] shadow-[0_0_12px_rgba(29,185,84,0.8)]`;
    case "completed":
      return `${base} w-6 bg-[#1DB954]/50`;
    case "upcoming":
      return `${base} w-6 bg-white/15`;
  }
}

export function getStorySegmentLabel(activeSegment: number): string {
  return (
    STORY_SEGMENT_LABELS[activeSegment] ??
    `Story segment ${activeSegment + 1}`
  );
}
