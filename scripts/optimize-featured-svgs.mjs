import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? "public/featured";

function optimizeSvg(svg) {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/ x1="0%" y1="0%" x2="100%" y2="100%"/g, ' x2="1" y2="1"')
    .replace(/ offset="0%" style="stop-color:(#[0-9A-Fa-f]{3,8})"/g, ' stop-color="$1"')
    .replace(/ offset="100%" style="stop-color:(#[0-9A-Fa-f]{3,8})"/g, ' offset="1" stop-color="$1"')
    .replace(/="0\.(\d+)"/g, '=".$1"')
    .trim();
}

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".svg")) continue;
  const path = join(root, entry.name);
  const source = await readFile(path, "utf8");
  await writeFile(path, optimizeSvg(source), "utf8");
}