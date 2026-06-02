#!/usr/bin/env bash
#
# Fetch a pinned llama.cpp release and unpack it into
# src-tauri/binaries/llama-cpp/ so Tauri can bundle llama-server + its dylibs
# as resources at build time.
#
# Usage: ./scripts/fetch-llama-server.sh

set -euo pipefail

# Pinned release. Update this when you want a newer build.
# Find the latest at: https://github.com/ggml-org/llama.cpp/releases
RELEASE_TAG="b9464"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../src-tauri/binaries/llama-cpp"

case "$(uname -s)" in
    Darwin) OS="macos" ;;
    *) echo "Error: this script supports macOS only right now." >&2; exit 1 ;;
esac

case "$(uname -m)" in
    arm64)  ARCH="arm64" ;;
    x86_64) ARCH="x64" ;;
    *) echo "Error: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

ASSET_NAME="llama-${RELEASE_TAG}-bin-${OS}-${ARCH}.tar.gz"
DOWNLOAD_URL="https://github.com/ggml-org/llama.cpp/releases/download/${RELEASE_TAG}/${ASSET_NAME}"
EXTRACTED_SUBDIR="llama-${RELEASE_TAG}"

echo "→ Fetching llama.cpp ${RELEASE_TAG} for ${OS}-${ARCH}"
echo "  ${DOWNLOAD_URL}"

WORK_DIR="$(mktemp -d)"
trap "rm -rf '$WORK_DIR'" EXIT

curl -fL --progress-bar -o "$WORK_DIR/$ASSET_NAME" "$DOWNLOAD_URL"

echo "→ Extracting"
tar -xzf "$WORK_DIR/$ASSET_NAME" -C "$WORK_DIR"

if [ ! -d "$WORK_DIR/$EXTRACTED_SUBDIR" ]; then
    echo "Error: expected $WORK_DIR/$EXTRACTED_SUBDIR after extraction" >&2
    exit 1
fi

echo "→ Installing into $TARGET_DIR"
mkdir -p "$TARGET_DIR"
# Clear any prior release contents but keep tracked files (.gitignore, README.md).
find "$TARGET_DIR" -mindepth 1 \
    -not -name '.gitignore' \
    -not -name 'README.md' \
    -exec rm -rf {} +

cp -R "$WORK_DIR/$EXTRACTED_SUBDIR"/* "$TARGET_DIR/"

# llama.cpp release tarballs sometimes ship with non-executable bits on macOS.
# Make sure llama-server is runnable.
chmod +x "$TARGET_DIR/llama-server" 2>/dev/null || true

echo "✓ Done. llama-server is at $TARGET_DIR/llama-server"
