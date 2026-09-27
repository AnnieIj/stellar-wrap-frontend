import {
  STORY_SEGMENT_COUNT,
  STORY_SEGMENT_LABELS,
  getStorySegmentClassName,
  getStorySegmentLabel,
  getStorySegmentVisualState,
} from "../storyShellProgress";

describe("StoryShell progress segments", () => {
  describe("getStorySegmentVisualState", () => {
    it("marks the first segment active at the start of the story", () => {
      expect(getStorySegmentVisualState(0, 0)).toBe("active");
      expect(getStorySegmentVisualState(1, 0)).toBe("upcoming");
      expect(getStorySegmentVisualState(6, 0)).toBe("upcoming");
    });

    it("marks completed, active, and upcoming segments in the middle", () => {
      const activeSegment = 3;
      expect(getStorySegmentVisualState(2, activeSegment)).toBe("completed");
      expect(getStorySegmentVisualState(3, activeSegment)).toBe("active");
      expect(getStorySegmentVisualState(4, activeSegment)).toBe("upcoming");
    });

    it("marks all prior segments completed at the final segment", () => {
      const activeSegment = STORY_SEGMENT_COUNT - 1;
      expect(getStorySegmentVisualState(5, activeSegment)).toBe("completed");
      expect(getStorySegmentVisualState(6, activeSegment)).toBe("active");
    });

    it("treats out-of-range activeSegment without throwing", () => {
      expect(getStorySegmentVisualState(0, -1)).toBe("upcoming");
      expect(getStorySegmentVisualState(6, STORY_SEGMENT_COUNT)).toBe(
        "completed",
      );
      expect(
        [...Array(STORY_SEGMENT_COUNT)].every(
          (_, i) => getStorySegmentVisualState(i, 99) === "completed",
        ),
      ).toBe(true);
    });
  });

  describe("getStorySegmentClassName", () => {
    it("applies distinct styles for active, completed, and upcoming segments", () => {
      const active = getStorySegmentClassName(2, 2);
      const completed = getStorySegmentClassName(1, 2);
      const upcoming = getStorySegmentClassName(3, 2);

      expect(active).toContain("w-10");
      expect(active).toContain("bg-[#1DB954]");
      expect(active).toContain("shadow-[0_0_12px_rgba(29,185,84,0.8)]");

      expect(completed).toContain("w-6");
      expect(completed).toContain("bg-[#1DB954]/50");

      expect(upcoming).toContain("w-6");
      expect(upcoming).toContain("bg-white/15");
    });
  });

  describe("getStorySegmentLabel (accessible segment state)", () => {
    it("returns labels for start, middle, and end segments", () => {
      expect(getStorySegmentLabel(0)).toBe(STORY_SEGMENT_LABELS[0]);
      expect(getStorySegmentLabel(3)).toBe(STORY_SEGMENT_LABELS[3]);
      expect(getStorySegmentLabel(6)).toBe(STORY_SEGMENT_LABELS[6]);
    });

    it("falls back for out-of-range activeSegment values", () => {
      expect(getStorySegmentLabel(7)).toBe("Story segment 8");
      expect(getStorySegmentLabel(-1)).toBe("Story segment 0");
    });
  });
});
