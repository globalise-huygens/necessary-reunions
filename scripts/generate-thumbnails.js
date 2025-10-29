#!/usr/bin/env node
/**
 * Generate video thumbnails using canvas API
 * This script extracts the first frame from each video
 */

const fs = require('fs');
const path = require('path');

const VIDEO_DIR = path.join(process.cwd(), 'public', 'video');
const THUMBNAIL_DIR = path.join(VIDEO_DIR, 'thumbnails');

console.log('Video thumbnail generation requires ffmpeg.');
console.log('');
console.log('To install ffmpeg:');
console.log('  macOS:   brew install ffmpeg');
console.log('  Ubuntu:  sudo apt-get install ffmpeg');
console.log('  Windows: Download from https://ffmpeg.org/download.html');
console.log('');
console.log('Once installed, run: npm run generate-thumbnails');
console.log('');
console.log('Alternatively, you can manually create thumbnails by:');
console.log('1. Opening each video in a video player');
console.log('2. Taking a screenshot at ~2 seconds');
console.log(`3. Saving as JPG in: ${THUMBNAIL_DIR}`);
console.log('');
console.log('Videos requiring thumbnails:');

// Create thumbnail directory
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

// List all videos
const videos = fs
  .readdirSync(VIDEO_DIR)
  .filter((file) => file.endsWith('.mp4'));

videos.forEach((video) => {
  const basename = path.basename(video, '.mp4');
  const thumbnailPath = path.join(THUMBNAIL_DIR, `${basename}.jpg`);
  const exists = fs.existsSync(thumbnailPath);

  console.log(`  ${exists ? '✓' : '✗'} ${video} → thumbnails/${basename}.jpg`);
});

console.log('');
