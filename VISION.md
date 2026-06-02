# ModernClaw — Product Vision & Pipeline Architecture

**Last updated:** 2026-04-16

---

## What This Is

ModernClaw is a local-first AI desktop workspace. The user owns their data, their model, and their context. Nothing lives in the cloud unless they choose it. The app runs entirely on their machine.

This document captures the full product vision — not just the app, but the complete ecosystem being built around it.

---

## The Four Layers

### 1. ModernClaw — The Workspace

The core desktop app. Built with Tauri (Rust + React). macOS-first; Windows is a possible future platform, not part of the launch product.

**What it does:**
- Local chat powered by a direct engine (llama.cpp / llama-server)
- Persistent conversation history stored in SQLite
- Editable memory scaffold: `SOUL.md`, `USER.md`, `MEMORY.md`
- Daily logs in `memory/YYYY-MM-DD.md`
- Flat knowledge files in `knowledge/` that feed directly into prompt context
- Curator package review — user can import or reject staged knowledge packages
- Brain view for guided refinement
- Local voice I/O via Piper (output) and Whisper (input)
- Built-in Joe Support assistant for setup and troubleshooting
- One clear model lane: `gemma4:e4b`

**What makes it different:**
- No Ollama dependency. Runs its own direct engine (llama.cpp).
- No cloud. No subscriptions for core function.
- The workspace is a living context system — not just a chat window.
- Built to be bundled. Mac and Windows installers are in final development.

**Current status:** Near-final. Mac and Windows installers in progress.

---

### 2. The Curator — The Knowledge Pipeline

A Claude Cowork agent running on the same machine as the app.

**What it does:**
- User requests a topic, dataset, or agent brain
- Curator finds, assembles, and packages the knowledge
- Drops the finished package into the workspace `curator/` folder
- ModernClaw surfaces it for review and import

**Use cases:**
- Personal: "Give me a dataset on stoic philosophy" → packaged knowledge ready to import
- Enterprise: "Build a customer service agent brain for Brand X" → full agent package including workflows, tone, domain knowledge, escalation logic, and industry-specific context
- Agency: Design and deliver purpose-built expert agent brains for specific industries or clients

**Current status:** Exists as a Cowork agent. Pipeline to ModernClaw is functional. Rosie (verification layer) not yet built.

---

### 3. Rosie — The Quality Gate *(Not Yet Built)*

A verification agent that sits between the Curator and the user.

**What she does:**
- Receives what was requested and what the Curator produced
- Compares the two — did the Curator actually find what was asked for?
- Assesses appropriateness and accuracy of the package
- Either approves it for delivery or flags it for correction
- Passes approved packages to the user for final sign-off

**Why she matters:**
- At scale — especially for enterprise agent brain delivery — a human can't review every package in detail
- Rosie catches mismatches, irrelevant content, or low-quality packages before they reach the workspace
- She's the trust layer that makes automated delivery safe

**What she needs to work:**
- The Curator's packages must carry the original request as metadata (the `request_topic` field in `CuratorPackage` already supports this)
- A way to compare intent vs. content — likely semantic comparison
- A clear pass/fail/flag output that feeds back into the pipeline

**Current status:** Planned. Not yet implemented. No codebase yet.

---

### 4. Karpathy-Style Self-Improvement *(Planned)*

An automated learning and improvement loop for the model and its context.

**What this means:**
- The model learns from its own usage patterns over time
- The workspace context (SOUL, USER, MEMORY, knowledge files) can be automatically refined based on what's working and what isn't
- Self-improvement can be triggered automatically or on demand
- The system gets better the more it's used — without the user having to manually curate everything

**Why this matters:**
- Most AI tools are static — you get what you deploy
- This layer makes ModernClaw a genuinely evolving system
- For enterprise use, this means agent brains that improve with deployment rather than degrading

**Current status:** Planned. Informed by Andrej Karpathy's work on model self-improvement. Not yet implemented.

---

## The Full Pipeline (When Complete)

```
User Request
     ↓
  Curator
(finds & packages knowledge)
     ↓
   Rosie
(verifies: request vs. result, appropriateness check)
     ↓
User Approval
(final sign-off before anything touches the workspace)
     ↓
ModernClaw Workspace
(curator/ folder → import → live knowledge context)
     ↓
Self-Improvement Loop
(Karpathy-style — automated refinement over time)
```

---

## Tiering

**Paid Product (One-Time Purchase, You Own It):**
- ModernClawMacMulti — the full macOS desktop app
- Multi-brain workspace with three complexity modes (Simplified / Custom / Complete)
- Direct llama.cpp engine, self-managed
- Both Gemma 4 lanes (Everyday chat + Advanced help)
- Local workspace, memory, chat, voice (Piper + Whisper)
- Image and audio attachments
- Joe Support built in
- Local tool layer

**Optional Subscription (Ongoing Add-On Stream):**
- Curator integration in-app
- Rosie verification layer
- Expert brain packs (customer support, marketing, founder, etc.)
- Premium voice packs
- Karpathy self-improvement loop
- Advanced automation and scheduling
- Enterprise / team layers (future)

The version a user buys stays theirs forever. The subscription is for new content released after their purchase — never to keep the original app working.

**Legacy Open-Source Anchor:**
- An older minimal version of ModernClaw remains public on GitHub as the credibility signal for the local-first, privacy-respecting ethos
- Not feature-parity with the paid product; it is a trust anchor, not a competitor to the paid app

---

## Technical Foundation

| Layer | Tech |
|---|---|
| Desktop app | Tauri (Rust + React + TypeScript) |
| Local database | SQLite |
| Direct engine | llama.cpp (llama-server) |
| Model | gemma4:e4b |
| Voice output | Piper |
| Voice input | Whisper |
| Agent orchestration | Claude Cowork |
| Knowledge packaging | Curator (Cowork agent) |
| Verification | Rosie (planned) |
| Self-improvement | Karpathy-style loop (planned) |

---

## Where We Are Now

- ModernClawMacMulti macOS installer is in final development
- Engine naming has been cleaned up — Ollama references removed, direct engine naming consistent throughout
- The Curator is operational as a Cowork agent
- Rosie does not yet exist
- Self-improvement loop is planned but not started
- Cowork integration into the full pipeline is the next major milestone

---

## Next Milestones

1. Ship the macOS installer
2. Cowork joins the pipeline formally
3. Design and build Rosie
4. Wire Rosie into the Curator → User approval flow
5. Begin Karpathy self-improvement research and implementation
