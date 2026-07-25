import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png" };
const server = createServer((request, response) => {
  const urlPath = decodeURIComponent((request.url || "/").split("?")[0]);
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safe === "/" || safe === "\\" ? "index.html" : safe);
  try { if (statSync(file).isDirectory()) file = join(file, "index.html"); response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" }); createReadStream(file).pipe(response); } catch { response.writeHead(404); response.end("Not found"); }
});
server.listen(4174, "127.0.0.1", () => console.log("Local URL: http://127.0.0.1:4174"));
