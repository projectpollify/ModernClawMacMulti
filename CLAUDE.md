# CLAUDE.md

## Repo Role
This workspace is `ModernClawMacMulti`, the paid macOS desktop edition of ModernClaw.

It is a single shipping product with multi-brain workflows, the direct `llama.cpp` engine, and both Gemma 4 model lanes built in. There is no free / paid split inside this repo — everything ships in one app.

## Product Goal
ModernClawMacMulti should be:
- local-first
- private
- understandable
- stable
- worth paying for once and owning forever
- macOS-native and well-packaged

It should feel like a polished desktop product, not a developer demo and not a subscription trap.

## Product Shape
The product is one macOS app with three complexity modes the user can switch between in Settings:

- **Simplified** — beginner-friendly preset. Fewer concepts on screen, single visible workspace, minimal terminology, Joe Support prominent. This is the default for first-time users.
- **Custom** — the user picks which surfaces and features are visible. Power without overwhelm.
- **Complete** — all features visible, full multi-brain workflow, full memory and knowledge tools.

The three modes are presets over the **same binary**, not separate builds or tiers. There is one purchase, one app, three views into it.

## What Ships In Every Install
- multi-brain workspace with `BrainSelector` and brain-scoped chat, memory, and suggestions
- main workspace + built-in Joe Support
- conversation history
- editable `SOUL.md`, `USER.md`, `MEMORY.md`
- daily logs
- flat knowledge-file ingestion
- Brain view
- Settings (including complexity-mode toggle)
- Direct `llama.cpp` engine, self-managed (spawn, port poll, model switch, teardown)
- Both `gemma4:e2b` (Everyday chat) and `gemma4:e4b` (Advanced help) lanes via `DirectEngineProfile`
- Piper output and Whisper input
- Image attachments and audio note attachments
- Onboarding (adaptive based on user participation, where practical)
- Local tool layer (memory, knowledge, workspace, settings tools)

## Out Of Scope For The One-Time Purchase
These are future **add-on subscription** targets, not v1 install content:

- Curator integration in-app
- Rosie verification surface
- Expert brain packs (customer support, marketing, founder, etc.)
- Premium voice packs
- Karpathy-style self-improvement loop
- Advanced automation / scheduling
- Enterprise / team layers

## Source & Distribution Policy
Middle-path open-source strategy:

- **This repo is the paid proprietary product.** Treat the code as a shipping product codebase — do not assume it is public.
- An older, minimal version of ModernClaw stays public on GitHub as the open-source credibility anchor. That legacy lineage is for trust signaling and community goodwill, not feature parity with this product.
- The paid product is **one-time purchase on macOS**. The version the user buys stays theirs forever — it never expires, never degrades, never holds them hostage.
- The future **optional subscription** covers new add-ons released after purchase. It never gates what they already bought.

## Development Principles
- one product, three modes — never accidentally build a fourth tier or hidden feature gate
- design every feature with a stance on which modes it appears in
- macOS-first; do not let Windows/Linux assumptions leak into the macOS experience
- assume direct `llama.cpp` is the engine — do not regress to Ollama paths in the macOS code
- protect local-first trust — no cloud calls without explicit, visible user choice
- keep the door open for future add-on subscriptions without baking subscription logic into v1
- simplify the user-facing surface, but do not strip the underlying product

## Model Strategy
ModernClawMacMulti supports both Gemma 4 lanes:

- `gemma4:e2b` — Everyday chat lane (faster, simpler, no mmproj, reasoning off)
- `gemma4:e4b` — Advanced help lane (vision via mmproj, reasoning on with budget, local tools)

Exposed in the UI as "Everyday chat" and "Advanced help" rather than raw model identifiers. Switching between them restarts the direct engine with the right runtime profile (`DirectEngineProfile` in `setup.rs`).

## Documentation Rules
Preferred docs:
- `README.md`
- `VISION.md` — the 4-layer ecosystem story
- `MODERNCLAW_MONETIZATION_PLAN.md` — current monetization strategy
- `docs/runbooks/RUNBOOK.md`
- `PROGRESS.md` — active progress log

Avoid:
- planning documents written under the old free-Base / paid-Multi split assumption
- stale implementation notes that don't match the macOS direct-engine reality
- new top-level docs unless they're the right home for the content

## Implementation Strategy
When making changes in this repo:
- optimize for shipping a polished macOS product
- keep the three complexity modes coherent — every visible feature should know which modes it appears in
- assume macOS, direct engine, multi-brain, and both Gemma 4 lanes are all in scope
- call out drift quickly when a change implies a different product identity
- use `workspace` as the consistent term for the local context root
