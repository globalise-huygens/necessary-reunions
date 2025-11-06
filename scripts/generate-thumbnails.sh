#!/bin/bash
# Generate video thumbnails for documentation

set -e

VIDEO_DIR="public/video"
THUMBNAIL_DIR="public/video/thumbnails"

# Create thumbnail directory if it doesn't exist
mkdir -p "$THUMBNAIL_DIR"

echo "Generating video thumbnails..."

# Loop through all MP4 files
for video in "$VIDEO_DIR"/*.mp4; do
  if [ -f "$video" ]; then
    filename=$(basename "$video" .mp4)
    thumbnail="$THUMBNAIL_DIR/${filename}.jpg"

    # Skip if thumbnail already exists
    if [ -f "$thumbnail" ]; then
      echo "  ✓ Thumbnail exists: $filename.jpg"
      continue
    fi

    echo "  → Generating: $filename.jpg"

    # Extract frame at 2 seconds with good quality
    ffmpeg -i "$video" -ss 00:00:02 -vframes 1 -q:v 2 "$thumbnail" -y 2>/dev/null

    if [ $? -eq 0 ]; then
      echo "  ✓ Created: $filename.jpg"
    else
      echo "  ✗ Failed: $filename.jpg"
    fi
  fi
done

echo ""
echo "Thumbnail generation complete!"
echo "Thumbnails saved to: $THUMBNAIL_DIR"
