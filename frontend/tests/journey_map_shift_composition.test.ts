/**
 * Ensures Chapter 1's Stage 3 shift rasters share one fixed campus composition.
 * The lighting-tolerant edge-correlation check catches a regenerated shift that
 * moves courts, paths, buildings, or landmarks while still carrying valid hashes.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

type DecodedPng = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
};
const { PNG } = require('pngjs') as {
  PNG: { readonly sync: { read(input: Buffer): DecodedPng } };
};

const MAP_DIR = path.join(process.cwd(), 'assets/ui/journey/map');
const MASTER = 'map-campus-background-ch1-day.png';
const VARIANTS = [
  'map-campus-background-ch1-evening-locked.png',
  'map-campus-background-ch1-night-locked.png',
] as const;
const GRID = 64;
const MIN_STRUCTURE_CORRELATION = 0.70;

function edgeSignature(fileName: string): number[] {
  const png = PNG.sync.read(fs.readFileSync(path.join(MAP_DIR, fileName)));
  const gray = Array.from({ length: GRID }, () => Array<number>(GRID).fill(0));

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const sourceX = Math.floor(x * png.width / GRID);
      const sourceY = Math.floor(y * png.height / GRID);
      const pixel = (sourceY * png.width + sourceX) * 4;
      gray[y]![x] = (
        0.299 * png.data[pixel]! +
        0.587 * png.data[pixel + 1]! +
        0.114 * png.data[pixel + 2]!
      );
    }
  }

  const edges: number[] = [];
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const horizontal = gray[y]![x + 1]! - gray[y]![x - 1]!;
      const vertical = gray[y + 1]![x]! - gray[y - 1]![x]!;
      edges.push(Math.hypot(horizontal, vertical));
    }
  }
  return edges;
}

function correlation(a: number[], b: number[]): number {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let numerator = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index++) {
    const deltaA = a[index]! - meanA;
    const deltaB = b[index]! - meanB;
    numerator += deltaA * deltaB;
    magnitudeA += deltaA * deltaA;
    magnitudeB += deltaB * deltaB;
  }
  return numerator / Math.sqrt(magnitudeA * magnitudeB);
}

const masterSignature = edgeSignature(MASTER);
for (const variant of VARIANTS) {
  const score = correlation(masterSignature, edgeSignature(variant));
  assert.ok(
    score >= MIN_STRUCTURE_CORRELATION,
    `${variant} structural correlation ${score.toFixed(3)} is below ` +
      `${MIN_STRUCTURE_CORRELATION}; regenerate it from the locked day composition.`,
  );
  console.log(`✓ ${variant} shares the locked campus composition (${score.toFixed(3)})`);
}