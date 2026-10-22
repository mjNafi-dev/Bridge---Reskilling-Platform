# Bridge style guide

**Feel:** a trusted mentor. Calm, clear, encouraging, professional but never formal.
**Rule #1:** readability beats decoration.

Code: [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css) (all values), [`base.css`](../frontend/src/styles/base.css) (defaults) and [`ui.css`](../frontend/src/styles/ui.css) (shared buttons, entrance motion, popups, page transitions).

## Fonts (all free)

| Role | Font | Why |
|---|---|---|
| Headings | **Bricolage Grotesque**, semibold | Has character without hurting readability. Used large only. |
| Body | **Switzer** | Clean, open letter shapes, not condensed. Easy to read in long forms. |
| Labels & numbers | **JetBrains Mono** | Small uppercase section labels; numbers stay aligned. |

- Body text is never smaller than **16px**.
- No all-caps body text, no thin weights, no condensed fonts.
- Percentages and hours use equal-width digits (`.num`) so animated numbers don't jump.

## Colour

Mostly white (`--paper`) on a fine dot grid (`--dot-grid`, 22px), near-black text (`--ink`), black pill buttons.

**Night surfaces** (`--night`, `.night` class) are the dark anchors: the sign-up / onboarding side panel, the dashboard header, the logo pill and the header band on every popup. Text on night uses `--paper` and `--night-text`; lines use `--night-line`. Done marks and progress on night use the brighter `--night-done` green with dark ink on top; empty dots and rings use `--night-muted`.

Accents have a **meaning**, so they're never used as decoration:

| Token | Meaning | Example |
|---|---|---|
| `--familiar-*` (amber) | You already know this, maybe revise | Yellow-outline checklist state |
| `--done-*` (olive) | Completed | Green checklist state |
| `--highlight-*` (orange) | Brand-new for you, use sparingly | "New" chip |
| `--sky-*` | Soft backdrops behind cards | Hero / result backgrounds |

The 3-state topic checklist: **empty outline** = unfamiliar · **amber outline** = familiar · **olive fill** = done.

## Spacing, radius, shadows

- Spacing steps: 4 · 8 · 12 · 16 · 24 · 32 · 64 · 120px. Mobile side gutter: 16px.
- Radius: 6 (small) · 12 (inputs) · 20 (cards) · 28 (large panels) · pill (buttons, chips).
- Shadows: `--shadow-1` cards · `--shadow-2` floating cards over sky · `--shadow-3` modals.

## Motion

Seamless and calm (CSS/SVG, no heavy 3D, no glows). Tokens: `--ease-out` (arriving), `--ease-in-out` (travelling), `--dur-fast` 150ms, `--dur-base` 260ms, `--dur-slow` 520ms.
- **Page transitions** (View Transitions API, `lib/go.js`): pages cross-fade and shared pieces morph. The sign-up panel shrinks into the onboarding panel (`side-panel`), the logo stays put (`brand`), the job title flies from the results card into the dashboard header (`job-title`).
- **Entrances:** `.rise` floats pieces up in a stagger (`--i`); onboarding steps slide in from the side you're heading towards; dashboard bubbles pop in one by one.
- **Feedback:** `.pop` on status and chip changes; buttons press in and their arrows nudge forward; option cards lean towards the middle; the onboarding "current step" pill slides between rows.
- **Living details:** the dashed "bridge" between what you know and the next topic keeps flowing; the current step on the path pulses softly; "Connected" breathes.
- **Popups** fade and rise in and out (closing animates too), over a lightly blurred backdrop.
- Everything respects the system "reduce motion" setting.

## Imagery

- Real-life **objects** as small accents (keys, maps, books, tools) to make complex ideas feel familiar.
- Abstract dots and lines for diagrams.
- Real stock photos of people are fine. **No drawn, cartoon or AI-generated people or faces** (e.g. no mascots with eyes).

## Voice

- Encouraging and specific: *"You've already got more of this than you think. Let's start with what feels familiar."*
- Not boss-like: avoid "Complete Module 1", "You must".
- Predictions are always labelled as estimates, with a source and date.
