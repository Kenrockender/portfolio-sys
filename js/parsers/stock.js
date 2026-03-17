/**
 * parsers/stock.js
 * ─────────────────────────────────────────────────────────────────
 * Parser engine untuk data Saham (IDX & US Market).
 *
 * SOURCES DIDUKUNG:
 *   - Bibit     : Riwayat transaksi saham (paste text)
 *   - Stockbit  : Riwayat order (paste text / CSV)
 *   - IndoPremier: Laporan transaksi (paste text)
 *   - Interactive Brokers / IBKR: Activity Statement CSV (US Stocks)
 *   - Generic CSV: Kolom ticker, shares, price, date, market, broker
 *
 * RETURN FORMAT (per item):
 *   {
 *     type        : 'stocks',
 *     ticker      : string,    // e.g. "BBCA", "AAPL"
 *     name        : string,    // Company name (bila tersedia)
 *     shares      : number,    // Lot (IDX) atau shares (US)
 *     seedPrice   : number,    // Harga beli per lembar (IDR untuk IDX, USD untuk US)
 *     market      : 'IDX'|'US',
 *     broker      : string,
 *     date        : string,    // YYYY-MM-DD
 *     annualYield : number,    // default 0
 *   }
 *
 * NOTE: dividendsReceived TIDAK ada di sini — sudah dihapus sesuai spec.
 */

import { parseIdrNum, parseDate, parseUsdNum } from "./parser-utils.js";

// ── IDX Ticker → Nama Perusahaan ─────────────────────────────────
const IDX_NAMES = {
  BBCA: "Bank Central Asia Tbk",    BBRI: "Bank Rakyat Indonesia Tbk",
  BMRI: "Bank Mandiri Tbk",         TLKM: "Telkom Indonesia Tbk",
  ASII: "Astra International Tbk",  UNVR: "Unilever Indonesia Tbk",
  INDF: "Indofood Sukses Makmur",   GGRM: "Gudang Garam Tbk",
  HMSP: "HM Sampoerna Tbk",         EXCL: "XL Axiata Tbk",
  SIDO: "Industri Jamu Sido Muncul", BUKA: "Bukalapak.com Tbk",
  GOTO: "GoTo Gojek Tokopedia Tbk", EMTK: "Elang Mahkota Teknologi Tbk",
};

// ── US Ticker → Nama Perusahaan ──────────────────────────────────
const US_NAMES = {
  AAPL: "Apple Inc.",          MSFT: "Microsoft Corp.",
  NVDA: "NVIDIA Corp.",        GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",     META: "Meta Platforms Inc.",
  TSLA: "Tesla Inc.",          AVGO: "Broadcom Inc.",
  BRK:  "Berkshire Hathaway",  JPM:  "JPMorgan Chase & Co.",
  V:    "Visa Inc.",           UNH:  "UnitedHealth Group",
  XOM:  "Exxon Mobil Corp.",   LLY:  "Eli Lilly and Co.",
  MA:   "Mastercard Inc.",     HD:   "The Home Depot Inc.",
  CVX:  "Chevron Corp.",       MRK:  "Merck & Co. Inc.",
  ABBV: "AbbVie Inc.",         PEP:  "PepsiCo Inc.",
  SPY:  "SPDR S&P 500 ETF",    QQQ:  "Invesco QQQ Trust",
  VTI:  "Vanguard Total Market ETF",
};

/**
 * Resolve nama perusahaan dari ticker.
 * @param {string} ticker
 * @param {"IDX"|"US"} market
 * @returns {string}
 */
function resolveName(ticker, market) {
  const t = ticker.toUpperCase();
  return market === "US"
    ? (US_NAMES[t]  ?? ticker)
    : (IDX_NAMES[t] ?? ticker);
}

/**
 * Deteksi apakah ticker merupakan saham US.
 * Heuristik: ticker tanpa angka, max 5 karakter, bukan IDX pattern.
 * @param {string} ticker
 * @returns {boolean}
 */
function looksLikeUS(ticker) {
  return /^[A-Z]{1,5}$/.test(ticker) && !IDX_NAMES[ticker];
}

// ════════════════════════════════════════════════════════════════
//  PARSER — BIBIT (IDX)
//  Format: "Beli BBCA\n10 Lot\nRp 9.100 / lembar\n15 Jan 2024"
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedStock[]}
 * @throws {Error} jika ada masalah fatal saat parsing
 */
function parseBibit(raw) {
  const results = [];

  try {
    // Pattern: Beli/Sell TICKER \n qty Lot \n Rp price / lembar \n date
    const re = /(?:Beli|Buy)\s+([A-Z]{2,6})\s*[\r\n]+(\d[\d.]*)\s*[Ll]ot\s*[\r\n]+Rp\s*([\d.,]+)\s*\/\s*lembar\s*[\r\n]+([^\r\n]+)/gi;

    for (const m of raw.matchAll(re)) {
      const ticker = m[1].toUpperCase();
      const shares = parseIdrNum(m[2]);    // jumlah lot
      const price  = parseIdrNum(m[3]);    // harga per lembar
      const date   = parseDate(m[4]);

      if (shares > 0 && price > 0) {
        results.push({
          type:        "stocks",
          ticker,
          name:        resolveName(ticker, "IDX"),
          shares,
          seedPrice:   price,
          market:      "IDX",
          broker:      "bibit",
          date,
          annualYield: 0,
        });
      }
    }

    // Fallback: "TICKER qty lot Rp price"
    if (results.length === 0) {
      const re2 = /\b([A-Z]{2,6})\s+(\d+)\s*[Ll]ot\s+Rp\s*([\d.,]+)/gi;
      for (const m of raw.matchAll(re2)) {
        const ticker = m[1].toUpperCase();
        if (ticker === "RP" || ticker === "LOT") continue;
        results.push({
          type:        "stocks",
          ticker,
          name:        resolveName(ticker, "IDX"),
          shares:      parseIdrNum(m[2]),
          seedPrice:   parseIdrNum(m[3]),
          market:      "IDX",
          broker:      "bibit",
          date:        new Date().toISOString().split("T")[0],
          annualYield: 0,
        });
      }
    }
  } catch (err) {
    console.error("[parser/stock] parseBibit error:", err);
    throw new Error(`parseBibit gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  PARSER — STOCKBIT (IDX)
//  Format CSV: ticker,lot,avg_price,date atau paste text
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedStock[]}
 * @throws {Error}
 */
function parseStockbit(raw) {
  const results = [];

  try {
    // CSV: "BBCA,2,9100,2024-01-15"
    const csvRe = /^([A-Z]{2,6}),(\d+),([\d.,]+),(\d{4}-\d{2}-\d{2})/gm;
    for (const m of raw.matchAll(csvRe)) {
      results.push({
        type:        "stocks",
        ticker:      m[1],
        name:        resolveName(m[1], "IDX"),
        shares:      parseIdrNum(m[2]),
        seedPrice:   parseIdrNum(m[3]),
        market:      "IDX",
        broker:      "stockbit",
        date:        m[4],
        annualYield: 0,
      });
    }

    // Text pattern: "Beli BBCA 2 lot @ Rp 9.100"
    if (results.length === 0) {
      const textRe = /(?:Beli|Buy)\s+([A-Z]{2,6})\s+(\d+)\s*lot\s+@\s*Rp\s*([\d.,]+)/gi;
      for (const m of raw.matchAll(textRe)) {
        results.push({
          type:        "stocks",
          ticker:      m[1].toUpperCase(),
          name:        resolveName(m[1].toUpperCase(), "IDX"),
          shares:      parseIdrNum(m[2]),
          seedPrice:   parseIdrNum(m[3]),
          market:      "IDX",
          broker:      "stockbit",
          date:        new Date().toISOString().split("T")[0],
          annualYield: 0,
        });
      }
    }
  } catch (err) {
    console.error("[parser/stock] parseStockbit error:", err);
    throw new Error(`parseStockbit gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  PARSER — IBKR / INTERACTIVE BROKERS (US Stocks)
//  Format: Activity Statement CSV export dari IBKR
//  Kolom: "Trades","Data","BUY/SELL","SYMBOL","Date","Quantity","Price"
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw  — isi CSV Activity Statement IBKR
 * @returns {ParsedStock[]}
 * @throws {Error}
 */
function parseIBKR(raw) {
  const results = [];

  try {
    const lines = raw.split(/[\r\n]+/).filter(Boolean);

    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

      // IBKR format: Trades,Data,BUY,STK,AAPL,2024-01-15,10,185.00,...
      if (cols[0] === "Trades" && cols[1] === "Data" && cols[2] === "BUY") {
        const ticker   = cols[4]?.toUpperCase();
        const date     = parseDate(cols[5]);
        const quantity = Math.abs(parseFloat(cols[6]) || 0);
        const price    = parseUsdNum(cols[7]);

        if (!ticker || quantity <= 0 || price <= 0) continue;

        results.push({
          type:        "stocks",
          ticker,
          name:        resolveName(ticker, "US"),
          shares:      quantity,
          seedPrice:   price,            // USD per share
          market:      "US",
          broker:      "ibkr",
          date,
          annualYield: 0,
        });
      }
    }

    // Fallback: simple CSV "TICKER,SHARES,PRICE_USD,DATE"
    if (results.length === 0) {
      const simpleRe = /^([A-Z]{1,5}),([\d.]+),([\d.]+),(\d{4}-\d{2}-\d{2})/gm;
      for (const m of raw.matchAll(simpleRe)) {
        const ticker = m[1].toUpperCase();
        if (!looksLikeUS(ticker)) continue;
        results.push({
          type:        "stocks",
          ticker,
          name:        resolveName(ticker, "US"),
          shares:      parseUsdNum(m[2]),
          seedPrice:   parseUsdNum(m[3]),
          market:      "US",
          broker:      "other",
          date:        m[4],
          annualYield: 0,
        });
      }
    }
  } catch (err) {
    console.error("[parser/stock] parseIBKR error:", err);
    throw new Error(`parseIBKR gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  PARSER — GENERIC (IDX + US auto-detect)
//  Format: plain text dengan pola "TICKER qty price date"
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedStock[]}
 * @throws {Error}
 */
function parseGenericStock(raw) {
  const results = [];

  try {
    // Pattern: TICKER shares/lot price date (flexible)
    const re = /\b([A-Z]{2,6})\b[^\r\n]*?(\d[\d.,]*)\s*(?:shares?|lot|lbr)\s+(?:[@$Rp\s]*)(\d[\d.,]*)[^\r\n]*?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})/gi;

    for (const m of raw.matchAll(re)) {
      const ticker = m[1].toUpperCase();
      if (["LOT", "SHARES", "BUY", "SELL"].includes(ticker)) continue;

      const isUS     = looksLikeUS(ticker);
      const market   = isUS ? "US" : "IDX";
      const shares   = parseIdrNum(m[2]);
      const price    = isUS ? parseUsdNum(m[3]) : parseIdrNum(m[3]);
      const date     = parseDate(m[4]);

      if (shares > 0 && price > 0) {
        results.push({
          type:        "stocks",
          ticker,
          name:        resolveName(ticker, market),
          shares,
          seedPrice:   price,
          market,
          broker:      "other",
          date,
          annualYield: 0,
        });
      }
    }
  } catch (err) {
    console.error("[parser/stock] parseGenericStock error:", err);
    throw new Error(`parseGenericStock gagal: ${err.message}`);
  }

  return deduplicateParsed(results);
}

// ════════════════════════════════════════════════════════════════
//  DEDUPLICATE  — hapus item duplikat (ticker + shares + price sama)
// ════════════════════════════════════════════════════════════════

function deduplicateParsed(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.ticker}:${item.shares}:${item.seedPrice}:${item.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ════════════════════════════════════════════════════════════════
//  EXPORT — Rule Map (dipakai oleh import engine)
// ════════════════════════════════════════════════════════════════

export const STOCK_PARSERS = {
  bibit: {
    label:    "Bibit (IDX)",
    category: "stocks",
    market:   "IDX",
    hint: `Buka Bibit → Riwayat Transaksi → copy semua teks

Contoh format:
Beli BBCA
2 Lot
Rp 9.100 / lembar
15 Jan 2024`,
    /**
     * @param {string} raw
     * @returns {ParsedStock[]}
     * @throws {Error}
     */
    parse: parseBibit,
  },

  stockbit: {
    label:    "Stockbit (IDX)",
    category: "stocks",
    market:   "IDX",
    hint: `Buka Stockbit → Portofolio → Export CSV, atau copy teks

Contoh CSV:
BBCA,2,9100,2024-01-15
TLKM,5,3850,2024-02-10`,
    parse: parseStockbit,
  },

  ibkr: {
    label:    "IBKR / Interactive Brokers (US)",
    category: "stocks",
    market:   "US",
    hint: `Download Activity Statement dari IBKR (Format: CSV)
Buka file → copy isi baris "Trades,Data,BUY,..."

Contoh baris:
Trades,Data,BUY,STK,AAPL,2024-01-15,10,185.00,USD,...`,
    parse: parseIBKR,
  },

  "generic-stock": {
    label:    "Generic (IDX + US)",
    category: "stocks",
    market:   "BOTH",
    hint: `Format bebas: TICKER jumlah price tanggal

Contoh:
BBCA 2 lot 9100 2024-01-15
AAPL 10 shares 185.00 2024-01-15`,
    parse: parseGenericStock,
  },
};

/**
 * Jalankan parser berdasarkan sourceKey.
 * @param {string} sourceKey  — key dari STOCK_PARSERS
 * @param {string} rawText
 * @returns {ParsedStock[]}
 * @throws {Error} jika sourceKey tidak dikenal
 */
export function runStockParser(sourceKey, rawText) {
  const rule = STOCK_PARSERS[sourceKey];
  if (!rule) {
    throw new Error(`Parser saham tidak dikenal: "${sourceKey}". Tersedia: ${Object.keys(STOCK_PARSERS).join(", ")}`);
  }

  console.info(`[parser/stock] Menjalankan "${rule.label}" pada ${rawText.length} karakter`);

  // Bersihkan raw text dari karakter tidak perlu
  const cleaned = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .trim();

  return rule.parse(cleaned);
}

/**
 * Kembalikan semua rule metadata (label, hint) untuk UI.
 * @returns {Array<{key: string, label: string, market: string, hint: string}>}
 */
export function getStockParserMeta() {
  return Object.entries(STOCK_PARSERS).map(([key, rule]) => ({
    key,
    label:  rule.label,
    market: rule.market,
    hint:   rule.hint,
  }));
}
