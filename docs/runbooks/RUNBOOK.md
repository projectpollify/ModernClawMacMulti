# RUNBOOK

## Purpose

This runbook records the bring-up, recovery, and verification steps for the direct-engine Mac build of ModernClawMac.

## Validated Setup

Current known-good setup on April 14, 2026:

- App runtime: `ModernClawMac`
- Model runtime: direct `llama.cpp`
- Local API endpoint: `http://127.0.0.1:8080/v1`
- Validated chat models:
  - `google/gemma-4-e4b`
  - `google/gemma-4-e2b`
- Offline test status: validated after model files were already present on disk

Important rule:

- Do not rely on external model-runner apps for this repo's Mac path

## Daily Bring-Up

1. Make sure `llama-server` is installed.
2. Make sure a supported Gemma 4 GGUF model exists on disk.
3. Start the direct engine on port `8080`.
4. Start `ModernClawMac` in Tauri dev mode.
5. Use onboarding or `Setup` to confirm the direct engine is detected and the workspace files are ready.
6. Open chat once the required setup summary is fully ready.

## Commands

```bash
cd /Users/shawn/Desktop/modernclawDirectEnginMac/local-ai
curl http://127.0.0.1:8080/v1/models
npm run tauri:dev
```

Expected model-list response should include one of:

```json
{
  "data": [
    {
      "id": "google/gemma-4-e4b"
    }
  ]
}
```

or

```json
{
  "data": [
    {
      "id": "google/gemma-4-e2b"
    }
  ]
}
```

## Recovery Steps

If the direct engine is not up:

1. Confirm `llama-server` is installed:

```bash
which llama-server
```

2. Confirm the configured GGUF model path exists.
3. Start the engine again from the app `Setup` page or by relaunching the app after fixing the model path.

If no chat model is available yet:

1. Confirm a supported GGUF exists on disk.
2. Confirm the app can see one of:
   - `google/gemma-4-e4b`
   - `google/gemma-4-e2b`
3. Re-run:

```bash
curl http://127.0.0.1:8080/v1/models
```

If `ModernClawMac` still does not detect the engine:

1. Confirm the engine is on port `8080`.
2. Confirm `curl http://127.0.0.1:8080/v1/models` returns JSON.
3. Restart `npm run tauri:dev`.

## Failure Signals

- `curl http://127.0.0.1:8080/v1/models` cannot connect
- no Gemma 4 model appears in the `/v1/models` response
- `ModernClawMac` opens but shows `Direct Engine Offline`
- chat opens but returns a provider connection error

## Notes

- This repo's validated Mac path is direct `llama.cpp`.
- The app now supports switching between `google/gemma-4-e4b` and `google/gemma-4-e2b` from inside the model picker.
- Offline chat works after the required GGUF files are already present on disk.
- Existing GGUF files from older local model folders can still be reused as local model files in this repo.

## Fresh Install Flow

1. Install Node.js.
2. Install the Rust toolchain with `rustup`.
3. Install `llama.cpp`.
4. Clone the repo.
5. Run `npm install` in `local-ai`.
6. Make sure a supported Gemma 4 GGUF file is available locally.
7. Run `npm run tauri:dev`.
8. In onboarding or `Setup`, confirm the direct engine is detected.
9. Confirm the workspace files are initialized.
10. Open chat once the required setup summary is fully ready.

## Clean-Machine Validation

Use this exact validation flow when testing install readiness from the repo.

### Test Goal

A tester should be able to clone the repo, follow the docs, and reach normal chat use without hidden setup knowledge.

### Validation Steps

1. Start from a clean Mac.
2. Install Node.js and Rust only.
3. Install `llama.cpp`.
4. Clone the repo into a fresh folder.
5. Run `npm install`.
6. Make sure a supported Gemma 4 GGUF file exists on disk.
7. Run `npm run tauri:dev`.
8. Let onboarding guide the machine through setup.
9. Confirm `SOUL.md`, `USER.md`, and `MEMORY.md` are created.
10. Reach the chat screen and send a normal text prompt.
11. Switch between `google/gemma-4-e4b` and `google/gemma-4-e2b` and confirm the engine comes back online.
12. Optional verification: disable Wi-Fi and confirm chat still works with the already-downloaded model.

### Pass Criteria

- the tester does not need extra verbal guidance beyond repo docs
- the app makes the next required step obvious
- direct-engine startup is obvious and recoverable
- the model list from `http://127.0.0.1:8080/v1/models` matches what the app sees
- workspace initialization completes without manual file creation
- chat works after required setup is green
- switching between `e4b` and `e2b` is obvious and reliable
