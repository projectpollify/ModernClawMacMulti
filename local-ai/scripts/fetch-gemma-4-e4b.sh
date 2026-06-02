#!/usr/bin/env bash
#
# Fetch the Gemma 4 E4B model weights and mmproj for bundling into the
# macOS app. Prefers your local LM Studio cache if present; falls back to
# downloading from Hugging Face if the files are not already on disk.
#
# Usage: ./scripts/fetch-gemma-4-e4b.sh
#
# Total download (if not cached locally): ~6 GB. Allow time.

set -euo pipefail

REPO="lmstudio-community/gemma-4-E4B-it-GGUF"
MODEL_FILE="gemma-4-E4B-it-Q4_K_M.gguf"
MMPROJ_FILE="mmproj-gemma-4-E4B-it-BF16.gguf"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../src-tauri/binaries/gemma-4-e4b"
LMSTUDIO_DIR="$HOME/.lmstudio/models/$REPO"

mkdir -p "$TARGET_DIR"

fetch_one() {
    local FILE="$1"
    local TARGET="$TARGET_DIR/$FILE"

    if [ -f "$TARGET" ]; then
        echo "→ $FILE already present in target, skipping"
        return 0
    fi

    if [ -f "$LMSTUDIO_DIR/$FILE" ]; then
        echo "→ Copying $FILE from local LM Studio cache"
        cp "$LMSTUDIO_DIR/$FILE" "$TARGET"
        echo "  $(du -h "$TARGET" | cut -f1) copied"
        return 0
    fi

    local URL="https://huggingface.co/$REPO/resolve/main/$FILE"
    echo "→ Downloading $FILE from Hugging Face"
    echo "  $URL"
    curl -fL --progress-bar -o "$TARGET" "$URL"
}

fetch_one "$MODEL_FILE"
fetch_one "$MMPROJ_FILE"

echo ""
echo "✓ Done. Bundled model files are in $TARGET_DIR:"
ls -lh "$TARGET_DIR/"*.gguf
