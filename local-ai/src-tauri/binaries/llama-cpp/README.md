# binaries/llama-cpp/

Populated by `scripts/fetch-llama-server.sh` with the unpacked `ggml-org/llama.cpp` macOS release.

After running the fetch script, this directory should contain:

- `llama-server` — the inference engine binary the app spawns at runtime
- `libllama.dylib`, `libggml*.dylib`, `libmtmd*.dylib`, and ~30 other dylibs the binary links against via `@rpath`

All of those files are ignored by git (see `.gitignore` in this folder) because they are pinned, fetched artifacts rather than authored source. Only this README and the `.gitignore` are tracked.

The whole folder is shipped into the macOS app bundle as a Tauri resource — see `binaries/README.md` for the bundling design.
