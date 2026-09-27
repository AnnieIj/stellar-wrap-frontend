/**
 * Tests for generate-persona server action.
 *
 * Covers:
 *  - Action rejection when OPENAI_API_KEY is missing
 *  - Empty stream from the AI SDK
 *  - API-level errors (auth, quota, network)
 *  - Deterministic fallback behaviour
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ─── Mock ai/rsc module ───────────────────────────────────────────────────────

vi.mock("ai/rsc", () => {
  function createStreamable() {
    const chunks: string[] = [];
    let doneResolve: () => void;
    const donePromise = new Promise<void>((resolve) => {
      doneResolve = resolve;
    });
    const sv = {
      _chunks: chunks,
      _donePromise: donePromise,
      append: (chunk: string) => {
        chunks.push(chunk);
      },
      done: () => {
        doneResolve();
      },
      error: () => {
        doneResolve();
      },
    };
    return Object.assign(sv, { value: sv });
  }

  return {
    createStreamableValue: vi.fn(() => createStreamable()),
    readStreamableValue: vi.fn(async function* (value: any) {
      if (typeof value !== "object" || value === null) return;
      const p = value._donePromise || value.donePromise;
      const c = value._chunks || value.chunks;
      if (!p || !c) return;
      await p;
      for (const chunk of c) {
        yield chunk;
      }
    }),
  };
});

// ─── Mock ai module ───────────────────────────────────────────────────────────

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

// ─── Mock @ai-sdk/openai module ──────────────────────────────────────────────

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((model: string) => ({ model })),
}));

// ─── Module under test ─────────────────────────────────────────────────────────

import { generatePersonaDescription } from "../generate-persona";
import type { PersonaMetrics } from "../generate-persona";

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function consumeStream(
  streamVal: Awaited<ReturnType<typeof generatePersonaDescription>>,
): Promise<string> {
  const { readStreamableValue } = await import("ai/rsc");
  let result = "";
  for await (const chunk of readStreamableValue(streamVal)) {
    if (chunk) {
      result += chunk;
    }
  }
  return result;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const baseMetrics: PersonaMetrics = {
  username: "testuser",
  topDapp: "Lobstr",
  transactionCount: 42,
  favoriteChain: "Stellar",
  percentile: 75,
  totalDapps: 3,
  vibes: [{ type: "DeFi", percentage: 60 }],
};

// ─── Tests: Missing / placeholder API key ──────────────────────────────────────

describe("generatePersonaDescription — missing or placeholder API key", () => {
  const OLD_KEY = process.env.OPENAI_API_KEY;

  afterAll(() => {
    process.env.OPENAI_API_KEY = OLD_KEY;
  });

  it("returns a deterministic fallback when OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;

    const response = await generatePersonaDescription(baseMetrics);
    const text = await consumeStream(response);

    expect(text).toBeTruthy();
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(10);
  });

  it("returns a deterministic fallback when OPENAI_API_KEY is a placeholder", async () => {
    process.env.OPENAI_API_KEY = "sk-your-key-here";

    const response = await generatePersonaDescription(baseMetrics);
    const text = await consumeStream(response);

    expect(text).toBeTruthy();
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(10);
  });

  it("returns the same fallback for identical metrics (deterministic)", async () => {
    delete process.env.OPENAI_API_KEY;

    const resp1 = await generatePersonaDescription(baseMetrics);
    const resp2 = await generatePersonaDescription(baseMetrics);

    const text1 = await consumeStream(resp1);
    const text2 = await consumeStream(resp2);

    expect(text1).toBe(text2);
  });

  it("does NOT call the real streamText when API key is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const { streamText } = await import("ai");

    await generatePersonaDescription(baseMetrics);

    expect(streamText).not.toHaveBeenCalled();
  });
});

// ─── Tests: Stream handling ────────────────────────────────────────────────────

describe("generatePersonaDescription — stream handling", () => {
  const OLD_KEY = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = "sk-real-key-12345";
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = OLD_KEY;
  });

  it("returns a fallback when the AI stream yields no chunks", async () => {
    async function* emptyStream() {
      // yield nothing
    }

    const { streamText } = await import("ai");
    (streamText as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      textStream: emptyStream(),
    });

    const response = await generatePersonaDescription(baseMetrics);
    const text = await consumeStream(response);

    expect(text).toBeTruthy();
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(10);
  });
});

// ─── Tests: Error recovery ────────────────────────────────────────────────────

describe("generatePersonaDescription — error recovery", () => {
  const OLD_KEY = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = "sk-real-key-12345";
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = OLD_KEY;
  });

  it("returns a fallback on quota / auth errors instead of throwing", async () => {
    const { streamText } = await import("ai");
    (streamText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Insufficient quota"),
    );

    const response = await generatePersonaDescription(baseMetrics);
    const text = await consumeStream(response);

    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(10);
  });

  it("returns a fallback on network errors", async () => {
    const { streamText } = await import("ai");
    (streamText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("fetch failed"),
    );

    const response = await generatePersonaDescription(baseMetrics);
    const text = await consumeStream(response);

    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(10);
  });

  it("returns a fallback on 401 authentication errors", async () => {
    const { streamText } = await import("ai");
    (streamText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("401 - Authentication failed"),
    );

    const response = await generatePersonaDescription(baseMetrics);
    const text = await consumeStream(response);

    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(10);
  });
});
