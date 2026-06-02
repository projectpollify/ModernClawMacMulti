# ModernClaw Monetization Plan

## Purpose

This document is the current monetization strategy for **ModernClawMacMulti** — a single paid macOS desktop product with optional subscription add-ons released after purchase.

This plan replaces the earlier open-core (Base + Multi) strategy. The Base/Multi split is no longer the direction. See `CLAUDE.md` and `VISION.md` for the aligned product identity.

---

## The Big Picture (Read This First)

You have **one app**: ModernClawMacMulti. It is a polished paid macOS desktop product.

- **One-time purchase** — the user buys the app and owns the version they install. It never expires, never degrades, never holds them hostage.
- **Three complexity modes** — Simplified, Custom, Complete. Same binary, different presets matched to the user's experience level.
- **Optional subscription** for ongoing add-ons released after purchase: expert brain packs, voice packs, Curator/Rosie integration, advanced automation.
- **Legacy open-source anchor** — an older minimal version of ModernClaw remains public on GitHub as a credibility signal. The current paid product is proprietary.

The product is not a free demo with a paid unlock. It is a polished paid app. The free message lives in the legacy open-source repo; the commerce message lives here.

---

## What's Included In Every Purchase

Every install of ModernClawMacMulti includes:

- macOS desktop app with multi-brain workspace and `BrainSelector`
- Direct `llama.cpp` engine (self-managed — no Ollama, no separate install)
- Both Gemma 4 model lanes (Everyday chat `e2b` + Advanced help `e4b`)
- Editable memory scaffold (`SOUL.md`, `USER.md`, `MEMORY.md`)
- Daily logs and flat knowledge file ingestion
- Brain view, Settings, Onboarding
- Image and audio attachments
- Piper (output) and Whisper (input) voice support
- Joe Support assistant
- Local tool layer (memory, knowledge, workspace, settings tools)
- All three complexity modes (Simplified / Custom / Complete)

---

## Three Modes: Simplified / Custom / Complete

This is the user-facing complexity strategy. All modes are the same purchased product — the user toggles between them in Settings.

- **Simplified** (default for first-time users) — beginner-friendly surface. Single visible workspace, minimal terminology, Joe Support prominent, fewer concepts on screen.
- **Custom** — the user enables exactly the surfaces and features they want.
- **Complete** — everything visible. Full multi-brain, full memory and knowledge tools, all advanced workflows.

Onboarding defaults to Simplified and surfaces Custom/Complete as the user gains comfort. The modes are presets, not tiers — same price, same product.

---

## Pricing Strategy

### One-Time Purchase

- **Price: $39–$59 one-time** for ModernClawMacMulti
- Single price for the full app — the three modes are presets, not pricing tiers
- The user owns the version they install forever
- No license server lockout — the app stays usable

Rationale: a polished paid macOS app sits comfortably in this range. High enough to signal real product value; low enough to feel like a fair one-time buy.

### Optional Future Subscription (Add-On Stream)

- **Price: $5–$10/month or $49–$99/year** (depending on catalog depth at launch)
- Subscribers get new add-ons released **after** their original purchase
- The original purchase is never gated by the subscription — the version they bought stays whole
- Subscription is announced **after** the first wave of add-ons exists, not at launch

Examples of subscription content:
- New expert brain packs (customer support, marketing, founder)
- Premium voice packs
- Curator integration in-app
- Rosie verification layer in-app
- Advanced automation and scheduling
- Karpathy-style self-improvement loop

### Donations and Sponsorships

- **GitHub Sponsors** — set up on the legacy open-source ModernClaw repo
- **Ko-fi** — general project page for one-off support
- Both stay active alongside the paid product

### Crowdfunding (Optional Launch Boost)

- Optional Kickstarter / Indiegogo campaign once the paid product is real and demoable
- Recommended only **after** Phase 1 below is complete — never before there's a working installer and real users
- A campaign with no working product is the most common indie failure mode

---

## Distribution

- **Primary platform**: macOS-only at launch (`.dmg` via direct download, code-signed and notarized for Gatekeeper)
- **Sales platform**:
  - **Gumroad** — fastest setup, 10% fee, no license keys
  - **LemonSqueezy** — better for license keys, 5% + $0.50, tax compliance built in
  - **Paddle** — best tax compliance, 5% + $0.50, slower approval
  - Recommendation: start with Gumroad if you need money in the door quickly; move to LemonSqueezy once you want license keys and a professional checkout
- **Open-source anchor**: legacy minimal ModernClaw repo stays on GitHub — not feature-parity with this product, just credibility signal and donation home

---

## Phase Plan

### Phase 0: This Week (Foundation)

- Stand up GitHub Sponsors on the legacy open-source ModernClaw repo
- Stand up Ko-fi
- Make sure the legacy repo's README is honest about its relationship to the paid product (legacy minimal version; paid product available separately)
- Decide on payment platform (recommend Gumroad first)

### Phase 1: Make The Paid Product Real (Weeks 1–6)

- Finish the bundled macOS installer (`.dmg`, code-signed, notarized)
- Bundle `llama-server` as Tauri `externalBin`
- Bundle or first-launch-fetch the default GGUF model
- Lock the three complexity modes (Simplified / Custom / Complete) and make sure Settings can toggle between them
- Adaptive onboarding scaffold

### Phase 2: Real Users (Weeks 4–8)

- Get 20–50 friendly users on macOS
- Collect real feedback, testimonials, edge cases
- Polish based on what real installs surface
- Build a simple landing page with download CTA

### Phase 3: Sales Launch (Weeks 8–12)

- Set up Gumroad or LemonSqueezy
- Set price ($39–$59 one-time)
- Write product page — clear what's included, no fake scarcity
- Launch posts:
  - Reddit: `r/LocalLLaMA`, `r/macapps`, `r/opensource`, `r/artificial`
  - Hacker News (Show HN)
  - Product Hunt
- Optional: Kickstarter / Indiegogo campaign here, only if it strengthens the launch

### Phase 4: Subscription Layer (Months 3–6)

- Build the first wave of add-on packs
- Launch subscription as opt-in for the ongoing add-on stream
- Existing purchasers are never re-charged for what they already bought
- Pricing: $5–$10/mo or $49–$99/yr depending on catalog depth

---

## Quick Reference: Revenue Timeline

| When | What | Expected Revenue |
|------|------|-----------------|
| This week | GitHub Sponsors + Ko-fi on legacy repo | $0–$50/mo (grows over time) |
| Weeks 1–6 | Build bundled installer | $0 (product work) |
| Weeks 4–8 | Real-user pilot on macOS | $0 (audience building) |
| Weeks 8–12 | Sales launch on Gumroad/LemonSqueezy | First sales ($300–$1,500/mo) |
| Months 3–6 | Add-on subscription launches | Growth + recurring ($1,000–$5,000/mo) |
| Month 6+ | Crowdfunding, consulting, enterprise | Variable |

These are realistic estimates for a solo developer with a polished product and active marketing. Not guarantees.

---

## The One Rule That Matters Most

**You own what you buy.**

The subscription is for new things you want next. It is never for keeping what you already paid for. The moment a customer feels their original purchase is being held hostage by the subscription, the trust the local-first ethos depends on is gone.

---

## What To Do Right Now

If you are reading this and want to take action today:

1. **Apply for GitHub Sponsors** on the legacy open-source repo (5 min apply, few days to approve)
2. **Create a Ko-fi page** (10 min)
3. **Add a `FUNDING.yml`** to the legacy repo so the Sponsor button appears
4. **Create a Gumroad account** (don't list anything yet, just reserve the channel)

That is it. Those four things put the donation + sales infrastructure in place while the product work continues here.

---

## Document History

- Original: April 2026 — open-core Base + Multi split strategy
- Rewritten: 2026-06-01 — strategy moved to one paid macOS product + three complexity modes + optional add-on subscription. Open-core split abandoned.
- Status: Active plan
- Next review: After Phase 1 completion
