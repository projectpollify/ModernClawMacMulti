# binaries/gemma-4-e4b/

Populated by `scripts/fetch-gemma-4-e4b.sh` with the Gemma 4 E4B model weights.

After running the fetch script, this directory should contain:

- `gemma-4-E4B-it-Q4_K_M.gguf` (~5 GB) — the base language model
- `mmproj-gemma-4-E4B-it-BF16.gguf` (~946 MB) — the multimodal projector that gives the model image understanding

Source: <https://huggingface.co/lmstudio-community/gemma-4-E4B-it-GGUF> (same publisher as the file used in development).

Both files are ignored by git (see `.gitignore` in this folder) because they are pinned, fetched artifacts rather than authored source. Only this README and the `.gitignore` are tracked so the bundle.resources glob always matches something.

## How the app finds these at runtime

`setup.rs::resolve_bundled_model_path` checks for the GGUF inside the macOS app bundle at `Contents/Resources/gemma-4-e4b/gemma-4-E4B-it-Q4_K_M.gguf`. The existing `resolve_mmproj_path` then finds the `mmproj-*.gguf` sibling in the same directory automatically. Combined, this means a fresh install works out of the box with no user setup — the engine spawns with the bundled lane on first launch.

Users who configure their own GGUF path in Settings override the bundled default (the user-configured path always wins).

## Updating to a newer Gemma release

1. Watch <https://huggingface.co/lmstudio-community> for new Gemma 4 E4B builds
2. Update the filenames + revision in `scripts/fetch-gemma-4-e4b.sh`
3. Re-run the script
4. Test the app end-to-end before shipping
