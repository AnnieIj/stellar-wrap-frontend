import {
  SorobanRequestQueue,
  isRetryableRpcError,
} from "../sorobanRequestQueue";

describe("isRetryableRpcError", () => {
  it("treats HTTP 429 / 503 / 504 as retryable", () => {
    expect(isRetryableRpcError(new Error("HttpStatusCodeError: 429"))).toBe(true);
    expect(isRetryableRpcError({ status: 503 })).toBe(true);
    expect(isRetryableRpcError("fetch failed")).toBe(true);
  });

  it("treats timeouts and connection resets as retryable", () => {
    expect(isRetryableRpcError(new Error("request timed out"))).toBe(true);
    expect(isRetryableRpcError("socket hang up ECONNRESET")).toBe(true);
    expect(isRetryableRpcError("NetworkError when attempting to fetch")).toBe(true);
  });

  it("does not retry contract/logic errors", () => {
    expect(isRetryableRpcError(new Error("Error(Contract, #4)"))).toBe(false);
    expect(isRetryableRpcError("Invalid signature")).toBe(false);
  });
});

describe("SorobanRequestQueue", () => {
  it("serializes requests to the configured concurrency cap", async () => {
    const queue = new SorobanRequestQueue(2);
    let active = 0;
    let peak = 0;
    const factories = Array.from({ length: 6 }, () => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return "ok";
    });

    const results = await Promise.all(factories.map((f) => queue.enqueue(f)));
    expect(results).toEqual(Array(6).fill("ok"));
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("coalesces identical in-flight calls into one factory run", async () => {
    const queue = new SorobanRequestQueue(1);
    let calls = 0;
    const factory = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "value";
    };

    const [a, b] = await Promise.all([
      queue.coalesce("key:1", factory),
      queue.coalesce("key:1", factory),
    ]);
    expect(a).toBe("value");
    expect(b).toBe("value");
    expect(calls).toBe(1);
  });

  it("runs separate keys independently", async () => {
    const queue = new SorobanRequestQueue(1);
    let calls = 0;
    const factory = async () => {
      calls += 1;
      return "x";
    };

    const results = await Promise.all([
      queue.coalesce("key:a", factory),
      queue.coalesce("key:b", factory),
    ]);
    expect(results).toEqual(["x", "x"]);
    expect(calls).toBe(2);
  });

  it("retries retryable failures with backoff", async () => {
    const queue = new SorobanRequestQueue(1, 3, 2);
    let attempts = 0;
    const factory = async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("HttpStatusCodeError: 429");
      }
      return "recovered";
    };

    await expect(queue.enqueue(factory)).resolves.toBe("recovered");
    expect(attempts).toBe(3);
  });

  it("rejects when a non-retryable failure surfaces", async () => {
    const queue = new SorobanRequestQueue(1, 3, 2);
    const factory = async () => {
      throw new Error("Error(Contract, #4)");
    };

    await expect(queue.enqueue(factory)).rejects.toThrow("Error(Contract, #4)");
  });
});