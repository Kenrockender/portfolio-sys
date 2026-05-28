# PORTFOLIO.SYS — App Redesign + Design System

**Date:** 2026-05-28
**Author:** Kenrockender (with Claude)
**Status:** Approved (brainstorming + mockup phase complete)
**Scope:** `app.html` + design system. Landing (`index.html`) is a follow-up spec.
**Supersedes:** `2026-05-28-portfolio-landing-redesign-design.md` (pivoted from
landing-first to app-first per user direction)

## Visual specification (binding)

Three browser-runnable mockups serve as the **binding visual reference** for
this spec. Where this document and a mockup differ, the mockup wins for
visuals; this document wins for behavior, scope, and out-of-scope items.

- `mockup-app.html` — HOME tab
- `mockup-app-transaksi.html` — TRANSAKSI tab (transactions + cashflow merged)
- `mockup-app-analisis.html` — ANALISIS tab (analytics + rebalance + history + ML merged)
- `mockup.html` — landing (deferred; reference for accent-color decision only)

---

## 1. Context

The current `app.html` (1423 lines) lives on top of ~7,500 lines of stacked
CSS (`styles.css` + 3 `design-upgrade*.css` patches) and uses a generic
"dark SaaS dashboard 2023" aesthetic — JetBrains Mono + Syne, purple→cyan
gradient, pulsing dots, glowing borders. User feedback: **too AI-generated
and too rigid** ("kaku").

We initially scoped landing-first; the user pivoted to **app-first** because
the app is where they spend the time and the landing's job is to advertise
the app. The product is a personal investment tool for Indonesian retail
investors. Stated daily use: **80% checking balance + adding/editing
transactions**.

The redesign goal: an app that feels like a power tool you'd choose to open
every morning — warm, calm, opinionated — and that makes adding a
transaction feel frictionless.

## 2. Goals & Non-Goals

### Goals

- Replace `app.html` with a 3-tab app (HOME · TRANSAKSI · ANALISIS),
  collapsing the current 7-tab structure.
- Establish a small durable **design system** in `css/system.css` shared by
  app and (later) landing.
- Dark-default with a light-mode toggle. Green accent (`#34d399`) locked.
- ID-default with EN toggle (`localStorage.portfolio.lang`).
- Frictionless transaction entry via persistent quick-add bar + `T` keyboard
  shortcut + smart command parser.
- Preserve all existing functionality: Firebase auth, Firestore sync,
  Chart.js, PDF/Tesseract import, PWA shell.
- Match the visual treatment in the three mockup files.

### Non-goals (explicit YAGNI)

- No backend / Firebase rules changes. We rewire the same auth + sync hooks.
- No new feature work beyond what the mockups show (no new chart types,
  no new asset classes, no new ML models).
- No `index.html` landing redesign in this spec (separate follow-up).
- No mobile-app shell beyond responsive `app.html`.
- No framework adoption (no React/Vue/Svelte). Vanilla HTML + CSS + JS.
- No build step. ES modules + native browser features.
- No analytics, A/B testing infra.
- No SEO meta overhaul for `app.html` (it's behind auth).

## 3. Aesthetic Direction

**Loose-terminal-warm.** Trading-terminal lineage but loosened from the
landing's strict-mono-brutalism after user feedback:

- **Warm dark background** `#0c0d0b` with very subtle green-tinted radial
  texture (two `radial-gradient` overlays at 25%/35% and 75%/65%, 1px size,
  2.5% / 1.5% opacity). Not true black.
- **8 px corner radius**, not 2 px. Hairline borders kept.
- **Three fonts in roles, never blended at random:**
  - `IBM Plex Mono` — labels, ticker codes, command syntax, KPI captions.
  - `Inter` — body, button labels, transaction descriptions.
  - `Fraunces` (opsz 96–144, wght 400–500, SOFT 50–80) — section headlines,
    big numbers (totals, KPIs), AI insight quotes.
- **Sentence case for content,** UPPERCASE only for tags and short labels
  (`HARI INI` is wrong, `Hari ini` is right; `LIVE` and `BUY` tags are OK).
- **Conversational section headlines** (`Apa kabar pasar hari ini?`, `Cara
  uangmu tersebar`, `Bagaimana performanya?`) instead of `OVERVIEW` /
  `ANALYTICS`.
- **Real buttons,** not bracket-wrapped CLI prompts. Brackets reserved for
  command-style inline elements (e.g., the `›` prompt in quick-add input,
  keyboard hint pills like `[ T ]`).
- **Color is signal, not decoration.** Green = brand + dividends + insights.
  Lime = data UP. Red = data DOWN. Amber = warnings. Sky-blue = info.
  Purple = crypto category only. No gradient text.

## 4. Design System (Tokens)

### 4.1 Color — dark default (`data-theme="dark"`)

```css
--bg:           #0c0d0b;
--bg-elev:      #14150f;
--bg-elev-2:    #1a1c13;
--bg-sunk:      #07080a;
--rule:         #23241d;
--rule-bright:  #353629;
--ink:          #ecebe4;
--ink-dim:      #8e8d80;
--ink-faint:    #54534a;
--signal:       #34d399;   /* brand · CTA · nav-active · focus · insights */
--signal-deep:  #059669;
--up:           #a3e635;   /* numeric UP (distinct from brand) */
--down:         #f87171;
--warn:         #fbbf24;
--info:         #38bdf8;
--shadow:       0 1px 0 rgba(255,255,255,0.02), 0 12px 32px rgba(0,0,0,0.4);
```

### 4.2 Color — light mode (`data-theme="light"`)

```css
--bg:           #f6f3eb;   /* warm paper */
--bg-elev:      #ffffff;
--bg-elev-2:    #fbf8f0;
--bg-sunk:      #ede9dd;
--rule:         #d6d1c0;
--rule-bright:  #b8b29a;
--ink:          #14120c;
--ink-dim:      #595547;
--ink-faint:    #8a8472;
--signal:       #15803d;
--signal-deep:  #14532d;
--up:           #3f6212;
--down:         #b91c1c;
--warn:         #a16207;
--info:         #0369a1;
--shadow:       0 1px 0 rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.08);
```

### 4.3 Typography

| Family | Weights / axes | Role |
|---|---|---|
| `IBM Plex Mono` | 300/400/500/600 + italic 400 | Labels, ticker codes, data captions, command syntax, `kbd` pills |
| `Fraunces` | opsz 96–144, wght 400–500, SOFT 50–80 | Section headlines, KPI numbers, totals, AI insight quotes, greetings |
| `Inter` | 400/500/600 | Body, button labels, transaction descriptions |

All three load from Google Fonts.

### 4.4 Scale

```css
--size-micro: 11px; --size-small: 13px; --size-body: 15px;
--size-lead: 18px;  --size-h3: 24px;    --size-h2: 32px;
--size-h1:  56px;
```

Line-height: `1.55` body, `1.45` mono blocks, `1.05`–`1.2` display.
Letter-spacing: `-0.02em` to `-0.035em` on Fraunces display sizes;
`+0.04em` to `+0.16em` on uppercase mono labels.

### 4.5 Spacing — 4 px base, named

```css
--sp-xs:  4px; --sp-s:   8px; --sp-m:   16px; --sp-l:   24px;
--sp-xl: 40px; --sp-2xl: 64px; --sp-3xl: 96px;
```

No magic numbers in any new CSS — only token references.

### 4.6 Motion

- Single easing: `--ease: cubic-bezier(0.2, 0, 0, 1)`.
- Three durations: `--t-fast 120ms / --t 200ms / --t-slow 600ms`.
- **Approved motions only:**
  1. Numeric tick + 200ms green/red flash on price/total change.
  2. Border brighten on `.card` hover.
  3. Fade-up on scroll-in (`.reveal` → `.reveal.in`).
  4. Blink (live tag dot + caret) — 1.4 s step-end.
  5. Marquee on ticker rail (60 s linear), pause on hover.
  6. `.heatmap__cell:hover` scale `1.06`.
  7. Sticky topbar `backdrop-filter: blur(12px)`.
- Theme swap is **instant**. No animated transition between themes.

### 4.7 Borders & radii

```css
--r-sm: 4px;
--r:    8px;
--r-lg: 14px;
```

- Default for cards / panes: `--r` (8 px).
- Inline pills / chips / tags: `100px` (full round).
- Hero AI-insight callout: `--r-lg` (14 px).
- Hairline borders: 1 px solid `--rule`, brightened to `--rule-bright` on
  hover. No box-shadow except `--shadow` token applied sparingly on the
  hero AI callout and `:focus-visible` ring.
- Focus ring: `0 0 0 2px var(--bg), 0 0 0 4px var(--signal)`.

## 5. Component Vocabulary

| Name | Job | Visual rule |
|---|---|---|
| `.card` | Any framed surface | 1 px hairline, 8 px radius, `--bg-elev` fill, hairline-bright on hover |
| `.tag` | Inline status/category pill | 11 px mono, 100 px radius, tinted background (signal / up / down / warn / info), 1 px hairline |
| `.btn` | Default action | 10 px / 18 px, 8 px radius, `--bg-elev-2` background, sentence-case |
| `.btn--primary` | Primary CTA | `--signal` fill, `--bg` text, weight 600 |
| `.btn--ghost` | Tertiary | Transparent, color-on-hover only |
| `.kbd` | Keyboard hint inline | Mono, hairline border, sunken fill |
| `.num` | Tabular numerals | `font-variant-numeric: tabular-nums` |
| `.label` | Mono caption | Uppercase, `--ink-faint`, +0.08em tracking |
| `.section-title` | Page section heading | Fraunces 32 px, sentence-case headline, optional `→ more` link right |
| `.reveal` | Scroll-in primitive | Opacity 0 → 1, translateY 8 → 0 |

No icon system. Decorative glyphs are inline Unicode (`▲ ▼ ▪ → ↑↓ ☼ ☾ ⋯ ⌕ ✦ ›`).

## 6. Information Architecture

The 7-tab structure consolidates to **3 tabs**:

| New tab | Replaces | Behavior |
|---|---|---|
| **Home** | Old HOME | Greeting + total + sparkline + market rail + quick-add + holdings preview + activity feed + diversification |
| **Transaksi** | TRANSACTION LOG + CASHFLOW | Persistent quick-add + summary strip + mode toggle (All / Trades / Cashflow) + day-grouped ledger |
| **Analisis** | ANALYTICS + REBALANCE + HISTORY + ML INTELLIGENCE | AI insight callout + health strip + equity curve + allocation/risk + rebalance suggestions + ML signal feed + monthly heatmap |

**HOLDINGS** is no longer a tab. It becomes a **drill-down** from the Home
"Posisi terbesar" section: `Semua 24 aset →` opens a Holdings panel
(scope: detailed holdings list with crypto/stocks/gold subsections from old
HOLDINGS tab). Implementation in this round: link to anchor on Home
showing top 10; full panel deferred to Phase 2 if needed.

## 7. Per-Tab Specification

The mockup files are the binding visual reference. Below are the
behaviors / interactions not visible from the static mockups.

### 7.1 HOME (`mockup-app.html`)

- **Greeting** (`Selamat sore, Ken.`) — computed from local time of day
  (`pagi` 04–11, `siang` 11–15, `sore` 15–18, `malam` 18–04) and the
  signed-in user's first name.
- **Total** — tick every 2.2 s with a gentle drift simulation in the
  mockup; in production, wire to the existing `state.js` total. Flash
  green/red briefly on change. Pause when document is hidden.
- **Sparkline** — 7D / 1D / 1M / 1Y toggle; each fetches from the
  existing chart data (no new endpoint).
- **Market rail** — 4 cards: IHSG, USD/IDR, Emas/oz, Brent. Live dot
  per card (green / red on status).
- **Quick-add bar** — see §7.4 for the smart command parser.
- **Holdings preview** — top 5 positions by weight, with weight bar,
  delta, and 80×28 sparkline. `Semua 24 aset →` opens the Holdings panel.
- **Activity feed** — 5 most-recent transactions; relative time (`Baru
  saja`, `Kemarin`, `3 hari lalu`).
- **Diversifikasi** — split view: left = 5-row bar chart, right = AI
  insight + concrete CTA (e.g., "jual ~Rp 35 jt crypto, alokasikan
  ke RDPU").

### 7.2 TRANSAKSI (`mockup-app-transaksi.html`)

- **Page head** — `Catatan transaksi & arus kas.` plus month-context
  subtitle, `Impor CSV` / `Ekspor` / `+ Tambah` actions.
- **Persistent quick-add bar** — same component as Home; sticky just
  below the topbar after scroll past the page head.
- **Summary strip** — 5 cells: Net bulan ini (main, tinted), Beli, Jual,
  Dividen, Biaya & pajak. Filters on the ledger update these counts.
- **Mode toggle** — Semua / Transaksi / Arus kas. Counts inline.
  Cashflow rows render with `IN` / `OUT` type pills; trades render
  with `BUY` / `SELL` / `DIV` / `FEE`; tax events as `TAX`.
- **Filter chips** — BBCA / Tipe / Broker / 7 hari, all clickable to
  open a dropdown; active chips show `×` to remove.
- **Search** — debounce 200 ms; matches ticker, broker name, notes.
- **Day-grouped ledger** — group by absolute date with friendly
  headings (`Hari ini`, `Kemarin`, weekday name + relative,
  `Minggu lalu`). Each group shows its net delta colored green/red.
- **Row hover** — reveals `⋯` menu (edit / delete / duplicate /
  attach note).
- **Endline** — `Menampilkan 13 dari 27 transaksi bulan ini.
  Tampilkan lebih banyak →` loads next page.

### 7.3 ANALISIS (`mockup-app-analisis.html`)

- **Period picker** — 1M / 3M / 6M / 1Y (default) / 3Y / ALL. Drives all
  charts and the heatmap.
- **AI insight callout** — single paragraph from Gemini, written in
  Bahasa or English per current locale. `Tanya lagi` opens a chat
  drawer (reusing `gemini-ui.js`); `Lihat saran ↓` scrolls to
  rebalance section.
- **Health strip** — 4 KPIs (Total return YTD, Sharpe 1Y, Max drawdown,
  Volatilitas). Each card has a 4 px health bar at the bottom
  (`b-good` / `b-ok` / `b-warn`).
- **Equity chart** — Portfolio (signal-color solid + fill) vs IHSG
  (dashed ink-faint). Annotated with drawdown moments + end marker.
  Chart.js powered.
- **Alokasi donut** — SVG donut (no chart lib), 5 segments with
  consistent colors per asset class (saham=signal, crypto=purple,
  emas=warn, cash=info, lainnya=ink-dim). Center label shows "5 kelas
  aset terbesar".
- **Risk grid** — 6 cells (Beta, Sortino, VaR 95% 1-day, Korelasi
  BBCA × BBRI as example, HHI concentration, Skewness). Each has a
  short hint colored good/bad/neutral.
- **Rebalance** — top 3 actions, each row shows from→to + estimated
  cost + `[ Catat ]` button (opens add-transaction pre-filled).
- **ML signal feed** — recent signals from `ml.js`, typed
  ANOMALY / REGIME / PREDICT, each with confidence percentage.
- **Monthly heatmap** — 12 columns × 3 rows (2024 / 2025 / 2026).
  Color intensity = magnitude; positive = green, negative = red.
  Hover scales to `1.06`. Scale legend + monthly average + hit-rate
  beneath.

### 7.4 Quick-add command parser (cross-tab)

Lives on Home and Transaksi. Triggered by `T` key (anywhere not in an
input). One text input, smart parsing on `Enter` or `[ Simpan ]`.

**Grammar (case-insensitive, Bahasa or English):**

| Pattern | Meaning |
|---|---|
| `beli|buy <qty> <ticker> @ <price>` | Buy trade |
| `beli|buy <qty> <ticker> market` | Buy at market price (auto-fill from feed) |
| `jual|sell <qty> <ticker> @ <price>` | Sell trade |
| `div|dividen <ticker> <amount>` | Dividend income |
| `biaya|fee <amount> <description>` | Fee expense |
| `expense|keluar <amount> <description>` | Cashflow OUT |
| `income|masuk <amount> <description>` | Cashflow IN |
| `pajak|tax <amount> <description>` | Tax event |

- Numbers accept rupiah idioms: `9.425`, `9,425`, `9425`, `9k`, `9 jt`, `1,5jt`.
- Ticker resolves against held positions first; else uses raw text.
- On parse failure: input border turns `--warn`; show inline hint with
  closest pattern.
- On parse success: prepend to ledger with a subtle slide-in.

## 8. Modals

The original `app.html` has ~10 modals. Plan per-modal:

| Modal | Plan |
|---|---|
| Login overlay (Google) | **Rebuild.** New design: serif greeting, green CTA, brand mark. First impression matters. |
| Onboarding overlay | **Rebuild.** 3-step inline carousel: import / add manually / connect broker. |
| Add asset (legacy) | **Mostly retired.** Quick-add covers 90%; for unsupported asset types (real estate, P2P, custom), keep a slim "add custom asset" modal — rebuilt with new tokens. |
| Asset chart popup | **Rebuild.** Card with full equity curve + transactions for that asset + actions. |
| Confirm delete | **Rebuild.** Small centered card with serif headline, ghost cancel + red-tinted confirm. |
| Import CSV | **Rebuild.** Two-step: drop zone → column-mapping table → preview → confirm. |
| Theme picker | **Killed.** Replaced by the simple `☾ Dark / ☼ Light` toggle in topbar. |
| Manual price | **Rebuild.** Inline editable cell in Holdings drill-down instead of a modal. |
| Upgrade (pricing) | **Deferred.** Lives on the future landing redesign; keep current modal as-is until then. |
| Cashflow add/edit | **Killed.** Subsumed by quick-add (`income`/`expense`) and ledger row edit. |

## 9. Login Screen (first impression)

This is the page everyone sees first; it deserves design attention.

- Full-viewport centered card on `--bg` with the subtle texture overlay.
- Brand mark (28×28 amber-on-bg) + wordmark `portfolio.sys` at top.
- Big Fraunces serif headline: `Selamat datang.` (`Welcome.` in EN).
- Sub-headline mono caption: `Sistem operasi untuk portofolio personal Anda.`
- Single `[ Masuk dengan Google ]` button (Google's official mark
  preserved per their brand guidelines).
- Three-row feature list (mono captions, no icons):
  `Tersinkron lintas perangkat · Privat — hanya Anda yang melihat · Harga
  real-time`
- Footer line: `v4.2 · build 2026.05.28 · bukan saran investasi`
- Toggle `ID | EN` and `☾ Dark / ☼ Light` available top-right of the card.

## 10. Theme + i18n Mechanics

### 10.1 Theme toggle

- `localStorage.portfolio.theme` ∈ {`dark`, `light`}; default `dark`.
- `data-theme` attribute on `<html>` flips token sets.
- First-visit respects `prefers-color-scheme`; after that, user choice wins.
- Toggle UI: `☾ Dark` / `☼ Light` in topbar.
- Inline `<script>` in `<head>` applies stored theme before stylesheets
  paint to prevent flash. (The current `app.html` already does this — we
  keep the pattern.)
- **No CSS transition on theme swap.**

### 10.2 Language toggle

- `localStorage.portfolio.lang` ∈ {`id`, `en`}; default `id`.
- Single dict file `js/i18n.js` exports `{ id: {...}, en: {...} }`.
- Every translatable element carries `data-i18n="path.to.key"`.
- Locale-aware number formatting via `Intl.NumberFormat('id-ID' | 'en-US')`,
  exposed through a `fmtNum` / `fmtIDR` helper.
- Date-relative labels (`Baru saja`, `Kemarin`, `3 hari lalu`) computed
  per locale.
- Toggle UI: `[ ID | EN ]` in topbar; active language in `--signal`.
- No URL routing (no `/id`, `/en`) — single page swap.
- No framework / library.

## 11. File Layout & Cutover

### 11.1 New files

- `app.html` — rebuilt from scratch (no inline `<style>` beyond fonts +
  pre-paint theme script).
- `css/system.css` — design tokens + the 10 component primitives.
  Shared with the landing later.
- `css/app.css` — app-specific composition (topbar, tabs, page,
  per-tab sections).
- `js/i18n.js` — string dictionaries + `applyI18n(lang)` walker +
  `fmtIDR` / `fmtNum` / `relTime` helpers.
- `js/quickadd.js` — command parser (§7.4) wired to `state.js` /
  `storage.js` add-transaction.
- `js/router.js` — minimal 3-tab routing via `hashchange` + `History
  API`. Each tab is a `<section>` toggled by `data-tab` attribute.
- `js/charts-app.js` — Chart.js configs for equity, sparklines, donut
  (donut is SVG, not Chart.js). Replaces what's in `charts.js`; old
  file moved to `_archive/`.

### 11.2 Renamed / preserved

- Current `app.html` → `app.old.html` (kept for reference for one
  release cycle, then deleted).
- `js/app.js`, `js/api.js`, `js/state.js`, `js/storage.js`, `js/ml.js`,
  `js/gemini.js`, `js/import-parsers.js`, `js/plans.js`, `js/parsers/*` —
  **untouched as logic**, but their UI hooks are rewired to the new DOM
  IDs / classes in `app.html`. No business logic change.
- `firebase/*` — untouched.
- `sw.js`, `manifest.json`, `icons/*` — untouched (PWA shell).

### 11.3 Files to be removed at end of cutover

After acceptance criteria pass:

- `css/styles.css`
- `css/design-upgrade.css`
- `css/design-upgrade-additions.css`
- `css/mobile.css` (responsive rules folded into `system.css` + `app.css`)
- `css/loading-states.css` (loading patterns folded into `system.css`)
- `css/pwa-install.css` (PWA install banner kept as a single small
  component in `system.css`)

`index.html` (landing) is **not modified** in this spec. It will continue
to import the old CSS files until the deferred landing spec ships. We
will not delete the old CSS files until BOTH `app.html` AND `index.html`
are migrated — current expected ordering is "ship this app spec; ship
landing spec next; delete old CSS at the end of the landing spec."

### 11.4 What the new `app.html` imports

```
css/system.css
css/app.css
Google Fonts: IBM Plex Mono + Fraunces + Inter
JS (in order):
  pre-paint theme inline script
  js/i18n.js
  js/state.js   (existing)
  js/storage.js (existing)
  js/api.js     (existing)
  js/charts-app.js
  js/quickadd.js
  js/router.js
  js/app.js     (existing — entrypoint)
  js/ml.js, gemini.js, gemini-ui.js — loaded lazily on Analisis tab
External: Chart.js, PDF.js, Tesseract.js, jsPDF, Firebase ESM SDK
```

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Rewiring UI hooks breaks Firestore sync | Keep the same DOM data attributes and event signatures used by `app.js`. Add an integration smoke test pre-cutover: login → load → add transaction → reload → verify persisted. |
| Quick-add parser ambiguity causes wrong-record entry | Show parsed result in a confirm preview before commit on first 20 uses; thereafter only confirm on parse-failure or unusual entry. |
| Locale toggle de-syncs number formatting in chart libraries | All chart formatters wrap `Intl.NumberFormat(currentLocale)`. Test both locales after every chart change. |
| Light mode looks washed against the brand-green text | Light-mode `--signal` is darkened to `#15803d`. Contrast verified at 4.5:1 against `--bg`. |
| 8 px radius on so many surfaces softens the "power tool" feel | Counter-weighted by hairline borders (1 px), tabular numerals, mono labels, dense data tables — softness comes from radius, not from the type system. |
| 3-tab consolidation hides features users currently rely on | All current functionality survives; only the navigation grouping changes. If a user can't find HISTORY, it's now in Analisis. Onboarding tour notes this on first run after migration. |
| ML signal feed needs server-side compute the existing build doesn't have | Use the existing client-side `ml.js` outputs only. Spec descriptions in the mockup are realistic placeholders sourced from current code; no new model required. |

## 13. Acceptance Criteria

- `app.html` loads with **only** `system.css` + `app.css` + Google Fonts
  in `<head>`, in both dark and light modes, in both ID and EN, on
  desktop (≥ 1024 px), tablet (≥ 760 px), and mobile (≥ 360 px).
- Firebase Google sign-in works; sign-out works; Firestore data round-trips
  (add a test transaction, refresh, see it persisted).
- Theme + language preferences persist across reloads.
- All three tabs (Home, Transaksi, Analisis) render with seeded fixture
  data identical to the mockup files when not signed in (preview mode).
- `T` keyboard shortcut focuses the quick-add input on Home and Transaksi.
- Quick-add parser correctly parses at least: `beli 100 BBCA @ 9.425`,
  `jual 5 GOTO market`, `div BMRI 250000`, `expense 35000 makan siang`,
  `income 12000000 gaji`.
- Equity chart period picker (1M / 3M / 6M / 1Y / 3Y / ALL) updates the
  chart and the health-strip numbers.
- Monthly heatmap renders without overflow at 768 px and above; collapses
  to a vertical 12×1 list below.
- Lighthouse: Performance ≥ 88 desktop, Accessibility ≥ 95, Best
  Practices ≥ 95, PWA score preserved at the current value or higher.
- No purple-cyan gradient text, no Syne, no JetBrains Mono (replaced by
  Plex Mono), no pulsing badge dot, no glowing border anywhere in the
  app shell.

## 14. Out of Scope — Recap

Auth flow changes, Firebase rules, backend, analytics, A/B testing,
framework adoption, build step, landing redesign, mobile-app shell,
new feature work, new chart types, new asset classes, new ML models,
SEO meta overhaul (app is behind auth).

## 15. Follow-ups (next sessions)

- **Landing redesign** on top of `css/system.css`. Apply the same
  loosening (green accent, 8 px radius, Inter body, Fraunces titles).
  The earlier landing mockup (`mockup.html`) is now stylistically
  out-of-date and should be redone after the app ships.
- **Delete** `styles.css`, `design-upgrade.css`,
  `design-upgrade-additions.css`, `mobile.css`, `loading-states.css`,
  `app.old.html`, `index.old.html` after the landing spec ships.
- **Holdings drill-down panel** (if the link-to-anchor proves
  insufficient): a dedicated drawer or panel showing all 24 assets
  with crypto/stocks/gold subsection filters.
- **Smart quick-add v2:** auto-suggest tickers as you type;
  ambiguity-resolution UI; voice input.
- **Mobile bottom nav** for the 3 tabs (better mobile ergonomics than
  the top-nav tabs).
