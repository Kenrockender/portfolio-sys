# PDF Export Redesign — Design Spec

**Date:** 2026-05-29
**Status:** Approved (verbal "gas semuanya"); revisions to follow during review of the built output.

## Problem

The current PDF export (`exportPdf()` in `js/import-export.js`) draws everything by
hand with jsPDF vector primitives: plain black text on white, a grey table header,
no charts, no color. The user finds it "kaku, kurang warna, membosankan" (rigid,
colourless, boring) and wants something impressive enough to **share / show off**.

## Decisions (from brainstorming)

- **Purpose:** shareable / show-off report (not just a personal archive).
- **Content:** total value + allocation donut, profit/loss (P/L) with green/red,
  and a full holdings detail table. (No value-over-time line chart.)
- **Visual direction:** **"Terminal"** — dark theme matching the app
  (bg `#0c0d0b`, signal green `#34d399`, Syne + JetBrains Mono fonts, per-category
  accent colors). Always dark regardless of the app's current light/dark theme,
  for consistent "showable" output.
- **Render method:** **HTML → html2canvas → jsPDF**. Build a styled offscreen HTML
  report, rasterize at 2× scale, embed into an A4 PDF. Pixel-perfect to the mockup,
  one-click download. Trade-off accepted: text is rasterized (not selectable),
  slightly larger file.

## Architecture & data flow

Replace `exportPdf()` in `js/import-export.js`:

1. Build a report DOM tree in an offscreen container (`#pdfReport`, fixed off-screen,
   fixed width ~794px = A4 @96dpi). Scoped CSS injected once.
2. Populate from existing engine — **no dummy data**:
   - `totals()` → category values `{c, g, k, sv, t}`.
   - `computeMetrics(T)` → per-category + total `{cost, val, pnl, ret}`.
   - `assetMetrics(type, item)` per holding → `{cost, val, pnl, ret}`.
   - Number/format via `window.psys.i18n` helpers: `fmtIDR` (with `compact`),
     `fmtPct`, `fmtDeltaIDR`, `fmtDate`, `fmtTime`.
3. `await document.fonts.ready` so Syne/JetBrains Mono render in the snapshot.
4. `html2canvas(container, { scale: 2, backgroundColor: '#0c0d0b' })`.
5. Add canvas to jsPDF A4. If the image is taller than one page, slice it across
   multiple pages (standard height-offset loop).
6. `doc.save('portfolio-report-YYYY-MM-DD.pdf')`; then remove the offscreen node.

**Libraries (lazy-loaded on PDF click only):**
- `jsPDF` 2.5.1 (already used).
- `html2canvas` 1.4.1 (~50KB) via CDN, added to the existing `loadScript` cache.

The Export modal's PDF button already calls `exportPdf()` — no wiring change.

## Report layout ("Terminal", top → bottom)

1. **Header** — `PORTFOLIO.SYS` (mono, green) · title `Laporan Holdings` / `Holdings
   Report` (Syne) · date+time · `SNAPSHOT` badge.
2. **Hero card** — dark gradient: Total value (large) + Total P/L (green/red, % and
   ▲/▼).
3. **Four category cards** — Kripto / Saham / Emas / Tabungan, each with a colored
   accent bar, value, and P/L%. Accent colors: crypto `#f5c518`, stocks `#22d3ee`,
   gold `#d4a017`, savings `#a78bfa`.
4. **Allocation panel** — SVG donut (stroke-dasharray segments) + legend
   (name, value, %) in the same category colors.
5. **Holdings table** — every asset: Aset · Jumlah · Modal · Nilai · P/L%.
   P/L green/red. Multi-page if long.
6. **Footer** — `GENERATED — PORTFOLIO.SYS` + page number.

### Rules

- Holdings without a cost basis (e.g. savings) show P/L as "—" (not computed),
  to avoid misleading 0%/100% figures.
- Up = `#a3e635`, down = `#f87171`, signal = `#34d399`.
- Report is always dark "Terminal" theme regardless of app theme.

## Out of scope

- Value-over-time line chart.
- Light/editorial/vibrant variants (mockups A and C in `pdf-mockup.html`).
- Selectable/searchable PDF text (consequence of the raster approach).

## Files touched

- `js/import-export.js` — rewrite `exportPdf()`, add `html2canvas` lazy loader +
  report builder + CSS.
- `sw.js` — bump cache version.
- `pdf-mockup.html` — temporary brainstorming artifact (can be deleted after).
