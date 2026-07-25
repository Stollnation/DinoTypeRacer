import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const entry of ["index.html", "styles.css", "src", "assets", "README.md", "ASSET_GUIDE.md"]) await cp(join(root, entry), join(dist, entry), { recursive: true });
console.log(`Built Dino Type Racer to ${dist}`);
