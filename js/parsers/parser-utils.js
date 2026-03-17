/**
 * parsers/parser-utils.js
 * ─────────────────────────────────────────────────────────────────
 * Helper functions yang dipakai bersama oleh semua parser.
 * Import dari sini, bukan duplikat di masing-masing file.
 */

// ── Coin name lookup ─────────────────────────────────────────────
export const COIN_NAMES = {
  BTC:  "Bitcoin",       ETH:  "Ethereum",      XRP:  "XRP",
  SOL:  "Solana",        ADA:  "Cardano",        DOT:  "Polkadot",
  MATIC:"Polygon",       BNB:  "BNB",            DOGE: "Dogecoin",
  AVAX: "Avalanche",     LINK: "Chainlink",      UNI:  "Uniswap",
  ATOM: "Cosmos",        LTC:  "Litecoin",       SHIB: "Shiba Inu",
  NEAR: "NEAR Protocol", TRX:  "TRON",           USDT: "Tether",
  USDC: "USD Coin",      DAI:  "DAI",            OP:   "Optimism",
  ARB:  "Arbitrum",      APT:  "Aptos",          SUI:  "Sui",
};

export const CRYPTO_COINS = Object.keys(COIN_NAMES).join("|");

/**
 * Parse angka IDR (format Indonesia: 1.234.567 atau 1,234,567).
 * @param {string|number} str
 * @returns {number}
 */
export function parseIdrNum(str) {
  if (str == null) return 0;
  const s = String(str).trim().replace(/\s/g, "");

  if (s.includes(".") && s.includes(",")) {
    const dotPos   = s.lastIndexOf(".");
    const commaPos = s.lastIndexOf(",");
    if (commaPos > dotPos) {
      // IDR style: 1.234,56 → decimal = comma
      return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      // US style: 1,234.56 → decimal = dot
      return parseFloat(s.replace(/,/g, "")) || 0;
    }
  }

  if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2) return parseFloat(s.replace(/\./g, "")) || 0;  // 1.234.567
    if (parts[parts.length - 1].length === 3) return parseFloat(s.replace(/\./g, "")) || 0; // 1.234
    return parseFloat(s) || 0;
  }

  if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length > 2) return parseFloat(s.replace(/,/g, "")) || 0;
    if (parts[parts.length - 1].length === 3) return parseFloat(s.replace(/,/g, "")) || 0;
    return parseFloat(s.replace(",", ".")) || 0;
  }

  return parseFloat(s) || 0;
}

/**
 * Parse angka USD (US format: 1,234.56).
 * @param {string|number} str
 * @returns {number}
 */
export function parseUsdNum(str) {
  if (str == null) return 0;
  const s = String(str).trim().replace(/[$,\s]/g, "");
  return parseFloat(s) || 0;
}

/**
 * Parse berbagai format tanggal menjadi YYYY-MM-DD.
 * @param {string} str
 * @returns {string}
 */
export function parseDate(str) {
  if (!str) return new Date().toISOString().split("T")[0];
  const s = String(str).trim();

  // ISO: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY atau DD-MM-YYYY
  const dmy = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  // "12 Mar 2024" / "12 Maret 2024"
  const MONTHS = {
    jan:"01",feb:"02",mar:"03",apr:"04",mei:"05",may:"05",jun:"06",
    jul:"07",agu:"08",aug:"08",sep:"09",okt:"10",oct:"10",nov:"11",
    des:"12",dec:"12",maret:"03",april:"04",agustus:"08",oktober:"10",
    desember:"12",januari:"01",februari:"02",juni:"06",juli:"07",
    september:"09",november:"11",
  };
  const dmonth = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (dmonth) {
    const m = MONTHS[dmonth[2].toLowerCase()] || "01";
    return `${dmonth[3]}-${m}-${dmonth[1].padStart(2, "0")}`;
  }

  // YYYY/MM/DD
  const ymd = s.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  return new Date().toISOString().split("T")[0];
}
