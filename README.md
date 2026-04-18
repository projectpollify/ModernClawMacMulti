# ModernClaw

ModernClaw is a free, open-source, local-first desktop workspace for building and using durable AI context on your own machine.

The product is intentionally focused:

- one local workspace
- one chat surface
- one editable memory scaffold
- one Brain-guided refinement flow
- one clear model lane centered on `gemma4:e4b`
- one practical local voice pipeline

## What It Includes

- local chat with the direct engine (llama.cpp)
- persistent conversation history
- drag-drop or picker-based image understanding in chat
- editable `SOUL.md`, `USER.md`, and `MEMORY.md`
- daily logs in `memory/YYYY-MM-DD.md`
- flat `knowledge/*.md` prompt-context loading
- Brain suggestions and guided setup
- setup-readiness checks with required vs optional items
- curator review for staged knowledge packages
- local voice output through Piper
- local voice input through Whisper
- audio-note attachments with Whisper transcription
- built-in Joe Support for setup, troubleshooting, and product guidance
- onboarding, settings, and storage visibility

## Product Shape

ModernClaw is meant to be useful on its own.

It keeps the core ModernClaw identity:

- local-first
- durable Markdown context files
- grounded knowledge files
- one clear setup story
- practical chat plus memory workflows
- approachable setup and settings

## Repository Layout

- `local-ai/`: Tauri app source
- `.github/`: workflows, issue templates, and PR template
- `docs/product/`: product overview, progress, split plan, and future implementation plans
- `docs/runbooks/`: bring-up, validation, and operating notes
- `docs/automation/`: Curator and external automation specs
- `docs/verification/`: Rosie verification materials
- `docs/research/`: source summaries and comparison material

## Contributing

If you want to contribute or set up the project as a developer, start here:

- [CONTRIBUTING.md](CONTRIBUTING.md): development setup, validation steps, and PR expectations
- [SUPPORT.md](SUPPORT.md): setup help and where to file different kinds of issues
- [SECURITY.md](SECURITY.md): how to report vulnerabilities responsibly
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): collaboration standards for the project
- [docs/runbooks/RUNBOOK.md](docs/runbooks/RUNBOOK.md): bring-up and clean-machine validation
- [docs/product/PROGRESS.md](docs/product/PROGRESS.md): current execution focus and open questions
- [VISION.md](VISION.md): product vision, ecosystem layers, and long-term pipeline
- [docs/product/LOCAL_AGENT_TOOL_LAYER.md](docs/product/LOCAL_AGENT_TOOL_LAYER.md): implementation guide for tool-enabled local agents

## Technology Stack

- Tauri
- React
- TypeScript
- Rust
- SQLite
- llama.cpp (direct engine)
- Piper
- Whisper

## Local Data Model

Runtime workspace files live under the LocalAI app-data root and include:

- `SOUL.md`
- `USER.md`
- `MEMORY.md`
- `memory/`
- `knowledge/`
- `curator/`
- `attachments/`
- `tools/`

Important current detail:

- the base app now treats `Main Workspace` and built-in `Joe Support` as shared-workspace profiles rather than separate user-managed brains
- memory, knowledge, curator, attachments, and tools all stay rooted in the same local workspace path
- external automation that prepares curator packages should target the main LocalAI workspace root

The backend still carries profile-aware compatibility structure, but the base runtime now treats it as one user workspace plus built-in Joe Support rather than generic hidden multi-brain behavior.

## Requirements

To run the app locally you currently need:

- Node.js
- Rust toolchain
- llama.cpp (`llama-server`) installed and running
- a supported GGUF model available on disk

For voice features you also need:

- Piper installed or placed in the expected machine-level path
- Whisper installed or placed in the expected machine-level path
- required Piper voice files
- required Whisper model files

## Fresh Install

This is the intended clean-machine path for the current repo on Windows.

### 1. Install Base Dependencies

Install these first:

- Node.js
- Rust toolchain via `rustup`

Then install llama.cpp:

- install via Homebrew on Mac: `brew install llama.cpp`
- or build from source at [github.com/ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)

Important current scope:

- Windows is the validated platform today
- voice features are optional and can be skipped during first install
- Piper and Whisper are still manual setup on a clean machine

### 2. Clone The Repo

```powershell
git clone https://github.com/projectpollify/ModernClaw.git
cd "C:\path\to\ModernClaw\local-ai"
```

### 3. Install App Dependencies

```powershell
npm install
```

### 4. Launch The App

```powershell
npm run tauri:dev
```

### 5. Follow The In-App Setup Flow

After the app opens, use onboarding or the `Setup` page and follow the required steps in this order:

1. Get the direct engine (`llama-server`) running with a supported GGUF model.
2. Confirm the recommended model (`gemma4:e4b`) is available through the engine.
3. Confirm the workspace files are initialized.

Current in-app helpers:

- `Start Engine` tries to launch the local engine service
- `Confirm Gemma 4 In Engine` checks that the recommended model is available
- `Initialize Workspace` creates `SOUL.md`, `USER.md`, and `MEMORY.md`

### 6. Confirm Core Setup Is Ready

Core setup is ready when:

- the direct engine shows as running
- at least one local model is installed
- workspace files are ready

Voice input and output can stay optional for the first pass.

## Setup And Multimodal Status

Current setup behavior:

- onboarding ends with a shared setup checklist
- the sidebar includes a dedicated `Setup` surface
- chat shows an attention banner when required setup is incomplete
- required setup covers the direct engine, installed model availability, and workspace files
- setup surfaces now highlight the single next required action for the machine
- voice input and output are treated as optional features

Current multimodal behavior:

- chat accepts image and audio attachments through drag-drop or the file picker
- chat can record microphone audio notes, transcribe them with Whisper, and attach the saved `.wav` file to the message
- image and audio attachments are copied into the active workspace under `attachments/`
- audio-note transcripts are added to the user message content before the model request is built
- conversation history stores attachment metadata and file paths rather than binary blobs
- the engine request only base64-encodes images at send time

## Development

```powershell
cd "C:\path\to\ModernClaw\local-ai"
npm install
npm run tauri:dev
```

## Build Commands

```powershell
cd "C:\path\to\ModernClaw\local-ai"
npm run build
npm run tauri:build
```

## Current Limits

- Windows is the validated platform today
- llama.cpp (`llama-server`) remains an external dependency for now, with bundling planned
- Piper and Whisper dependency delivery is still manual on a clean machine
- knowledge files are loaded directly rather than selectively retrieved
- daily logs are user-written notes, not automatic summaries
- audio-note prompts currently reach the model through transcript text rather than direct audio understanding

## Direction

The current priority is to keep ModernClaw simple, stable, and trustworthy.

That means:

- polishing the single-workspace experience
- keeping Joe Support built in without turning base back into generic multi-brain management
- making setup easier to understand on a clean machine
- improving multimodal support in small, legible slices, including the new audio-note path
- keeping documentation disciplined before adding more surface area
