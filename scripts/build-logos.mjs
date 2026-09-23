/**
 * Derives the shipped logo assets in public/pyronaut-assets/ from the pristine
 * upstream artwork mirrored in resources/ (micronaut-projects/pyronaut media/).
 *
 * The outputs are committed, so this is a one-off asset pipeline rather than a
 * build step — it is deliberately NOT wired into `npm run build` and sharp is
 * not a project dependency. To re-run it:
 *
 *   npm i --no-save sharp && node scripts/build-logos.mjs
 *
 * What it does beyond copying:
 *  - Tightens the full logo's viewBox to the artwork's real ink bounds; the
 *    upstream canvas is loose and would render small and off-centre.
 *  - Crops a mascot-only variant, using the clean gutter above the wordmark.
 *  - Re-encodes embedded rasters as palette PNGs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const sharp = createRequire(import.meta.url)('sharp');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'resources');
const out = join(root, 'public/pyronaut-assets');

/** Alpha bounding box of a rendered SVG, optionally limited to a band of rows. */
async function inkBounds(svg, yFrom = 0, yTo = Infinity) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = Math.max(0, yFrom); y <= Math.min(height - 1, yTo); y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Rewrite the outer <svg> tag so the viewBox frames exactly the given box. */
function reframe(svg, b) {
  const open = svg.match(/<svg\b[^>]*>/);
  const tag = open[0]
    .replace(/\swidth="[^"]*"/, ` width="${b.w}"`)
    .replace(/\sheight="[^"]*"/, ` height="${b.h}"`)
    .replace(/\sviewBox="[^"]*"/, ` viewBox="${b.x} ${b.y} ${b.w} ${b.h}"`);
  return svg.replace(open[0], tag);
}

/**
 * Re-encode every embedded raster as a 256-colour palette PNG. The upstream art
 * is flat cartoon shading, so this is visually indistinguishable while cutting
 * roughly three quarters of the bytes — these SVGs are raster wrappers, not
 * vector, and ship unoptimised at ~5 MB across the page otherwise.
 */
async function optimizeRasters(svg) {
  const re = /data:image\/png;base64,\s*([^"]+)/g;
  let outStr = '';
  let cursor = 0;
  let m;
  while ((m = re.exec(svg))) {
    const original = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
    let encoded = original;
    try {
      const q = await sharp(original)
        .png({ palette: true, colors: 256, compressionLevel: 9, effort: 10 })
        .toBuffer();
      if (q.length < original.length) encoded = q;
    } catch {
      /* leave tiny or already-optimal payloads alone */
    }
    outStr += svg.slice(cursor, m.index) + 'data:image/png;base64,' + encoded.toString('base64');
    cursor = re.lastIndex;
  }
  return outStr + svg.slice(cursor);
}

async function emit(name, svg, bounds) {
  svg = await optimizeRasters(svg);
  const b = bounds ?? (await inkBounds(svg));
  const framed = reframe(svg, b);
  writeFileSync(join(out, name), framed);
  console.log(`${name.padEnd(21)} ${b.w}x${b.h}  ${(framed.length / 1024).toFixed(0)} KB`);
  return framed;
}

// ---------------------------------------------------------------------------
// 1. Narrow header, light + dark. Upstream ships the wordmark alone on a
//    canvas already sized around it; that padding sets how large the type
//    renders at the header's fixed height, so the canvas is kept as-is.
// ---------------------------------------------------------------------------
const logoSvg = readFileSync(join(res, 'pyronaut_logo.svg'), 'utf8');
const hdrBounds = { x: 0, y: 0, w: 2126, h: 364 };
await emit('logo-header.svg', readFileSync(join(res, 'pyronaut_narrow_header.svg'), 'utf8'), hdrBounds);
await emit('logo-header-dark.svg', readFileSync(join(res, 'pyronaut_narrow_header_white.svg'), 'utf8'), hdrBounds);

// ---------------------------------------------------------------------------
// 2. Full logo (mascot + wordmark) and the mascot-only crop.
// ---------------------------------------------------------------------------
const logoDarkSvg = readFileSync(join(res, 'pyronaut_logo_white_text.svg'), 'utf8');
const fullBounds = await inkBounds(logoSvg);
await emit('logo-full.svg', logoSvg, fullBounds);
await emit('logo-full-dark.svg', logoDarkSvg, fullBounds);

// Wordmark is separated from the mascot by a clean gutter; crop above it.
const WORDMARK_GUTTER_Y = 816;
await emit('mascot.svg', logoSvg, await inkBounds(logoSvg, 0, WORDMARK_GUTTER_Y));

// ---------------------------------------------------------------------------
// 3. Raster fallbacks: og:image (social cards will not render SVG) + favicon.
// ---------------------------------------------------------------------------
const mascotSvg = readFileSync(join(out, 'mascot.svg'));
await sharp(mascotSvg).resize({ width: 1200 }).png().toFile(join(out, 'mascot.png'));
await sharp(mascotSvg)
  .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(join(out, 'favicon.png'));
console.log('mascot.png + favicon.png written');
