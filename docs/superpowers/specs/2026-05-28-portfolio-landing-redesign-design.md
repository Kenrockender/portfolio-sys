# PORTFOLIO.SYS — Landing Page Redesign + Design System

**Date:** 2026-05-28
**Author:** Kenrockender (with Claude)
**Status:** SUPERSEDED — pivoted to app-first. Visual direction here
(amber accent, strict-mono "kaku" aesthetic) is also out of date.
**Successor:** `2026-05-28-app-redesign-design.md`
**Scope:** Design system + `index.html` only. `app.html` is a follow-up spec.

---

## 1. Context

The current landing page (`index.html`, 1009 lines of inline CSS) reads as a
generic 2023-era SaaS dashboard template: purple→cyan gradient text, pulsing
badge dots, centered hero, glow-on-hover cards, four stacked CSS files
(~7,500 lines total) that have been patched rather than redesigned.

The product is a real personal-investment tool aimed at Indonesian retail
investors who care about real numbers (IDX tickers, rupiah, multi-asset
tracking). The current aesthetics undersell the product's substance.

The redesign goal: a landing page that makes someone feel "this is a power
tool, I want it" in five seconds, without looking generic and without
breaking trust for a money-handling product.

## 2. Goals & Non-Goals

### Goals

- Replace `index.html` with a landing page in the **"Trading Terminal,
  Honest"** aesthetic direction (Bloomberg / IBKR lineage), with one
  editorial-serif manifesto block as the emotional anchor.
- Establish a small, durable **design system** (`css/system.css`) usable by
  both the landing now and `app.html` in a follow-up session.
- Ship a **dark-default theme with a light-mode toggle** and a **Bahasa
  Indonesia / English language toggle**.
- Keep `app.html` and all of its CSS untouched — the landing must not break
  the running app.

### Non-goals (explicit YAGNI)

- No auth / signup flow changes. The CTA continues to link to `app.html`.
- No backend changes, no Firebase rules changes.
- No SEO overhaul beyond updating `<title>` and meta description.
- No analytics, A/B testing infra, framework adoption, or build step.
- No PWA-shell changes.
- No mobile-app work beyond responsive landing layout.
- No redesign of `app.html` in this spec (separate session).

## 3. Aesthetic Direction

**Trading Terminal, Honest** — lineage: Bloomberg Terminal, Interactive
Brokers TWS, Linear's data views.

- Left-aligned, data-first, dense.
- Single accent color (terminal amber `#ffb000`), used like a system color.
- Up-green / down-red appear only on real upward / downward numbers.
- No gradients, no glows, no pulsing dots.
- One editorial-serif outlier block (Fraunces) as a mid-page manifesto — a
  single human-voice beat that prevents the rest from feeling robotic.

## 4. Design System (Tokens)

### 4.1 Color — dark default

```
--bg            #0a0a0a
--bg-elev       #111111
--bg-sunk       #050505
--rule          #1f1f1f
--rule-bright   #2a2a2a
--ink           #e8e6df
--ink-dim       #8a8780
--ink-faint     #4a4843

--signal        #ffb000   /* THE accent. Brand, nav-active, CTA, focus. */
--up            #4ade80   /* Only on upward numeric deltas. */
--down          #f87171   /* Only on downward numeric deltas. */
--warn          #fbbf24
```

### 4.2 Color — light mode

Not an inversion; its own pass styled for warmth, not glare.

```
--bg            #f5f1ea   /* paper */
--bg-elev       #ffffff
--bg-sunk       #ede8de
--rule          #d8d2c4
--rule-bright   #c5beac
--ink           #0f0e0c
--ink-dim       #5a5650
--ink-faint     #8a857a
--signal        #b07000   /* darker amber for contrast on paper */
--up            #166534
--down          #b91c1c
--warn          #a16207
```

### 4.3 Typography

- **Mono workhorse:** `IBM Plex Mono` (300 / 400 / 500 / 600) — Google
  Fonts. Replaces JetBrains Mono.
- **Editorial serif (outlier):** `Fraunces` (weight 400, soft axis 50,
  optical size 144) — Google Fonts. Used ONLY for the §3 manifesto.
- **No display sans.** Killing Syne removes the SaaS feel; big text is
  mono everywhere except the manifesto.

### 4.4 Type scale

```
--size-micro       11px
--size-small       13px
--size-body        15px
--size-lead        19px
--size-h3          28px
--size-h2          44px
--size-h1          72px
--size-manifesto   120px   /* manifesto block only */
```

Line-height: `1.2` for display, `1.55` for body, `1.45` for mono blocks,
`0.95` for manifesto.

### 4.5 Spacing — 4px base

```
--sp-xs    4px
--sp-s     8px
--sp-m    16px
--sp-l    24px
--sp-xl   40px
--sp-2xl  64px
--sp-3xl 120px
```

No magic numbers in any new CSS — only token references.

### 4.6 Motion

- One easing: `--ease-system: cubic-bezier(0.2, 0, 0, 1)`.
- Three durations: `--t-fast 120ms / --t 200ms / --t-slow 600ms`.
- **Approved motions only:**
  1. Typewriter on hero headline (one-time on page load).
  2. 200ms green/red flash on `numeric` value change.
  3. Border brighten on `pane` hover.
  4. Fade-up on scroll-in for section blocks (60ms stagger).
- No glow, pulse, float, parallax, decorative animation.
- Theme swap is **instant** — no transition. Animated theme swaps feel
  cheap on a money product.

### 4.7 Borders & radii

- All radii: **2px**. No 8/12/16 anywhere.
- All borders: 1px hairline using `--rule` (or `--rule-bright` on hover).
- No box-shadow except a single functional `focus-ring` on `:focus-visible`:
  `0 0 0 2px var(--bg), 0 0 0 4px var(--signal)`.

## 5. Component Vocabulary (6 primitives)

| Name | Job | Rule |
|------|-----|------|
| `pane` | Any framed surface | 1px hairline, 2px radius, `--bg-elev` fill, hairline-bright on hover |
| `pane--data` | Live data pane | Adds top status bar (title + sync timestamp + status dot) |
| `btn-bracket` | All buttons | Inline `[ TEXT →]` form; hover brightens brackets + adds top/bottom hairlines |
| `rule` | Section divider | 1px hairline with optional label like `—— §03 / FEATURES` |
| `numeric` | Any data-updating number | Tabular numerals, optional ▲/▼/▪ leader, 200ms green/red flash on change |
| `tag` | Inline metadata pill | `[ ID ]` `[ LIVE ]` `[ BETA ]` style; 11px mono with hairline border |

No icon system. The few decorative glyphs (▲ ▼ ▪ → ☼ ☾) are inline Unicode.

## 6. Landing Page Information Architecture

```
01  TOP BAR              brand · nav · [ID|EN] · [☼/☾] · [ MULAI →]
02  HERO TERMINAL        left text + right live terminal pane
                         + full-width IDX/global ticker rail below
03  MANIFESTO            serif outlier moment
04  WHAT IT KNOWS        six man-page style feature blocks
05  PROOF                one real chart pane + 4-cell KPI rail
06  PRICING + FOOTER     dense pricing table + RFC-style footer
```

### 6.1 Hero (§02) — detailed

Two-column on desktop (5 / 12 left text, 7 / 12 right terminal), stacked
on mobile (text on top, terminal below with horizontal-scroll on overflow).

**Left column** opens with a build-stamp line (`PORTFOLIO.SYS / v4.2 ·
BUILD 2026.05.28`), then a tight-leading mono headline:

> Sebuah sistem operasi untuk portofolio personal Anda.

…then a short sub, then two bracket buttons `[ MULAI GRATIS →]` and
`[ LIHAT TERMINAL ]`, then a small disclosure line.

**Right column** is a `pane--data` containing a fake-but-realistic
terminal session printing `portfolio.sys --status`, six rows of IDX /
crypto / commodity holdings with rupiah values and percent deltas, a
totals row, and a blinking `_` cursor. Numbers walk randomly within
±2% every 1.5 s; the row that changes flashes green or red for 200 ms.
On mobile, only the top four holdings + totals are shown (horizontal
scroll for the rest).

**Below the hero** (full width, hairline strip): a marquee-style ticker
rail with IHSG, USD/IDR, gold, BTC, and a few IDX leaders. Pauses on
hover.

### 6.2 Manifesto (§03)

Single full-width block. Left-bracketed by two corner-glyph
pseudo-elements (top-left + bottom-left only — not a full border).

Big serif text (Fraunces, 120 px, weight 400, line-height 0.95):

> Anda punya
> portofolio.
> Sekarang
> ketahui apa
> artinya.

Below, smaller (`--size-body`) mono paragraph in `--ink-dim`:

> Bukan grafik. Bukan dashboard. Sistem operasi untuk uang Anda — yang
> membaca data dan memberi tahu kapan Anda terlalu agresif, kurang
> terdiversifikasi, atau membayar pajak yang tidak perlu.

English version provided in `i18n.js` (`manifesto.headline`,
`manifesto.body`).

### 6.3 Features (§04)

Six `pane` cards in a 2-col grid (1-col mobile). Each is styled as a
man-page entry with four labeled lines: `NAME`, `SYNOPSIS`,
`DESCRIPTION`, `SUPPORTED`. No icons. No decorative backgrounds.

### 6.4 Proof (§05)

One large `pane--data` containing a real chart from `js/charts.js` with
realistic seed data, plus a 4-cell KPI rail beneath (`numeric` primitive).
No testimonials, no "trusted by" logos.

### 6.5 Pricing (§06)

A single dense table: three plans as columns, capability rows as
hairline-separated rows. No "most popular" pill. The recommended plan is
marked by `[ DIPILIH ]` tag above its column header. CTA per column uses
`btn-bracket`.

### 6.6 Footer

RFC-style: small mono text, three columns of links (Product, Resources,
Legal), a final line containing `© 2026 · PORTFOLIO.SYS · BUILD
2026.05.28 · commit abcdef0`.

## 7. Theme + i18n Mechanics

### 7.1 Theme toggle

- `localStorage.portfolio.theme` ∈ {`dark`, `light`}; default `dark`.
- `data-theme` attribute on `<html>` flips token sets.
- Respects `prefers-color-scheme` only on first visit (before any stored
  preference exists). After first visit, user choice wins.
- Toggle UI: `[ ☼ ]` / `[ ☾ ]` in top bar (bracket button).
- No CSS transition on swap.

### 7.2 Language toggle

- `localStorage.portfolio.lang` ∈ {`id`, `en`}; default `id`.
- Single dict file `js/i18n.js` exporting `{ id: {...}, en: {...} }`.
- Every translatable element carries `data-i18n="path.to.key"`.
- ~30-line `applyI18n(lang)` walks `[data-i18n]` and sets `textContent`.
- Number formatting per locale via `Intl.NumberFormat('id-ID' | 'en-US')`,
  exposed through the `numeric` primitive's `locale` param.
- Toggle UI: `[ ID | EN ]`; active language in `--signal`, inactive in
  `--ink-dim`.
- No URL routing (no `/id`, `/en`) — single page swap.
- No framework / library.

## 8. File Layout & Cutover

### 8.1 New files

- `index.html` — rebuilt from scratch (no inline `<style>` beyond minimal
  font-preconnect).
- `css/system.css` — design tokens + 6 component primitives. Shared with
  `app.html` next session.
- `css/landing.css` — landing-specific composition styles.
- `js/i18n.js` — string dictionaries + `applyI18n()`.
- `js/landing-terminal.js` — live terminal scene (price-walk simulation,
  flash-on-change wiring).

### 8.2 Renamed / preserved

- Current `index.html` → `index.old.html` (kept until app.html session
  completes for reference; deleted at end of that follow-up).
- `css/styles.css`, `css/design-upgrade.css`, `css/design-upgrade-additions.css`,
  `css/loading-states.css`, `css/pwa-install.css`, `css/mobile.css` —
  untouched. Landing does not import them. `app.html` continues to import
  them as today.

### 8.3 Landing imports (clean slate)

```
css/system.css
css/landing.css
fonts.googleapis.com — IBM Plex Mono (300/400/500/600) + Fraunces
js/i18n.js
js/landing-terminal.js
```

No `styles.css`, no `design-upgrade*.css`. Landing is a fresh tree.

### 8.4 Cleanup timing

Old CSS files are deleted in the **follow-up `app.html` redesign spec**,
not this one. This protects the running app from breaking mid-redesign.

## 9. Out of Scope — Recap

Auth, signup, Firebase rules, backend, analytics, SEO beyond title/meta,
PWA shell, mobile-app shell, A/B testing infrastructure, framework
adoption, build step, redesign of `app.html`.

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Terminal scene reads as developer-niche, alienates non-tech retail investors | Manifesto block in plain-Bahasa serif gives a human-voice anchor; man-page features stay descriptive not jargon-heavy |
| Live price-walk could glitch on slow devices | Cap update interval at 1.5 s, animate with CSS transition only (no rAF loop), pause when tab is hidden |
| Amber on near-black has low contrast for some viewers | Reserve `--signal` for short text + glyphs; never for body copy. Light-mode `--signal` is darkened for paper contrast. |
| Single-page i18n means no SEO benefit per language | Acceptable: landing is a tool entry point, not content marketing. Title + meta in default language is enough. |
| Old CSS sticking around invites confusion | The follow-up `app.html` spec deletes them. Until then, `index.old.html` is the only thing referencing the new system; old files belong solely to `app.html`. |

## 11. Acceptance Criteria

- New `index.html` loads with **only** `system.css` + `landing.css` + 2 JS
  files, in both dark and light modes, in both ID and EN, on desktop and
  mobile (≥ 360 px).
- `app.html` continues to render exactly as it does today (no regression).
- Theme + language preferences persist across page reloads.
- Terminal scene updates without console errors and pauses when the tab is
  hidden.
- Lighthouse: Performance ≥ 90 desktop, Accessibility ≥ 95, Best
  Practices ≥ 95 (no PWA score needed for this round).
- No purple-cyan gradient, no pulsing dot, no centered SaaS hero — visual
  regression by inspection.

## 12. Follow-ups (next sessions)

- `app.html` redesign on top of `system.css` (own brainstorm, own spec).
- Delete `styles.css`, `design-upgrade.css`, `design-upgrade-additions.css`,
  `loading-states.css`, `mobile.css`, and `index.old.html` at the end of
  the `app.html` session.
- Decide whether `pwa-install.css` survives or gets folded into `system.css`.
