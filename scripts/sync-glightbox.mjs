import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const copies = [
  {
    from: path.join(rootDir, "node_modules", "glightbox", "dist", "js", "glightbox.min.js"),
    to: path.join(rootDir, "assets", "javascripts", "glightbox.min.js"),
  },
  {
    from: path.join(rootDir, "node_modules", "glightbox", "dist", "css", "glightbox.min.css"),
    to: path.join(rootDir, "assets", "stylesheets", "glightbox.min.css"),
  },
];

async function bundleEmlParseJs() {
  const dest = path.join(rootDir, "assets", "javascripts", "eml-parse-js.js");
  await mkdir(path.dirname(dest), { recursive: true });
  await esbuild.build({
    stdin: {
      contents: 'export * from "eml-parse-js";',
      resolveDir: rootDir,
    },
    bundle: true,
    globalName: "EmlParseJs",
    format: "iife",
    outfile: dest,
    platform: "browser",
  });
  console.log(`Bundled eml-parse-js -> ${path.relative(rootDir, dest)}`);
}

async function main() {
  for (const pair of copies) {
    await mkdir(path.dirname(pair.to), { recursive: true });
    await copyFile(pair.from, pair.to);
    console.log(`Copied ${path.relative(rootDir, pair.from)} -> ${path.relative(rootDir, pair.to)}`);
  }
  await bundleEmlParseJs();
}

main().catch((error) => {
  console.error("Failed to sync GLightbox assets:", error.message);
  process.exitCode = 1;
});
