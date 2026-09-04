import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

import { extractJtaFrames } from '../../../tools/vendor/OpenFairyGUI/packages/functions/src/atlas/jta.ts';

function usage(): never {
  throw new Error('Usage: extract-fairygui-jta <input.jta> <output-directory>');
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) usage();

const inputPath = resolve(inputArg);
const outputDirectory = resolve(outputArg);
const clipName = basename(inputPath, extname(inputPath));
const extracted = extractJtaFrames(new Uint8Array(await readFile(inputPath)));

await mkdir(outputDirectory, { recursive: true });

const textureFiles: Array<string | null> = [];
for (let index = 0; index < extracted.frames.length; index += 1) {
  const bytes = extracted.frames[index]!;
  if (bytes.byteLength === 0) {
    textureFiles.push(null);
    continue;
  }

  const extension = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : 'png';
  const fileName = `${clipName}-${String(index).padStart(2, '0')}.${extension}`;
  await writeFile(join(outputDirectory, fileName), bytes);
  textureFiles.push(fileName);
}

await writeFile(
  join(outputDirectory, `${clipName}.json`),
  `${JSON.stringify({ ...extracted.meta, textureFiles }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({
  inputPath,
  outputDirectory,
  frameCount: extracted.meta.frames.length,
  textureCount: extracted.frames.length,
  interval: extracted.meta.interval,
  repeatDelay: extracted.meta.repeatDelay,
  width: extracted.meta.width,
  height: extracted.meta.height,
}, null, 2));
