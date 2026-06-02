# binaries/

This folder holds **bundled external binaries, libraries, and model weights** that ship with the ModernClawMacMulti app.

It currently has two subfolders, both sibling lanes:

- `llama-cpp/` — the unpacked `ggml-org/llama.cpp` release (the inference engine binary + ~30 dylibs)
- `gemma-4-e4b/` — the Gemma 4 E4B model weights and matching mmproj for image understanding

## Layout

```
binaries/
├── llama-cpp/         ← unpacked llama.cpp release (binary + dylibs together)
│   ├── llama-server
│   ├── libllama.dylib
│   ├── libggml.dylib
│   ├── libggml-metal.dylib
│   └── … (many more dylibs)
└── gemma-4-e4b/       ← bundled Gemma 4 model weights
    ├── gemma-4-E4B-it-Q4_K_M.gguf       (~5 GB)
    └── mmproj-gemma-4-E4B-it-BF16.gguf  (~946 MB)
```

The whole `llama-cpp/` folder is shipped because `llama-server` is **not** a self-contained binary — it links against ~30 sibling `.dylib` files via `@rpath` at runtime. Shipping just the executable would not work; the dylibs must travel with it.

The whole `gemma-4-e4b/` folder is shipped because llama-server expects the mmproj file to sit next to the model GGUF (the existing `resolve_mmproj_path` helper in `setup.rs` finds it via sibling lookup).

## How Tauri ships this

`tauri.conf.json` declares:

```json
"bundle": {
  "resources": {
    "binaries/llama-cpp/*": "llama-cpp/",
    "binaries/gemma-4-e4b/*": "gemma-4-e4b/"
  }
}
```

At build time, every file directly under each source folder is copied flat into the app bundle's resource directory under the matching destination name. At runtime, the Rust side resolves the resource directory via `AppHandle.path().resource_dir()` and spawns `llama-server` from `<resource_dir>/llama-cpp/llama-server` with `-m <resource_dir>/gemma-4-e4b/gemma-4-E4B-it-Q4_K_M.gguf`. The dylibs sit alongside the engine binary, so `@rpath` resolves correctly, and the mmproj sits alongside the model, so the multimodal projector loads automatically.

## How to populate these folders

The actual contents of `llama-cpp/` and `gemma-4-e4b/` are **not committed to git** — see each folder's `.gitignore`. Pull them down before any release build with:

```bash
./scripts/fetch-llama-server.sh
./scripts/fetch-gemma-4-e4b.sh
```

The scripts download pinned releases from upstream sources (`ggml-org/llama.cpp` on GitHub and `lmstudio-community/gemma-4-E4B-it-GGUF` on Hugging Face) and extract them into the right places.

## Why not commit the binaries?

- They're large (tens of MB) and would bloat git history
- They're pinned dependencies, not authored work
- Different architectures need different builds
- Fetching at setup time is easier to audit than tracking binary diffs in git

## Updating to a newer llama.cpp release

1. Pick a new release tag from <https://github.com/ggml-org/llama.cpp/releases>
2. Update `RELEASE_TAG` in `scripts/fetch-llama-server.sh`
3. Re-run the script
4. Test the app end-to-end before committing the script change
