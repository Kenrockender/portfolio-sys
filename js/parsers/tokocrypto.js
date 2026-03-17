/**
 * parsers/tokocrypto.js
 * ─────────────────────────────────────────────────────────────────
 * Parser untuk exchange kripto Indonesia:
 *   - Pintu
 *   - Tokocrypto
 *   - Indodax
 *   - Pluang
 *
 * Format input: paste text dari riwayat transaksi masing-masing app.
 *
 * RETURN FORMAT:
 *   { type:'crypto', coin, name, amount, costBasisIdr, platform, date }
 */

import { parseIdrNum, parseDate, COIN_NAMES, CRYPTO_COINS } from "./parser-utils.js";

// ════════════════════════════════════════════════════════════════
//  PINTU
//  Format: "Beli BTC\n12 Mar 2024\n0,005312 BTC\nRp 9.350.000"
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parsePintu(raw) {
  const results = [];

  try {
    // Pattern 1: Beli/Buy COIN \n date \n amount COIN \n Rp total
    const re1 = new RegExp(
      `(?:Beli|Buy)\\s+(${CRYPTO_COINS})\\s*[\\r\\n]+([^\\r\\n]+)[\\r\\n]+([\\d.,]+)\\s*(?:${CRYPTO_COINS})[\\r\\n]+Rp\\s*([\\d.,]+)`,
      "gi"
    );
    for (const m of raw.matchAll(re1)) {
      const coin = m[1].toUpperCase();
      results.push({
        type:         "crypto",
        coin,
        name:         COIN_NAMES[coin] ?? coin,
        amount:       parseIdrNum(m[3]),
        costBasisIdr: parseIdrNum(m[4]),
        platform:     "pintu",
        date:         parseDate(m[2]),
      });
    }

    // Pattern 2: simpler "COIN amount Rp total"
    if (results.length === 0) {
      const re2 = new RegExp(
        `(${CRYPTO_COINS})\\s+([\\d.,]+)\\s*(?:${CRYPTO_COINS})?\\s*[\\r\\n]*Rp\\s*([\\d.,]+)`,
        "gi"
      );
      for (const m of raw.matchAll(re2)) {
        const coin   = m[1].toUpperCase();
        const amount = parseIdrNum(m[2]);
        // deduplicate
        const exists = results.find(
          (r) => r.coin === coin && Math.abs(r.amount - amount) < 0.0001
        );
        if (!exists) {
          results.push({
            type:         "crypto",
            coin,
            name:         COIN_NAMES[coin] ?? coin,
            amount,
            costBasisIdr: parseIdrNum(m[3]),
            platform:     "pintu",
            date:         new Date().toISOString().split("T")[0],
          });
        }
      }
    }
  } catch (err) {
    console.error("[parser/tokocrypto] parsePintu error:", err);
    throw new Error(`parsePintu gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  TOKOCRYPTO
//  Format: "BUY BTC/IDR\nQty: 0.005\nTotal: Rp 9.500.000\n2024-01-15"
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parseTokocrypto(raw) {
  const results = [];

  try {
    // Pattern: BUY COIN/IDR \n Qty: amount \n Total: Rp price \n date
    const re = new RegExp(
      `(?:BUY|BELI)\\s+(${CRYPTO_COINS})\\/IDR[^\\r\\n]*[\\r\\n]+Qty:\\s*([\\d.,]+)[^\\r\\n]*[\\r\\n]+Total:\\s*Rp\\s*([\\d.,]+)[^\\r\\n]*[\\r\\n]+([^\\r\\n]+)`,
      "gi"
    );
    for (const m of raw.matchAll(re)) {
      const coin = m[1].toUpperCase();
      results.push({
        type:         "crypto",
        coin,
        name:         COIN_NAMES[coin] ?? coin,
        amount:       parseIdrNum(m[2]),
        costBasisIdr: parseIdrNum(m[3]),
        platform:     "tokocrypto",
        date:         parseDate(m[4]),
      });
    }

    // Fallback: CSV style "BTC,0.005,9500000,2024-01-15"
    if (results.length === 0) {
      const csvRe = new RegExp(`(${CRYPTO_COINS}),([\\d.]+),([\\d.]+),(\\d{4}-\\d{2}-\\d{2})`, "gi");
      for (const m of raw.matchAll(csvRe)) {
        const coin = m[1].toUpperCase();
        results.push({
          type:         "crypto",
          coin,
          name:         COIN_NAMES[coin] ?? coin,
          amount:       parseIdrNum(m[2]),
          costBasisIdr: parseIdrNum(m[3]),
          platform:     "tokocrypto",
          date:         m[4],
        });
      }
    }
  } catch (err) {
    console.error("[parser/tokocrypto] parseTokocrypto error:", err);
    throw new Error(`parseTokocrypto gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  INDODAX
//  Format: "BTC/IDR Buy\nRp 43.250.000  0.005 BTC\n15 Jan 2024"
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parseIndodax(raw) {
  const results = [];

  try {
    const re = new RegExp(
      `(${CRYPTO_COINS})\\/IDR\\s+(?:Buy|Beli)[^\\r\\n]*[\\r\\n]+Rp\\s*([\\d.,]+)\\s+([\\d.,]+)\\s*(?:${CRYPTO_COINS})\\s*[\\r\\n]+([\\d\\s\\/A-Za-z]+)`,
      "gi"
    );
    for (const m of raw.matchAll(re)) {
      const coin = m[1].toUpperCase();
      results.push({
        type:         "crypto",
        coin,
        name:         COIN_NAMES[coin] ?? coin,
        amount:       parseIdrNum(m[3]),
        costBasisIdr: parseIdrNum(m[2]),
        platform:     "indodax",
        date:         parseDate(m[4]),
      });
    }

    // Fallback: "Buy BTC IDR total_idr qty_btc"
    if (results.length === 0) {
      const re2 = new RegExp(
        `(?:Buy|Beli)\\s+(${CRYPTO_COINS})\\s+IDR\\s+([\\d.,]+)\\s+([\\d.,]+)`,
        "gi"
      );
      for (const m of raw.matchAll(re2)) {
        const coin = m[1].toUpperCase();
        results.push({
          type:         "crypto",
          coin,
          name:         COIN_NAMES[coin] ?? coin,
          amount:       parseIdrNum(m[3]),
          costBasisIdr: parseIdrNum(m[2]),
          platform:     "indodax",
          date:         new Date().toISOString().split("T")[0],
        });
      }
    }
  } catch (err) {
    console.error("[parser/tokocrypto] parseIndodax error:", err);
    throw new Error(`parseIndodax gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  PLUANG
//  Format: "Beli Bitcoin (BTC)\nRp 9.350.000\n0.005312 BTC\n12 Mar 2024"
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parsePluang(raw) {
  const results = [];

  try {
    // Pattern: Beli Coin (SYMBOL) \n Rp total \n amount COIN \n date
    const re = new RegExp(
      `(?:Beli|Buy)\\s+[^\\r\\n]*\\((${CRYPTO_COINS})\\)[\\r\\n]+Rp\\s*([\\d.,]+)[\\r\\n]+([\\d.,]+)\\s*(?:${CRYPTO_COINS})[\\r\\n]+([^\\r\\n]+)`,
      "gi"
    );
    for (const m of raw.matchAll(re)) {
      const coin = m[1].toUpperCase();
      results.push({
        type:         "crypto",
        coin,
        name:         COIN_NAMES[coin] ?? coin,
        amount:       parseIdrNum(m[3]),
        costBasisIdr: parseIdrNum(m[2]),
        platform:     "pluang",
        date:         parseDate(m[4]),
      });
    }
  } catch (err) {
    console.error("[parser/tokocrypto] parsePluang error:", err);
    throw new Error(`parsePluang gagal: ${err.message}`);
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  INDODAX TAX REPORT
//  Format: PDF "Final Tax Collection Slip" dari Indodax
//  Copy-paste seluruh isi PDF — parser akan extract semua transaksi.
//
//  Kolom yang diparsing:
//    Tanggal  | TX_ID | ASSET/IDR | Buy/Sell | Price(IDR) | CoinAmount
//
//  Logika agregasi:
//    - Hitung net amount per koin (total buy - total sell)
//    - Weighted average cost basis dari semua transaksi Buy
//    - Hanya return koin dengan net amount > 0 (masih dipegang)
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parseIndodaxTaxReport(raw) {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // pdf.js menggabungkan semua teks per baris Y menjadi satu string.
  // Format aktual dari pdf.js:
  //   "11-01-2024 72057594051914875 BTC/IDR Buy 729,994,000 0.00314058 2,292,604 - 2,521 - 23:00"
  // Format dari pdfplumber/copy-paste:
  //   "11-01-2024"
  //   "72057594051914875 BTC/IDR Buy 729,994,000 0.00314058 ..."
  //
  // Regex yang menangani kedua format:
  // Pola 1: DD-MM-YYYY diikuti langsung txid + data (pdf.js)
  // Pola 2: txid di awal baris (copy-paste), dengan lastDate dari baris sebelumnya

  const DATE_RE   = /^(\d{2}-\d{2}-\d{4})$/;
  // Pola 1: tanggal + txid + data dalam satu baris
  const FULL_RE   = /(\d{2}-\d{2}-\d{4})\s+\d+\s+([A-Z]+)\/IDR\s+(Buy|Sell)\s+([\d,]+)\s+([\d.]+)/gi;
  // Pola 2: hanya txid + data (tanggal sudah di lastDate)
  const DATA_RE   = /^\d{10,}\s+([A-Z]+)\/IDR\s+(Buy|Sell)\s+([\d,]+)\s+([\d.]+)/i;

  const coinMap = new Map();
  let lastDate  = "";

  for (const line of lines) {
    // Coba pola 1 dulu (pdf.js format — date+data dalam satu baris)
    const fullMatches = [...line.matchAll(FULL_RE)];
    if (fullMatches.length > 0) {
      for (const m of fullMatches) {
        _addTx(coinMap, m[2], m[3], m[4], m[5], m[1]);
      }
      continue;
    }

    // Tangkap baris tanggal berdiri sendiri (copy-paste format)
    const dm = line.match(DATE_RE);
    if (dm) { lastDate = dm[1]; continue; }

    // Pola 2: baris data saja
    const tm = line.match(DATA_RE);
    if (tm && lastDate) {
      _addTx(coinMap, tm[1], tm[2], tm[3], tm[4], lastDate);
    }
  }

  if (coinMap.size === 0) {
    throw new Error(
      "Tidak ada transaksi yang berhasil diparsing.\n\n" +
      "Pastikan file yang diupload adalah PDF Tax Report dari Indodax."
    );
  }

  const results = [];
  for (const [coin, entry] of coinMap) {
    const netAmount = entry.buyAmount - entry.sellAmount;
    if (netAmount <= 0.000001) continue;
    const avgBuyPrice  = entry.buyAmount > 0 ? entry.buyValue / entry.buyAmount : 0;
    const costBasisIdr = Math.round(netAmount * avgBuyPrice);
    const dateParts    = entry.firstDate.split("-");
    const dateISO      = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    results.push({
      type: "crypto", coin, name: COIN_NAMES[coin] ?? coin,
      amount: Math.round(netAmount * 1e8) / 1e8,
      costBasisIdr, platform: "indodax", date: dateISO,
    });
  }
  return results;
}

function _addTx(coinMap, coin, type, priceStr, amtStr, dateStr) {
  coin  = coin.toUpperCase();
  type  = type.toLowerCase();
  const price   = parseIdrNum(priceStr);
  const coinAmt = parseFloat(amtStr) || 0;
  if (!coin || coinAmt <= 0 || price <= 0) return;
  if (!coinMap.has(coin)) coinMap.set(coin, { buyAmount:0, buyValue:0, sellAmount:0, firstDate: dateStr });
  const entry = coinMap.get(coin);
  if (type === "buy") {
    entry.buyAmount += coinAmt;
    entry.buyValue  += coinAmt * price;
    if (_parseDMY(dateStr) < _parseDMY(entry.firstDate)) entry.firstDate = dateStr;
  } else {
    entry.sellAmount += coinAmt;
  }
}

/** Parse DD-MM-YYYY → Date */
function _parseDMY(str) {
  const [d, m, y] = str.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}

// ════════════════════════════════════════════════════════════════
//  PLUANG — Transaction Report CSV
//  Format: Export dari Pluang → Transaction History Report
//
//  Kolom (0-indexed):
//    0  Order Date     "Fri, Mar 14, 2025"
//    1  Order Time
//    2  Order Number
//    3  Transaction    "Crypto"
//    4  Transaction Type "BUY" | "SELL" | "YIELD"
//    5  Product Name   "BTC" | "ETH" | ...
//    8  Status         "SUCCESS" | "COMPLETED"
//    10 Order Price    harga per koin (IDR)
//    12 Quantity       jumlah koin
//    15 Total Amount   total IDR
//
//  Logika:
//    - Hanya proses BUY & SELL (skip YIELD, SWAP, dll)
//    - Hanya status SUCCESS/COMPLETED
//    - Agregasi net amount + weighted avg cost basis per koin
//    - Skip koin yang sudah habis dijual (net ≤ 0)
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw  — isi file CSV dari Pluang
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parsePluangCSV(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").filter(Boolean);

  // Cari baris header yang mengandung "Order Date"
  const headerIdx = lines.findIndex(l => l.includes("Order Date") && l.includes("Transaction"));
  if (headerIdx < 0) {
    throw new Error(
      "Format CSV tidak dikenal.\n\n" +
      "Pastikan file yang diupload adalah Transaction History Report dari Pluang " +
      "(bukan Tax Report PDF).\nDownload dari Pluang → Akun → Riwayat Transaksi → Export CSV"
    );
  }

  const dataLines = lines.slice(headerIdx + 1);
  const coinMap   = new Map(); // coin → { buyAmount, buyValue, sellAmount, firstDate }

  for (const line of dataLines) {
    // Parse CSV dengan benar (handle quoted fields)
    const cols = _parseCSVLine(line);
    if (cols.length < 16) continue;

    const dateStr  = cols[0].replace(/"/g, "").trim();  // "Fri, Mar 14, 2025"
    const txType   = cols[4].replace(/"/g, "").trim().toUpperCase();
    const coin     = cols[5].replace(/"/g, "").trim().toUpperCase();
    const status   = cols[8].replace(/"/g, "").trim().toUpperCase();
    const price    = parseFloat(cols[10].replace(/"/g, "")) || 0;
    const qty      = parseFloat(cols[12].replace(/"/g, "")) || 0;

    // Hanya BUY & SELL yang berhasil
    if (!["BUY", "SELL"].includes(txType)) continue;
    if (!["SUCCESS", "COMPLETED"].includes(status)) continue;
    if (!coin || qty <= 0 || price <= 0) continue;

    if (!coinMap.has(coin)) {
      coinMap.set(coin, { buyAmount: 0, buyValue: 0, sellAmount: 0, firstDate: dateStr });
    }
    const entry = coinMap.get(coin);

    if (txType === "BUY") {
      entry.buyAmount += qty;
      entry.buyValue  += qty * price;
      // Simpan tanggal pembelian paling awal
      if (_parseLocaleDate(dateStr) < _parseLocaleDate(entry.firstDate)) {
        entry.firstDate = dateStr;
      }
    } else {
      entry.sellAmount += qty;
    }
  }

  if (coinMap.size === 0) {
    throw new Error(
      "Tidak ada transaksi BUY/SELL yang ditemukan.\n\n" +
      "Pastikan file CSV mengandung kolom 'Transaction Type' dengan nilai BUY atau SELL."
    );
  }

  const results = [];
  for (const [coin, entry] of coinMap) {
    const netAmount = entry.buyAmount - entry.sellAmount;
    if (netAmount <= 0.000001) continue;

    const avgBuyPrice  = entry.buyAmount > 0 ? entry.buyValue / entry.buyAmount : 0;
    const costBasisIdr = Math.round(netAmount * avgBuyPrice);

    results.push({
      type:         "crypto",
      coin,
      name:         COIN_NAMES[coin] ?? coin,
      amount:       Math.round(netAmount * 1e8) / 1e8,
      costBasisIdr,
      platform:     "pluang",
      date:         _parseLDtoISO(entry.firstDate),
    });
  }

  return results;
}

/**
 * Parse satu baris CSV dengan benar (handle quoted fields dengan koma di dalamnya).
 */
function _parseCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === "," && !inQ) { result.push(cur); cur = ""; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

/**
 * Parse "Fri, Mar 14, 2025" → Date
 */
const MONTH_MAP = {
  Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
  Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12
};
function _parseLocaleDate(str) {
  // "Fri, Mar 14, 2025" → bagian setelah koma pertama: " Mar 14, 2025"
  const parts = str.replace(/^[A-Za-z]+,\s*/, "").split(/[\s,]+/).filter(Boolean);
  // parts: ["Mar", "14", "2025"]
  if (parts.length < 3) return new Date(0);
  const m = MONTH_MAP[parts[0]] || 1;
  return new Date(parseInt(parts[2]), m - 1, parseInt(parts[1]));
}

function _parseLDtoISO(str) {
  const d = _parseLocaleDate(str);
  if (!d || isNaN(d)) return new Date().toISOString().split("T")[0];
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ════════════════════════════════════════════════════════════════
//  FLOQ — Laporan Pajak Aset Kripto (PDF)
//  Format: "Laporan Pajak Aset Kripto" dari PT Kripto Maksima Koin
//
//  Baris transaksi:
//    UUID  YYYY-MM-DD  BUY/SELL  COIN  RpX.XXX.XXX  tarif%  RpPajak
//
//  Catatan: PDF hanya mencantumkan total IDR per transaksi,
//  TIDAK ada jumlah koin. Parser akan:
//  • Agregasi total IDR beli per koin → costBasisIdr
//  • Set amount = 0 (perlu diisi manual setelah import)
//  • Skip transaksi SELL
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parseFloqTaxReport(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);

  // Regex untuk baris transaksi Floq:
  // UUID  YYYY-MM-DD  BUY/SELL  COIN  Rp angka
  // UUID: format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const TX_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s+(\d{4}-\d{2}-\d{2})\s+(BUY|SELL)\s+([A-Z]+)\s+Rp([\d.,]+)/i;

  const coinMap = new Map(); // coin → { totalIdr, firstDate }

  for (const line of lines) {
    const m = line.match(TX_RE);
    if (!m) continue;

    const date   = m[1];                    // YYYY-MM-DD
    const type   = m[2].toUpperCase();
    const coin   = m[3].toUpperCase();
    const idr    = parseIdrNum(m[4]);

    if (type !== "BUY" || idr <= 0) continue;

    if (!coinMap.has(coin)) {
      coinMap.set(coin, { totalIdr: 0, firstDate: date });
    }
    const entry = coinMap.get(coin);
    entry.totalIdr += idr;
    if (date < entry.firstDate) entry.firstDate = date;
  }

  if (coinMap.size === 0) {
    throw new Error(
      "Tidak ada transaksi BUY yang berhasil diparsing.\n\n" +
      "Pastikan kamu copy-paste seluruh isi PDF (Ctrl+A → Ctrl+C) " +
      "dari Laporan Pajak Floq."
    );
  }

  const results = [];
  for (const [coin, entry] of coinMap) {
    results.push({
      type:         "crypto",
      coin,
      name:         COIN_NAMES[coin] ?? coin,
      amount:       0,            // ⚠ tidak tersedia di PDF — isi manual
      costBasisIdr: Math.round(entry.totalIdr),
      platform:     "floq",
      date:         entry.firstDate,
    });
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  TOKOCRYPTO — Ringkasan Pemotongan Pajak PDF
//  Format: "Ringkasan Pemotongan Pajak" dari PT Aset Digital Berkat
//
//  Kolom per baris transaksi:
//    Waktu (YYYY-MM-DD HH:MM:SS)
//    ID Transaksi (angka + (S)/(C))
//    Nama Aset (COIN_IDR atau COIN_USDT)
//    Jenis Transaksi (Buy / Sell)
//    Harga (IDR)
//    Jumlah Koin
//    Nominal Transaksi
//    ...sisa kolom pajak
//
//  Logika:
//    - Extract ticker dari "ONDO_IDR" → "ONDO", "XRP_IDR" → "XRP"
//    - Agregasi net amount + weighted avg cost per koin
//    - Skip SELL dan koin net ≤ 0
// ════════════════════════════════════════════════════════════════

/**
 * @param {string} raw
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
function parseTokocryptoTaxReport(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);

  // Baris transaksi: diawali timestamp YYYY-MM-DD
  // Contoh: "2025-06-11 14:41:46 512245697 (S) ONDO_IDR Buy 14.686,799 6,8 99.870,23 ..."
  // atau setelah PDF copy bisa terpisah — kita gabungkan dulu
  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\d{4}-\d{2}-\d{2}/.test(lines[i])) {
      // Gabungkan dengan baris berikutnya jika baris berikutnya bukan timestamp
      let combined = lines[i];
      while (i + 1 < lines.length && !/^\d{4}-\d{2}-\d{2}/.test(lines[i + 1]) && !/^Total/.test(lines[i + 1])) {
        combined += " " + lines[i + 1];
        i++;
      }
      merged.push(combined);
    }
  }

  // Regex: timestamp  txId(S/C)  COIN_PAIR  Buy/Sell  harga  jumlahKoin
  // Format aktual: "2025-06-11 14:41:46 512245697 (S) ONDO_IDR Buy 14.686,799 6,8 ..."
  // Harga pakai titik ribuan, koma desimal (14.686,799)
  // Jumlah koin bisa integer atau float dengan koma/titik
  const TX_RE = /(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}\s+\d+\s*\([SC]\)\s+([A-Z]+)_(?:IDR|USDT)\s+(Buy|Sell)\s+([\d.,]+)\s+([\d.,]+)/i;

  const coinMap = new Map(); // coin → { buyAmount, buyValue, sellAmount, firstDate }

  for (const line of merged) {
    const m = line.match(TX_RE);
    if (!m) continue;

    const date    = m[1];
    const coin    = m[2].toUpperCase();
    const type    = m[3].toLowerCase();
    const price   = parseIdrNum(m[4]);   // harga per koin
    const qty     = parseIdrNum(m[5]);   // jumlah koin

    if (!coin || qty <= 0 || price <= 0) continue;
    // Skip stablecoin
    if (["USDT", "USDC", "BUSD", "IDR"].includes(coin)) continue;

    if (!coinMap.has(coin)) {
      coinMap.set(coin, { buyAmount: 0, buyValue: 0, sellAmount: 0, firstDate: date });
    }
    const entry = coinMap.get(coin);

    if (type === "buy") {
      entry.buyAmount += qty;
      entry.buyValue  += qty * price;
      if (date < entry.firstDate) entry.firstDate = date;
    } else {
      entry.sellAmount += qty;
    }
  }

  if (coinMap.size === 0) {
    throw new Error(
      "Tidak ada transaksi yang berhasil diparsing.\n\n" +
      "Pastikan kamu copy-paste seluruh isi PDF (Ctrl+A → Ctrl+C) " +
      "dari Ringkasan Pemotongan Pajak Tokocrypto."
    );
  }

  const results = [];
  for (const [coin, entry] of coinMap) {
    const netAmount = entry.buyAmount - entry.sellAmount;
    if (netAmount <= 0.000001) continue;

    const avgBuyPrice  = entry.buyAmount > 0 ? entry.buyValue / entry.buyAmount : 0;
    const costBasisIdr = Math.round(netAmount * avgBuyPrice);

    results.push({
      type:         "crypto",
      coin,
      name:         COIN_NAMES[coin] ?? coin,
      amount:       Math.round(netAmount * 1e8) / 1e8,
      costBasisIdr,
      platform:     "tokocrypto",
      date:         entry.firstDate,
    });
  }

  return results;
}

// ════════════════════════════════════════════════════════════════
//  EXPORT — Rule Map
// ════════════════════════════════════════════════════════════════

export const CRYPTO_PARSERS = {
  pintu: {
    label:    "Pintu",
    category: "crypto",
    hint: `Buka Pintu → Riwayat Transaksi → copy semua teks

Contoh format:
Beli BTC
12 Mar 2024
0,005312 BTC
Rp 9.350.000`,
    parse: parsePintu,
  },

  tokocrypto: {
    label:    "Tokocrypto",
    category: "crypto",
    hint: `Buka Tokocrypto → History → copy teks

Contoh format:
BUY BTC/IDR
Qty: 0.005
Total: Rp 9.500.000
2024-01-15`,
    parse: parseTokocrypto,
  },

  indodax: {
    label:    "Indodax",
    category: "crypto",
    hint: `Buka Indodax → Order History → copy teks

Contoh format:
BTC/IDR Buy
Rp 43.250.000  0,005 BTC
15 Jan 2024`,
    parse: parseIndodax,
  },

  pluang: {
    label:    "Pluang (Paste Teks)",
    category: "crypto",
    hint: `Buka Pluang → Riwayat Transaksi → copy teks

Contoh format:
Beli Bitcoin (BTC)
Rp 9.350.000
0.005312 BTC
12 Mar 2024`,
    parse: parsePluang,
  },

  "tokocrypto-tax": {
    label:    "Tokocrypto (Laporan Pajak PDF)",
    category: "crypto",
    hint: `Buka PDF "Ringkasan Pemotongan Pajak" dari Tokocrypto
→ Ctrl+A → Ctrl+C → Paste di sini

Parser akan otomatis membaca:
• Jumlah koin (Jumlah Koin)
• Harga beli (Harga IDR)
• Tanggal transaksi
• Net holdings (buy - sell)

Format baris yang dikenali:
  2025-06-11 14:41:46  512245697 (S)  ONDO_IDR  Buy  14.686,799  6,8  ...`,
    parse: parseTokocryptoTaxReport,
  },

  "floq-tax": {
    label:    "Floq (Laporan Pajak PDF)",
    category: "crypto",
    hint: `Buka PDF "Laporan Pajak Aset Kripto" dari Floq
→ Ctrl+A → Ctrl+C → Paste di sini

⚠ PDF Floq hanya mencantumkan total IDR per transaksi,
  TIDAK ada jumlah koin.

Setelah import, kamu perlu:
1. Buka asset yang diimport (klik row)
2. Klik Edit → isi kolom "Jumlah" sesuai saldo koin di Floq
   (cek di app Floq → Portofolio)

Parser akan mengisi:
• Platform: floq
• Cost Basis: total IDR yang dikeluarkan untuk beli
• Tanggal: tanggal pembelian pertama`,
    parse: parseFloqTaxReport,
  },

  "pluang-csv": {
    label:    "Pluang (Transaction CSV)",
    category: "crypto",
    hint: `Upload atau paste isi file CSV dari Pluang.

Cara download:
Pluang → Akun → Riwayat Transaksi → Export/Download CSV

File berformat:
"Order Date","Order Time","Order Number","Transaction","Transaction Type",...

Parser akan:
• Hanya proses transaksi BUY & SELL (skip YIELD)
• Hitung net holdings per koin (buy - sell)
• Hitung weighted average cost basis
• Skip koin yang sudah habis dijual`,
    parse: parsePluangCSV,
  },

  "indodax-tax": {
    label:    "Indodax (Tax Report PDF)",
    category: "crypto",
    hint: `Buka PDF "Final Tax Collection Slip" dari Indodax
→ Ctrl+A (pilih semua) → Ctrl+C (copy) → Paste di sini

Parser akan otomatis:
• Agregasi semua transaksi Buy & Sell
• Hitung net amount per koin (buy - sell)
• Hitung weighted average cost basis
• Skip koin yang sudah dijual habis

Cocok untuk Tax Report 2023, 2024, dan 2025.`,
    parse: parseIndodaxTaxReport,
  },

}; // end CRYPTO_PARSERS

/**
 * Jalankan parser kripto berdasarkan sourceKey.
 * @param {string} sourceKey
 * @param {string} rawText
 * @returns {ParsedCrypto[]}
 * @throws {Error}
 */
export function runCryptoParser(sourceKey, rawText) {
  const rule = CRYPTO_PARSERS[sourceKey];
  if (!rule) {
    throw new Error(`Parser kripto tidak dikenal: "${sourceKey}". Tersedia: ${Object.keys(CRYPTO_PARSERS).join(", ")}`);
  }

  console.info(`[parser/tokocrypto] Menjalankan "${rule.label}" pada ${rawText.length} karakter`);

  const cleaned = rawText.replace(/\r\n/g, "\n").trim();
  return rule.parse(cleaned);
}

/**
 * Kembalikan semua rule metadata untuk UI.
 * @returns {Array<{key: string, label: string, hint: string}>}
 */
export function getCryptoParserMeta() {
  return Object.entries(CRYPTO_PARSERS).map(([key, rule]) => ({
    key,
    label:  rule.label,
    hint:   rule.hint,
  }));
}
