/**
 * parsers/savings.js
 * ─────────────────────────────────────────────────────────────────
 * Parser untuk data Saving Account / Tabungan / Deposito.
 *
 * ★ PERUBAHAN SPEC: field "dividendsReceived" DIHAPUS dari output.
 *   Savings tidak memiliki "dividen" — hanya annualYield (% p.a.).
 *
 * RETURN FORMAT:
 *   {
 *     type       : 'savings',
 *     name       : string,
 *     bank       : string,
 *     currency   : string,   // 'IDR', 'USD', dll
 *     foreignAmt : number,   // saldo dalam currency asli
 *     idr        : number,   // ekuivalen IDR (dihitung saat import)
 *     annualYield: number,   // yield % p.a. (opsional, default 0)
 *     note       : string,   // opsional
 *     date       : string,   // YYYY-MM-DD
 *   }
 *
 * NOTE: TIDAK ADA dividendsReceived — sudah dihapus sesuai spec.
 */

import { parseIdrNum, parseUsdNum, parseDate } from "./parser-utils.js";

// ── Nama bank yang dikenal ────────────────────────────────────────
const KNOWN_BANKS = {
  bca: "bca", bank_central_asia: "bca", "bank bca": "bca",
  bri: "bri", bank_rakyat: "bri", "bank bri": "bri",
  bni: "bni", "bank negara": "bni",
  mandiri: "mandiri", "bank mandiri": "mandiri",
  ocbc: "ocbc", "ocbc nisp": "ocbc",
  krom: "krom", "bank krom": "krom",
  btpn: "btpn", jenius: "jenius",
  permata: "permata", "bank permata": "permata",
  danamon: "danamon",
  cimb: "cimb", "cimb niaga": "cimb",
};

/**
 * Resolve nama bank dari string bebas.
 * @param {string} raw
 * @returns {string}
 */
function resolveBank(raw = "") {
  const lower = raw.toLowerCase().trim();
  return KNOWN_BANKS[lower] ?? lower.split(" ")[0] ?? "other";
}

/**
 * Deteksi kode mata uang dari string.
 * @param {string} str
 * @returns {string}
 */
function detectCurrency(str = "") {
  const match = str.toUpperCase().match(/\b(IDR|USD|SGD|AUD|EUR|GBP|JPY|CNH|CHF|CAD|NZD|HKD)\b/);
  return match ? match[1] : "IDR";
}

// ════════════════════════════════════════════════════════════════
//  PARSER — GENERIC (manual entry / rekening koran)
//  Format bebas yang bisa diketik manual oleh user
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @param {{ usdIdr?: number, fxRates?: Record<string,number> }} [opts]
 * @returns {ParsedSavings[]}
 * @throws {Error}
 */
function parseSavingsGeneric(raw, opts = {}) {
  const results = [];
  const { usdIdr = 16_200, fxRates = { IDR: 1, USD: 16_200, SGD: 12_000 } } = opts;

  try {
    const lines = raw.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Format: "BCA Tabungan | IDR | 45000000 | 1.5% | 2024-01-10"
      if (line.includes("|")) {
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length >= 3) {
          const name       = parts[0];
          const currency   = detectCurrency(parts[1]);
          const foreignAmt = parseIdrNum(parts[2]);
          const yield_     = parts[3] ? parseFloat(parts[3].replace("%", "")) : 0;
          const date       = parseDate(parts[4] ?? "");
          const rate       = fxRates[currency] ?? usdIdr;
          const idr        = Math.round(foreignAmt * rate);

          if (foreignAmt > 0) {
            results.push({
              type:        "savings",
              name,
              bank:        resolveBank(name),
              currency,
              foreignAmt,
              idr,
              annualYield: isNaN(yield_) ? 0 : yield_,
              note:        "",
              date,
            });
          }
        }
        continue;
      }

      // Format: "BCA 45,000,000 IDR"
      const bankBalRe = /^([A-Za-z\s]+?)\s+([\d.,]+)\s*(IDR|USD|SGD|AUD|EUR|GBP|JPY)/i;
      const m = line.match(bankBalRe);
      if (m) {
        const name       = m[1].trim();
        const foreignAmt = parseIdrNum(m[2]);
        const currency   = m[3].toUpperCase();
        const rate       = fxRates[currency] ?? usdIdr;
        const idr        = Math.round(foreignAmt * rate);
        const date       = parseDate(lines[i + 1] ?? "");

        if (foreignAmt > 0) {
          results.push({
            type:        "savings",
            name,
            bank:        resolveBank(name),
            currency,
            foreignAmt,
            idr,
            annualYield: 0,
            note:        "",
            date,
          });
        }
      }
    }
  } catch (err) {
    console.error("[parser/savings] parseSavingsGeneric error:", err);
    throw new Error(`parseSavingsGeneric gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  PARSER — CSV Export (e.g. dari rekening koran digital)
//  Format: name,bank,currency,balance,yield,date
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @param {{ usdIdr?: number, fxRates?: Record<string,number> }} [opts]
 * @returns {ParsedSavings[]}
 * @throws {Error}
 */
function parseSavingsCSV(raw, opts = {}) {
  const results = [];
  const { usdIdr = 16_200, fxRates = { IDR: 1, USD: 16_200 } } = opts;

  try {
    const lines = raw.split(/[\r\n]+/).filter(Boolean);
    const headerIdx = lines.findIndex((l) =>
      /name/i.test(l) && /bank/i.test(l) && /currency/i.test(l)
    );
    const dataLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines;

    for (const line of dataLines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length < 4) continue;

      const [name, bank, currency, balRaw, yieldRaw, dateRaw, noteRaw] = cols;
      const foreignAmt = parseIdrNum(balRaw);
      if (!name || foreignAmt <= 0) continue;

      const rate = fxRates[currency?.toUpperCase()] ?? usdIdr;
      const idr  = Math.round(foreignAmt * rate);

      results.push({
        type:        "savings",
        name,
        bank:        resolveBank(bank),
        currency:    currency?.toUpperCase() ?? "IDR",
        foreignAmt,
        idr,
        annualYield: yieldRaw ? parseFloat(yieldRaw.replace("%", "")) || 0 : 0,
        note:        noteRaw ?? "",
        date:        parseDate(dateRaw),
      });
    }
  } catch (err) {
    console.error("[parser/savings] parseSavingsCSV error:", err);
    throw new Error(`parseSavingsCSV gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  EXPORT — Rule Map
// ════════════════════════════════════════════════════════════════

export const SAVINGS_PARSERS = {
  "savings-generic": {
    label:    "Tabungan (Format Bebas)",
    category: "savings",
    hint: `Format dengan pipe (|) atau nama bank + saldo:

Contoh:
BCA Tabungan | IDR | 45000000 | 1.5% | 2024-01-10
BCA 45,000,000 IDR
USD Savings 1550 USD

★ Catatan: "Dividen Diterima" tidak diperlukan di sini.
   Gunakan kolom Yield (% p.a.) untuk return tahunan.`,
    parse: parseSavingsGeneric,
  },

  "savings-csv": {
    label:    "Tabungan CSV",
    category: "savings",
    hint: `Format CSV: name,bank,currency,balance,yield%,date,note

Contoh:
name,bank,currency,balance,yield,date,note
BCA Tabungan,bca,IDR,45000000,1.5%,2024-01-10,
Krom Deposito,krom,IDR,10000000,6.0%,2024-01-05,6% p.a.
USD Savings,bca,USD,1550,4.5%,2024-02-20,`,
    parse: parseSavingsCSV,
  },
};

/**
 * Jalankan parser savings berdasarkan sourceKey.
 * @param {string} sourceKey
 * @param {string} rawText
 * @param {object} [opts]
 * @returns {ParsedSavings[]}
 * @throws {Error}
 */
export function runSavingsParser(sourceKey, rawText, opts = {}) {
  const rule = SAVINGS_PARSERS[sourceKey];
  if (!rule) {
    throw new Error(`Parser savings tidak dikenal: "${sourceKey}".`);
  }
  console.info(`[parser/savings] Menjalankan "${rule.label}" pada ${rawText.length} karakter`);
  return rule.parse(rawText.replace(/\r\n/g, "\n").trim(), opts);
}

/**
 * Kembalikan semua rule metadata untuk UI.
 * @returns {Array<{key: string, label: string, hint: string}>}
 */
export function getSavingsParserMeta() {
  return Object.entries(SAVINGS_PARSERS).map(([key, rule]) => ({
    key,
    label:  rule.label,
    hint:   rule.hint,
  }));
}
