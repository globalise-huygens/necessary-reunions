# Video Thumbnails

This directory contains thumbnail images for the documentation videos.

## Automatic Thumbnails

The VideoPlayer component automatically displays the first frame of each video as a thumbnail using the `preload="metadata"` attribute. No manual thumbnail creation is required for basic functionality.

## Custom Thumbnails (Optional)

If you want to create custom thumbnail images for better visual appeal:

### Using ffmpeg (Recommended)

1. Install ffmpeg:

   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt-get install ffmpeg

   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

2. Generate thumbnails:

   ```bash
   # From project root
   cd public/video

   # Generate thumbnail for a single video (extract frame at 2 seconds)
   ffmpeg -i neru_gavoc.mp4 -ss 00:00:02 -vframes 1 -q:v 2 thumbnails/neru_gavoc.jpg

   # Or batch generate for all videos
   for video in *.mp4; do
     filename=$(basename "$video" .mp4)
     ffmpeg -i "$video" -ss 00:00:02 -vframes 1 -q:v 2 "thumbnails/${filename}.jpg" -y
   done
   ```

### Manual Creation

1. Open each video in a media player
2. Pause at a representative frame (~2 seconds in)
3. Take a screenshot
4. Save as `{video_name}.jpg` in this directory
5. Update VideoPlayer component calls to include `poster` prop:
   ```tsx
   <VideoPlayer
     src="/video/neru_gavoc.mp4"
     poster="/video/thumbnails/neru_gavoc.jpg"
     title="GAVOC Tutorial"
   />
   ```

## Naming Convention

Thumbnails should match their video filenames:

- Video: `neru_gavoc.mp4` → Thumbnail: `neru_gavoc.jpg`
- Video: `neru_recharted_linking.mp4` → Thumbnail: `neru_recharted_linking.jpg`

## Image Specifications

- Format: JPEG
- Aspect Ratio: 16:9 (same as videos)
- Recommended Resolution: 1280×720 or higher
- Quality: 80-90% (balance between file size and visual quality)
