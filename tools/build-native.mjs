import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const iosWeb = join(root, "native", "ios", "Web");
const entries = [
  "index.html",
  "styles.css",
  "app.js",
  "vendor",
  "assets",
  "card-pattern.svg",
  "stamp-texture.svg",
  "station-photo.svg",
  "manifest.webmanifest",
];

await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });
await rm(iosWeb, { force: true, recursive: true });
await mkdir(iosWeb, { recursive: true });

await Promise.all(
  entries.flatMap((entry) => [
    cp(join(root, entry), join(dist, entry), {
      force: true,
      recursive: true,
    }),
    cp(join(root, entry), join(iosWeb, entry), {
      force: true,
      recursive: true,
    }),
  ]),
);

console.log(`Built native web bundle: ${dist}`);
console.log(`Updated iOS web bundle: ${iosWeb}`);
