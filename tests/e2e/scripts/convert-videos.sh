#!/usr/bin/env bash
# convert-videos.sh
# Converts all .webm Playwright recordings in the video output directory to .mp4.
# Requires ffmpeg to be installed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIDEO_DIR="${SCRIPT_DIR}/../videos"

if ! command -v ffmpeg &>/dev/null; then
  echo "Error: ffmpeg is not installed. Install it with: sudo apt-get install -y ffmpeg (Linux) or brew install ffmpeg (macOS)." >&2
  exit 1
fi

# Find all .webm files recursively inside the videos directory
mapfile -t WEBM_FILES < <(find "$VIDEO_DIR" -name "*.webm" 2>/dev/null)

if [ "${#WEBM_FILES[@]}" -eq 0 ]; then
  echo "No .webm files found in $VIDEO_DIR – nothing to convert."
  exit 0
fi

echo "Converting ${#WEBM_FILES[@]} video(s) to .mp4..."

for WEBM in "${WEBM_FILES[@]}"; do
  MP4="${WEBM%.webm}.mp4"
  echo "  $WEBM -> $MP4"
  ffmpeg -y -i "$WEBM" -c:v libx264 -crf 23 -preset fast -c:a aac "$MP4" \
    -loglevel error
done

echo "Done. All .mp4 files are in: $VIDEO_DIR"
