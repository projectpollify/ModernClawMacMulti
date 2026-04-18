# Local Agent Tool Layer — Implementation Guide

**Project:** ModernClaw  
**Last updated:** 2026-04-16  
**Purpose:** Reference document for wiring local model agents to machine functions, browser control, and system capabilities. Ordered from easiest to most challenging.

---

## Context

Gemma 4 and similar local models already have the reasoning capability to understand instructions like "open a browser," "create a file," or "search for X." The gap is not intelligence — it is connection. The model has no hands. This document defines how to give it hands, from simplest to most complex.

The key insight: **you do not need to train the model to do this.** Training is rarely the bottleneck. Wiring is.

---

## Level 1 — Function Calling / Structured Tool Use
**Difficulty: Easy**  
**Training required: None**

### What it is
You define a set of tools in a structured schema. The model outputs a structured function call. Your app intercepts that call, executes it, and returns the result to the model.

### How it works in ModernClaw
The Rust backend already handles Tauri commands. You extend this pattern:

1. Define available tools in a JSON schema passed to the model as part of the system prompt or context
2. Model outputs a structured response like `{ "tool": "open_browser", "args": { "url": "https://..." } }`
3. The Tauri backend parses the response, executes the action, returns the result
4. Model receives the result and continues reasoning

### Example tools at this level
- Open a URL in the default browser
- Read a file from the workspace
- Write or append to a file
- Search knowledge files for a term
- Get the current date and time
- List files in a directory

### Why it works
llama.cpp supports function calling natively. Gemma 4 can follow structured output instructions reliably when the schema is clear and the instructions are explicit.

### Guardrails needed
- Whitelist of allowed tools — model cannot call anything not on the list
- Confirmation step for write/delete operations before execution

---

## Level 2 — Shell Command Execution
**Difficulty: Low–Medium**  
**Training required: None**

### What it is
The model generates shell commands. Your backend executes them in a sandboxed or restricted environment and returns the output.

### How it works
1. Model outputs a shell command string
2. Rust backend runs it via `std::process::Command`
3. stdout/stderr returned to the model as context
4. Model interprets the output and continues

### Example capabilities at this level
- Launch applications (`open -a "Notes"` on Mac)
- Run scripts
- Check system status (`df -h`, `ps aux`)
- Move, copy, rename files
- Run local utilities (Whisper transcription, Piper TTS, etc.)

### Risks and mitigations
This level carries real risk. A hallucinated or malicious command can cause irreversible damage.

**Required mitigations:**
- Command allowlist — only pre-approved command patterns execute
- No destructive commands (`rm -rf`, `format`, etc.) without explicit multi-step confirmation
- Dry-run mode — show the command to the user before executing
- Sandboxed working directory — model cannot navigate above a defined root

---

## Level 3 — Browser Automation
**Difficulty: Medium**  
**Training required: None (structured) / Light fine-tuning (reliability)**

### What it is
The model controls a browser — navigating, clicking, reading page content, filling forms.

### Implementation options

**Option A: Headless browser via CLI (simpler)**  
Use Playwright or Puppeteer invoked as a subprocess. Model generates navigation instructions, backend executes them, returns page content or screenshots.

**Option B: Claude in Chrome MCP (already available)**  
You already have Claude in Chrome tools in this Cowork environment. This is the fastest path — no additional implementation needed for Cowork-based agents.

**Option C: Native browser control in the app**  
Use Tauri's webview capabilities or embed a controlled browser context directly in the app. More complex but fully local.

### Example capabilities at this level
- Search the web and return results
- Fill out forms
- Extract structured data from web pages
- Navigate multi-step web workflows
- Screenshot a page for visual context

### Key challenge
Web pages are noisy. Returning a full HTML page to a local model wastes context. You need a content extraction step — strip to text, identify relevant sections — before feeding results back to the model.

---

## Level 4 — OS-Level System Control
**Difficulty: Medium–High**  
**Training required: None (basic) / Fine-tuning recommended (complex workflows)**

### What it is
The model can interact with operating system functions beyond simple file and shell operations — system settings, notifications, clipboard, calendar, contacts, scheduled tasks, and so on.

### Platform-specific approaches

**macOS:**
- AppleScript / JXA (JavaScript for Automation) — wide system access
- macOS Shortcuts — can be triggered from command line
- `osascript` called from Rust backend

**Windows:**
- PowerShell automation
- COM object access
- Windows Task Scheduler via CLI

### Example capabilities at this level
- Set a reminder or calendar event
- Send a system notification
- Read/write clipboard
- Control system volume or display settings
- Trigger scheduled tasks
- Query system information (battery, network, running processes)

### Why fine-tuning helps here
The surface area is large and the command syntax is platform-specific. A small fine-tuning dataset of (instruction → correct osascript/PowerShell command) pairs improves reliability significantly at this level. A few hundred examples is enough.

---

## Level 5 — Multi-Step Agentic Workflows
**Difficulty: High**  
**Training required: Fine-tuning recommended**

### What it is
The model doesn't just execute a single tool call — it plans and executes a sequence of actions across multiple tools to complete a goal. It observes results at each step and adjusts.

### Example workflows at this level
- "Research this topic, summarize what you find, save it to the knowledge folder, and tell me when it's ready"
- "Check if my calendar is free tomorrow at 2pm, create a reminder, and draft a prep note"
- "Find all PDFs in my Downloads folder modified this week, extract the key points, and add them to the Curator queue"

### What makes this hard
- **State management** — the model needs to track what it has done and what is left
- **Error recovery** — what happens when a tool call fails mid-workflow
- **Loop prevention** — the model can get stuck in retry loops
- **Context length** — long tool chains consume context fast

### Implementation approach
1. Use a ReAct-style loop: Reason → Act → Observe → Reason...
2. Maintain a workflow state object that persists across turns
3. Set a max-step limit to prevent runaway execution
4. Surface intermediate steps to the user so they can intervene
5. Fine-tune on examples of successful multi-step completions for your specific tool set

---

## Level 6 — Fine-Tuning for Domain-Specific Tool Use
**Difficulty: High**  
**Training required: Yes**

### What it is
You train Gemma 4 on a custom dataset of (instruction → tool call sequence → result) examples specific to your tool set and use cases. This is not training from scratch — it is lightweight fine-tuning (LoRA / QLoRA) on top of the existing model.

### When you need this
- Your tool set is unusual enough that the base model doesn't reliably understand it
- You need consistent behavior across a very specific workflow domain
- You are building an enterprise agent brain where reliability is critical

### What you need
- A dataset of 500–5000 high-quality examples
- A machine with enough VRAM (or use a cloud training run once, then deploy locally)
- LoRA adapter training — the base model weights don't change, only a small adapter layer
- The adapter is loaded at runtime alongside the base model

### Hardware reality for Gemma 4B
- Fine-tuning on a Mac M-series chip is feasible with QLoRA
- Inference of the fine-tuned model runs the same as the base model
- The adapter file is small — easily bundled with an agent blueprint

---

## Level 7 — Persistent Learning and Self-Improvement
**Difficulty: Very High**  
**Training required: Yes — ongoing**

### What it is
The model improves from its own usage over time. Successful interactions become training examples. The agent gets better the more it is used without the user having to do anything manually.

### The Karpathy self-improvement loop
1. Agent completes a task
2. Outcome is evaluated (user feedback, automated scoring, or both)
3. High-quality completions are added to a training buffer
4. Periodically, a new fine-tuning run produces an improved adapter
5. Updated adapter is deployed — the agent is now better at that class of task

### What makes this very hard
- **Evaluation is the bottleneck** — you need a reliable way to score whether an outcome was good
- **Data quality** — bad examples in the training buffer make the model worse, not better
- **Distribution shift** — a model trained on its own outputs can drift toward confident but wrong behavior
- **Safety** — a self-improving model that receives poor feedback signals can degrade in unpredictable ways

### Role of Rosie here
Rosie is not just a knowledge quality gate — she is also the evaluation layer for the self-improvement loop. Before any interaction becomes a training example, Rosie verifies it was appropriate, accurate, and aligned with intent. This is why Rosie is foundational to safe self-improvement.

### Realistic timeline
This is the last layer to build, not the first. Everything below it needs to be stable before self-improvement is safe to run.

---

## Implementation Priority for ModernClaw

| Level | Capability | Status |
|---|---|---|
| 1 | Function calling / structured tool use | Ready to implement |
| 2 | Shell command execution | Ready to implement (with guardrails) |
| 3 | Browser automation | Available via Cowork (Claude in Chrome) |
| 4 | OS-level system control | Design phase |
| 5 | Multi-step agentic workflows | Design phase |
| 6 | Domain-specific fine-tuning | Planned (post-installer) |
| 7 | Self-improvement loop | Planned (requires Rosie first) |

---

## The Safety Principle

Every level of capability added is also a level of risk added. The guardrail design is not optional — it is load-bearing. Rosie's role expands at each level:

- Levels 1–2: Rosie verifies knowledge packages
- Levels 3–4: Rosie approves system actions before execution
- Levels 5–6: Rosie evaluates workflow outcomes
- Level 7: Rosie gates what becomes training data

Do not implement a new level without first extending the safety layer to cover it.

---

*Related documents: VISION.md, docs/product/OVERVIEW.md*
