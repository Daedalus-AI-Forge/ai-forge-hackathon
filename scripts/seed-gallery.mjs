#!/usr/bin/env node
// Fill the meet-up photo gallery of the seeded GRANTED voyages (teamSeed:run with global: true)
// with real stored files: upload every .jpg/.jpeg/.png in <dir> to Convex file storage, then
// attach them round-robin as confirmed meet-up photos (teamSeed:attachGalleryPhotos).
//
//   node scripts/seed-gallery.mjs <dir> [--replace] [--prod]
//
// The files also join the stock pool (convex/gallery.ts) that fills every other blank success
// story (found voyages, seed.ts stories, bot claims). --replace swaps the whole pool: stories on
// old pool photos are re-pointed and the old files deleted. Use only generic scene images of
// groups meeting up (illustrated or non-identifiable people), never real users' photos.
// Photorealistic scenes of fictional people come from galleryAi:generatePhotos + gallery:usePhotoreal
// and are preferred over these files, which stay as the fallback.
// teamSeed:run and seed:run keep/refill photos on reseed; re-run this only to change pictures.
// The CLI must be linked to the target deployment (npx convex dev / CONVEX_DEPLOYMENT).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const MAX_BYTES = 10 * 1024 * 1024; // meetings.MEETING_PHOTO_MAX_BYTES
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

const [dir, ...flags] = process.argv.slice(2);
if (!dir) {
  console.error("Usage: node scripts/seed-gallery.mjs <dir-of-images> [--prod]");
  process.exit(1);
}
const prod = flags.includes("--prod");
const replace = flags.includes("--replace");

function run(fn, args) {
  const out = execFileSync("npx", ["convex", "run", ...(prod ? ["--prod"] : []), fn, JSON.stringify(args)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out);
}

const files = readdirSync(dir)
  .filter((f) => TYPES[extname(f).toLowerCase()])
  .sort()
  .map((f) => join(dir, f));
if (files.length === 0) throw new Error(`No .jpg/.jpeg/.png files in ${dir}`);
for (const f of files) {
  if (statSync(f).size > MAX_BYTES) throw new Error(`${f} is over ${MAX_BYTES} bytes; compress it first`);
}

const urls = run("teamSeed:galleryUploadUrls", { count: files.length });
const storageIds = [];
for (const [i, file] of files.entries()) {
  const res = await fetch(urls[i], {
    method: "POST",
    headers: { "Content-Type": TYPES[extname(file).toLowerCase()] },
    body: readFileSync(file),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Upload of ${file} failed: ${res.status} ${await res.text()}`);
  const { storageId } = await res.json();
  storageIds.push(storageId);
  console.log(`uploaded ${file}`);
}

if (replace) console.log(JSON.stringify(run("gallery:replacePool", { storageIds })));
const attached = run("teamSeed:attachGalleryPhotos", { storageIds });
console.log(JSON.stringify({ uploaded: storageIds.length, attached: attached.length, wishIds: attached.map((a) => a.wishId) }));
if (attached.length === 0) console.warn("No seeded granted voyages found. Run teamSeed:run with global: true first.");

const audit = run("gallery:audit", {});
const blank = audit.reduce((n, r) => n + r.without.length, 0);
console.log(JSON.stringify({ stories: audit.reduce((n, r) => n + r.stories, 0), withoutPhoto: blank }));
