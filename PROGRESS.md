# ModernClawMacMulti Progress

## Mission

Turn this project into the Mac multi-brain edition of ModernClaw with the direct `llama.cpp` engine as the local model runtime.

Target shape:

- macOS-first product
- direct local engine through `llama.cpp`
- multi-brain / multi-agent workflow
- same private workspace and memory foundations

## Current Status

This project started as a copy of the current direct-engine `ModernClawMac` app.

What is already true:

- direct `llama.cpp` engine work is already present
- the Mac setup flow already targets port `8080`
- model switching between Gemma 4 E4B and E2B already works
- the codebase already has some multi foundations:
  - `agents`
  - `brain` view
  - multi-brain DB migration
  - agent-aware conversations and memory routing
- the Windows `ModernClawMulti` repo has now been cloned locally and compared
- the first multi-brain merge slices are already ported and verified:
  - agent CRUD and active-brain switching
  - `BrainSelector` in the header
  - brain-scoped suggestion state
  - brain-aware conversation reload/reset behavior
  - brain-aware Brain view and memory surfaces
  - brain-aware chat empty state

What is not yet true:

- this repo is not yet confirmed to match the full Windows `ModernClawMulti` feature set
- the current repo still needs a deliberate multi-brain parity pass
- the remaining work is now about selective parity completion, not initial discovery

## Locked Decisions

- `ModernClawMacMulti` starts from the working Mac direct-engine base
- we are not starting from the Windows multi repo and then trying to Mac-convert it
- direct engine stays the platform/runtime foundation while multi-brain features are layered on top

## Existing Foundations Found Locally

Already present in this repo:

- agent repository and agent commands
- active-agent workspace resolution
- multi-brain migration SQL foundation
- brain workflow UI and suggestion store
- agent-aware conversations and message feedback summaries

This is good news because it means `ModernClawMacMulti` is not starting from zero.

## Initial Audit Summary

The first repo comparison against `ModernClawMulti` is done.

What that comparison showed:

- `ModernClawMacMulti` already contains real multi-oriented foundations
- the Windows multi repo still differs across many frontend and backend files
- the Mac repo also contains newer direct-engine work that does not exist in the Windows multi repo

High-signal differences found:

- Mac-only direct-engine additions already present here:
  - `llama_cpp.rs`
  - provider abstraction
  - setup commands for engine startup and engine model switching
  - direct-engine settings and setup copy
  - model metrics and newer chat UX polish
- Windows multi-oriented surfaces that need a closer parity check:
  - `BrainSelector.tsx`
  - `App.tsx`
  - `Sidebar.tsx`
  - `ConversationList.tsx`
  - `agents.ts`, `agentStore.ts`
  - `suggestionStore.ts`
  - `types/index.ts`, `types/database.ts`
  - several Rust command/repo/type files

Important conclusion:

- this should be treated as a merge project
- not a straight copy from Windows multi
- not a straight copy from Mac single-brain

The right job is:

- preserve the Mac direct-engine platform layer
- selectively port the missing multi-brain behavior from the Windows multi repo

## Migration Plan

### Phase 1: Re-baseline This Repo

- confirm the direct-engine Mac base is stable
- rename planning/docs so they reflect `ModernClawMacMulti`
- identify exactly which multi-brain surfaces already exist

### Phase 2: Audit Windows Multi Source

- locate the real `ModernClawMulti` repo
- compare its backend, stores, migrations, and UI with this MacMulti repo
- produce a gap list:
  - already here
  - missing here
  - Windows-specific code that should not be copied

Status: complete

### Phase 3: Port Missing Multi Features

- backend data/repo/command changes first
- frontend stores and state second
- visible UI and workflows third
- keep direct engine untouched while porting

Status: in progress

Completed slices:

- agent listing, create/delete, and active-agent switching
- `BrainSelector` UI and header integration
- brain-scoped suggestion store state
- app-level brain switch synchronization
- conversation list brain awareness
- Brain view brain awareness and local-state reset on brain switch
- Curator inbox brain awareness
- memory workspace brain awareness
- daily logs brain awareness
- chat empty-state brain awareness

### Phase 4: MacMulti Verification

- verify onboarding and setup
- verify direct-engine model switching
- verify brain workflows
- verify agent-aware chat and memory behavior

Current verification status:

- `cargo check` passes
- `npm run build` passes
- live app verification for the new multi-brain flows is still pending

## Immediate Next Steps

1. Keep this repo as the working `ModernClawMacMulti` folder.
2. Continue the parity pass against the local Windows `ModernClawMulti` source repo.
3. Focus next on the remaining multi-specific surfaces that are not intentional direct-engine/Mac differences.
4. Live-test the merged multi-brain flows in the app:
   - switching brains
   - creating/deleting brains
   - brain-specific chat history
   - brain-specific memory and curator surfaces
5. Port only the missing multi-brain features into this Mac direct-engine base.

## Session Log — 2026-06-02: Lifecycle & Data-Integrity Hardening

A debugging session that started with "the app won't close cleanly / shows
engine offline / chat won't save" and traced each symptom to a concrete root
cause. All fixes below are committed and pushed (`a15e9f0`).

### Engine lifecycle (open + close)

- **Kill the engine on quit.** The bundled `llama-server` is spawned with
  `std::process::Command::spawn()`, so it survives the app unless explicitly
  killed. Event logging proved that the macOS quit path
  (`NSApplication.terminate()` — menu Quit / ⌘Q / tray Quit) fires
  `RunEvent::Exit` but skips both `ExitRequested` and `WindowEvent::Destroyed`.
  Matching `RunEvent::Exit` in the run closure is the fix; verified live (engine
  PID went dead on Quit). `WindowEvent::Destroyed` remains as an idempotent
  backstop, `CloseRequested` still hides to tray.
- **Reclaim orphaned engines on startup.** If a previous session left a
  `llama-server` running, startup now adopts its PID instead of ignoring it, so
  the next clean exit can reap it (self-healing for crash/force-quit paths).
- **Re-fetch models after cold start.** The setup checklist could record an
  empty model list while the engine was still cold-starting and never refresh.
  `useSetupStatus` now refetches once when the engine transitions to running
  with an empty list, so "Model Installed" stops being stuck and chat unblocks.

### The big one: one bad timestamp bricked the whole app

- **Symptom:** "Loading brains..." stuck forever, "Direct Engine Offline" even
  when the engine was up, setup "1/3 ready", and previous conversations not
  reappearing on relaunch.
- **Root cause:** a single agent row (`survivor-bob`) had `updated_at` stored as
  `2026-06-01 22:52:47` (SQLite-style, no `T`, no timezone). The repos parsed
  timestamps with strict `DateTime::parse_from_rfc3339`, so that one row made
  `agent_list` return `Err`. In the frontend `loadAgents`,
  `Promise.all([listAgents, getActiveAgent])` then rejected, leaving
  `agents: []` / `activeAgent: null`. The `App.tsx` startup gate
  (`if (!hasLoadedSettings || !hasLoadedAgents || !activeAgentId) return`) never
  opened — which is what also blocked conversation restore, model setup, and the
  engine status refresh. Chat was always being **saved** correctly; it just
  could never be **displayed** because the gate stayed shut.
- **Immediate fix:** repaired the one malformed value in the DB (RFC3339).
  Verified by the user: app opened cleanly, brains loaded, history restored.
- **Durable fix:** `agent_repo`, `conversation_repo`, and `message_repo` now
  parse timestamps tolerantly (RFC3339 + SQLite-style naive datetimes) and fall
  back to the Unix epoch rather than failing the query. One bad row can never
  brick the app again. (Ships in the next build; the running app was unblocked
  by the data repair.)

### Duplicate app icons (dev-machine hygiene)

- **Root cause:** every `tauri build` mounts a temporary `rw.*` scratch DMG and
  sometimes leaves it mounted, and it also leaves real `ModernClawMac.app`
  bundles in `target/{debug,release}/bundle/macos/` that Spotlight indexes and
  Launchpad surfaces alongside the real `/Applications` copy.
- **Fix:** ejected the leftover volumes, removed the build-folder bundles, and
  added `local-ai/src-tauri/target/.metadata_never_index` so Spotlight never
  indexes build output again — the ghost won't return after future builds. This
  is a developer-environment issue; a paying user (who never runs `tauri build`)
  is not exposed to this mechanism.

### Still open / deferred

- Restore the `directEngineModelPath` DB setting (currently
  `directEngineModelPath_backup`) for dev-mode model switching.
- Rebuild + ship a `/Applications` build that includes the durable timestamp
  fix (the data repair already unblocked the running app).

## Working Rule

This file is the source of truth for the `ModernClawMacMulti` migration.
