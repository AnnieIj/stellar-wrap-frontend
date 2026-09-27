type WorkerRequest = {
  imageData: ImageData;
  width: number;
  height: number;
};

type WorkerResponse =
  | { blob: Blob }
  | { error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { imageData, width, height } = event.data;

  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      const response: WorkerResponse = {
        error: "Failed to get OffscreenCanvas context",
      };
      self.postMessage(response);
      return;
    }

    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png", quality: 1.0 });
    const response: WorkerResponse = { blob };
    self.postMessage(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Worker encoding failed";
    const response: WorkerResponse = { error: message };
    self.postMessage(response);
  }
};

export {};
