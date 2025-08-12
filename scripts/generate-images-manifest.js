#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const imagesDir = path.join(projectRoot, 'images');
const dataDir = path.join(projectRoot, 'data');
const outFile = path.join(dataDir, 'images.json');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif']);

function isImageFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function main() {
  if (!fs.existsSync(imagesDir)) {
    console.error(`Images directory not found: ${imagesDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const fileNames = fs.readdirSync(imagesDir);
  const imageFiles = fileNames
    .filter((name) => !name.startsWith('.'))
    .filter(isImageFile)
    .sort((a, b) => a.localeCompare(b));

  const imagePaths = imageFiles.map((name) => `images/${name}`);

  fs.writeFileSync(outFile, JSON.stringify(imagePaths, null, 2) + '\n');
  console.log(`Wrote ${imagePaths.length} image paths to ${outFile}`);
}

main();


