# binaries/

This folder holds **bundled external binaries and libraries** that ship with the ModernClawMacMulti app.

Right now it contains a single subfolder, `llama-cpp/`, which holds an unpacked `ggml-org/llama.cpp` release — the local inference engine the app spawns at runtime.

## Layout

```
binaries/
└── llama-cpp/         ← unpacked llama.cpp release (binary + dylibs together)
    ├── llama-server
    ├── libllama.dylib
    ├── libggml.dylib
    ├── libggml-metal.dylib
    └── … (many more dylibs)
```

The whole `llama-cpp/` folder is shipped because `llama-server` is **not** a self-contained binary — it links against ~30 sibling `.dylib` files via `@rpath` at runtime. Shipping just the executable would not work; the dylibs must travel with it.

## How Tauri ships this

`tauri.conf.json` declares:

```json
"bundle": {
  "resources": {
    "binaries/llama-cpp/*": "llama-cpp/"
  }
}
```

At build time, every file directly under `binaries/llama-cpp/` is copied flat into the app bundle's resource directory under `llama-cpp/`. At runtime, the Rust side resolves the resource directory via `AppHandle.path().resource_dir()` and spawns `llama-server` from `<resource_dir>/llama-cpp/llama-server` — where the dylibs sit alongside it, so `@rpath` resolves correctly.

## How to populate this folder

The contents of `llama-cpp/` are **not committed to git** — see `.gitignore`. Pull a release down with:

```bash
./scripts/fetch-llama-server.sh
```

The script downloads a pinned release from `ggml-org/llama.cpp` on GitHub and extracts it into `binaries/llama-cpp/`.

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
