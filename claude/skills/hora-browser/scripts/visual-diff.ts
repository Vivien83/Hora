#!/usr/bin/env npx tsx
// Usage: npx tsx scripts/visual-diff.ts <image1> <image2> [output-path] [threshold]

import * as fs from "fs";
import * as path from "path";

interface DiffResult {
  image1: string;
  image2: string;
  output: string;
  width: number;
  height: number;
  totalPixels: number;
  differentPixels: number;
  percentDifferent: number;
  threshold: number;
}

async function loadDependencies() {
  let pixelmatch: typeof import("pixelmatch");
  let PNG: typeof import("pngjs").PNG;

  try {
    const pm = await import("pixelmatch");
    pixelmatch = pm.default ?? pm;
  } catch {
    console.error(
      "pixelmatch is not installed. Install it with:\n\n" +
        "  npm install -D pixelmatch\n"
    );
    process.exit(1);
  }

  try {
    const pngjs = await import("pngjs");
    PNG = pngjs.PNG;
  } catch {
    console.error(
      "pngjs is not installed. Install it with:\n\n" +
        "  npm install -D pngjs\n"
    );
    process.exit(1);
  }

  return { pixelmatch, PNG };
}

function readPng(
  filepath: string,
  PNG: typeof import("pngjs").PNG
): Promise<InstanceType<typeof import("pngjs").PNG>> {
  return new Promise((resolve, reject) => {
    const absolutePath = path.resolve(filepath);

    if (!fs.existsSync(absolutePath)) {
      reject(new Error(`File not found: ${absolutePath}`));
      return;
    }

    const stream = fs.createReadStream(absolutePath).pipe(new PNG());
    stream.on("parsed", function (this: InstanceType<typeof PNG>) {
      resolve(this);
    });
    stream.on("error", (err: Error) => {
      reject(new Error(`Failed to parse PNG ${absolutePath}: ${err.message}`));
    });
  });
}

function writePng(
  filepath: string,
  png: InstanceType<typeof import("pngjs").PNG>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const absolutePath = path.resolve(filepath);
    const dir = path.dirname(absolutePath);

    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      reject(
        new Error(
          `Failed to create directory ${dir}: ${err instanceof Error ? err.message : String(err)}`
        )
      );
      return;
    }

    const stream = png.pack().pipe(fs.createWriteStream(absolutePath));
    stream.on("finish", resolve);
    stream.on("error", (err: Error) => {
      reject(new Error(`Failed to write PNG ${absolutePath}: ${err.message}`));
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: npx tsx visual-diff.ts <image1> <image2> [output-path] [threshold]"
    );
    console.error(
      "Example: npx tsx visual-diff.ts before.png after.png diff.png 0.1"
    );
    process.exit(1);
  }

  const image1Path = args[0];
  const image2Path = args[1];
  const outputPath = args[2] || "diff-output.png";
  const threshold = parseFloat(args[3] || "0.1");

  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    console.error("Threshold must be a number between 0.0 and 1.0");
    process.exit(1);
  }

  const { pixelmatch, PNG } = await loadDependencies();

  let img1: InstanceType<typeof PNG>;
  let img2: InstanceType<typeof PNG>;

  try {
    [img1, img2] = await Promise.all([
      readPng(image1Path, PNG),
      readPng(image2Path, PNG),
    ]);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Images must be the same size
  if (img1.width !== img2.width || img1.height !== img2.height) {
    console.error(
      `Image dimensions do not match:\n` +
        `  ${image1Path}: ${img1.width}x${img1.height}\n` +
        `  ${image2Path}: ${img2.width}x${img2.height}\n\n` +
        `Both images must have the same dimensions for pixel comparison.`
    );
    process.exit(1);
  }

  const { width, height } = img1;
  const diff = new PNG({ width, height });

  const differentPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
    { threshold }
  );

  const totalPixels = width * height;
  const percentDifferent =
    totalPixels > 0
      ? Math.round((differentPixels / totalPixels) * 10000) / 100
      : 0;

  try {
    await writePng(outputPath, diff);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const result: DiffResult = {
    image1: path.resolve(image1Path),
    image2: path.resolve(image2Path),
    output: path.resolve(outputPath),
    width,
    height,
    totalPixels,
    differentPixels,
    percentDifferent,
    threshold,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(
    "Unexpected error:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
