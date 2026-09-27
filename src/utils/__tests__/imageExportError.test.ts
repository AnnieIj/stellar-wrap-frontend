import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadShareImage } from "../../../app/utils/imageExport";
import html2canvas from "html2canvas";

// Mock html2canvas module
vi.mock("html2canvas", () => {
  return {
    default: vi.fn(),
  };
});

describe("Share Image Export Error Handling & Retry Recovery", () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElement = document.createElement("div");
    mockElement.innerHTML = `<div data-testid="share-card">Share Card Content</div>`;
    document.body.appendChild(mockElement);
  });

  it("should handle html2canvas rejection and throw descriptive error", async () => {
    const mockError = new Error("html2canvas rendering failed: Canvas context lost");
    vi.mocked(html2canvas).mockRejectedValueOnce(mockError);

    await expect(downloadShareImage(mockElement)).rejects.toThrow(
      "html2canvas rendering failed: Canvas context lost",
    );
  });

  it("should handle canvas to blob failure", async () => {
    // Mock html2canvas resolving with a mock canvas where toBlob fails/returns null
    const mockCanvas = document.createElement("canvas");
    vi.spyOn(mockCanvas, "toBlob").mockImplementation((callback) => {
      // Simulate toBlob returning null (e.g. out of memory or unsupported format)
      callback(null);
    });

    vi.mocked(html2canvas).mockResolvedValueOnce(mockCanvas as any);

    await expect(downloadShareImage(mockElement)).rejects.toThrow(
      "Failed to generate image blob",
    );
  });

  it("should allow retrying download after initial failure", async () => {
    // 1st call fails
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error("Browser API failure"));

    await expect(downloadShareImage(mockElement)).rejects.toThrow("Browser API failure");

    // 2nd call succeeds (simulating user clicking retry button)
    const mockCanvas = document.createElement("canvas");
    mockCanvas.width = 100;
    mockCanvas.height = 100;
    vi.spyOn(mockCanvas, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["fake-image-data"], { type: "image/png" }));
    });

    // Mock URL methods for jsdom/node environment
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }

    vi.mocked(html2canvas).mockResolvedValueOnce(mockCanvas as any);

    const result = await downloadShareImage(mockElement);
    expect(result.scale).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
