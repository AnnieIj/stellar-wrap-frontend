/**
 * Ensures /api/wrapped uses the server-safe indexer (no IndexedDB).
 * Run with: npx jest app/api/wrapped/__tests__/serverRuntime.test.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

describe("/api/wrapped server runtime compatibility", () => {
  const routeSource = readFileSync(
    join(__dirname, "../route.ts"),
    "utf8",
  );
  const serverSource = readFileSync(
    join(__dirname, "../../../services/indexerServer.ts"),
    "utf8",
  );
  const coreSource = readFileSync(
    join(__dirname, "../../../services/indexerCore.ts"),
    "utf8",
  );

  it("imports indexerServer, not browser indexerService", () => {
    expect(routeSource).toMatch(/from ["']@\/app\/services\/indexerServer["']/);
    expect(routeSource).not.toMatch(/from ["']@\/app\/services\/indexerService["']/);
  });

  it("indexerServer does not reference IndexedDB", () => {
    expect(serverSource).not.toMatch(/indexedDbCache|indexedDB/);
    expect(serverSource).toMatch(/runIndexingCore/);
  });

  it("indexerCore does not reference IndexedDB or browser cache helpers", () => {
    expect(coreSource).not.toMatch(/indexedDbCache|indexedDB|getCacheEntry|setCacheEntry/);
  });

  it("does not reference window or document globals in server modules", () => {
    expect(serverSource).not.toMatch(/\bwindow\b|\bdocument\b/);
    expect(coreSource).not.toMatch(/\bwindow\b|\bdocument\b/);
  });
});
