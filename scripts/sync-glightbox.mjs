import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const base64Src = await readFile(
    path.join(rootDir, "node_modules", "js-base64", "base64.js"),
    "utf8",
  );
  const emlSrc = await readFile(
    path.join(rootDir, "node_modules", "eml-parse-js", "dist", "index.iife.js"),
    "utf8",
  );

  const bundle = [
    "(function(global) {",
    "// --- js-base64 ---",
    "var Base64;",
    "(function() {",
    "  var exports = {};",
    "  var module = { exports: {} };",
    base64Src,
    "  Base64 = module.exports.Base64 || module.exports;",
    "})();",
    "",
    "// --- eml-parse-js ---",
    emlSrc,
    "global.EmlParseJs = EmlParseJs;",
    "})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);",
  ].join("\n");

  const dest = path.join(rootDir, "assets", "javascripts", "eml-parse-js.js");
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bundle, "utf8");
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
