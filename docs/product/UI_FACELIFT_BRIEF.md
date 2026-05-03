# ModernClawMacMulti UI Facelift Brief

## Goal

Give `ModernClawMacMulti` a more professional, polished, premium desktop look without losing the app's local-first, practical, builder-oriented identity.

This facelift should make the app feel:

- more intentional
- more premium
- more editorial
- more trustworthy
- less generic blue-and-white SaaS

## Current UI Truth

Based on the current codebase:

- the app shell is structurally solid
- the visual language is still generic and utility-first
- type hierarchy is serviceable but not distinctive
- default system typography makes the product feel unfinished
- many surfaces use similar border / background / radius treatments, so the eye does not know what is primary
- the shell, chat, settings, and brain controls need stronger visual separation and rhythm

Current high-visibility files:

- `local-ai/src/index.css`
- `local-ai/src/components/layout/AppShell.tsx`
- `local-ai/src/components/layout/Header.tsx`
- `local-ai/src/components/layout/Sidebar.tsx`
- `local-ai/src/components/layout/BrainSelector.tsx`
- `local-ai/src/components/models/ModelSelector.tsx`
- `local-ai/src/components/chat/ChatView.tsx`
- `local-ai/src/components/chat/EmptyState.tsx`
- `local-ai/src/components/chat/MessageInput.tsx`
- `local-ai/src/components/settings/SettingsView.tsx`

## Recommended Visual Direction

Use a direction I would describe as:

`Editorial Local Intelligence`

That means:

- warm but not beige
- technical but not sterile
- premium but not luxury-for-luxury's-sake
- modern macOS-adjacent polish without copying Apple literally
- a workstation mood, not a toy chat app mood

## Design Principles

1. Stronger hierarchy

- make the active area obvious
- make controls feel grouped by importance
- reduce the feeling that everything has the same weight

2. More atmospheric surfaces

- avoid flat white panels everywhere
- use layered neutrals, subtle gradients, and restrained tints
- create depth with contrast, inset surfaces, and shadow control

3. Better typography

- move away from default system-only feeling
- use a more expressive sans for headings and controls
- keep body copy highly readable

4. Cleaner density

- preserve capability, but improve pacing
- reduce visual crowding in header and settings
- make the interface feel composed rather than packed

5. Product personality

- the app should feel like a private command workspace
- it should suggest memory, craftsmanship, and control
- it should not feel like an average AI wrapper

## Color Direction

Recommended palette direction:

- base background: soft mineral / parchment-tinted light neutral
- elevated surfaces: warm off-white and smoke blue-gray
- primary accent: deep electric blue, slightly muted
- support accent: copper / ember / clay for highlights and attention
- success state: natural green, not neon

Avoid:

- purple-heavy defaults
- harsh pure white
- overly saturated cyan / neon AI aesthetics

## Typography Direction

Recommended stack direction for implementation:

- headings / interface emphasis: `Manrope`, `Sora`, or `Plus Jakarta Sans`
- body / long-form UI text: `Source Sans 3`, `Instrument Sans`, or `IBM Plex Sans`

Implementation note:

- prefer one expressive UI sans plus a strong weight scale
- avoid introducing multiple decorative fonts too early

## Surface Strategy

### Shell

- stronger background atmosphere behind the whole app
- sidebar should feel like a navigation rail, not just a left box
- header should feel quieter and more integrated
- the center controls should feel like deliberate workspace instruments

### Chat

- empty state should feel premium and inviting
- message area should have more compositional breathing room
- input area should feel like a command composer, not a plain textarea dock
- attachment and voice affordances should feel integrated into the composer

### Brain Controls

- `BrainSelector` and `ModelSelector` should feel like premium control capsules
- the active brain should feel important without being cartoonish
- dropdowns and panels should feel intentionally layered

### Settings

- the settings page should read like a professional control panel
- use section rhythm, better headings, and stronger card grouping
- reduce the current “form pile” feeling

## First-Facelift Priority Order

Start here, in this order:

1. global tokens in `index.css`
2. app shell background, sidebar, and header
3. chat surface and message composer
4. `BrainSelector` and `ModelSelector`
5. settings layout and cards

## How ChatGPT Images 2.0 Should Be Used

Use ChatGPT Images 2.0 as the visual concept and refinement engine, not as the final product renderer.

Best workflow:

1. capture real screenshots from the current app
2. create three facelift variations for each target screen
3. choose one direction
4. extract concrete rules:
   - colors
   - spacing
   - radius
   - shadows
   - typography
   - icon style
5. rebuild the chosen direction in code

## Success Criteria

The facelift is successful when:

- the app looks clearly more premium at first glance
- the shell feels intentional and distinctive
- the chat screen feels calm and capable
- the settings page feels trustworthy and well-organized
- the product looks like a real software brand, not a prototype
- we preserve usability while increasing aesthetic confidence

