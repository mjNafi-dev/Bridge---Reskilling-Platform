# Bridge style guide

**Feel:** a trusted mentor. Calm, clear, encouraging, professional but never formal.
**Rule #1:** readability beats decoration.

Code: [`frontend/src/styles/tokens.css`](../frontend/src/styles/tokens.css) (all values) and [`base.css`](../frontend/src/styles/base.css) (defaults).

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

Mostly white (`--paper`) and soft grey (`--l05`), near-black text (`--ink`), black pill buttons.

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

Subtle and lightweight (CSS/SVG, no heavy 3D):
- Sections fade/slide in on scroll.
- The recommended-skill card stays pinned while its details change.
- The overlap diagram animates its connecting lines when results appear.
- Everything respects the system "reduce motion" setting.

## Imagery

- Real-life **objects** as small accents (keys, maps, books, tools) to make complex ideas feel familiar.
- Abstract dots and lines for diagrams.
- Real stock photos of people are fine. **No drawn, cartoon or AI-generated people or faces** (e.g. no mascots with eyes).

## Voice

- Encouraging and specific: *"You've already got more of this than you think. Let's start with what feels familiar."*
- Not boss-like: avoid "Complete Module 1", "You must".
- Predictions are always labelled as estimates, with a source and date.
