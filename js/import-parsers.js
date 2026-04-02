/* ════════════════════════════════════════════════════════════════
   import-parsers.js
   Rule-Based Parsing Engine for PORTFOLIO.SYS
   ─────────────────────────────────────────────────────────────
   HOW TO ADD A NEW PARSER:
   1. Tambah entry baru di IMPORT_RULES di bawah
   2. Isi: label, category, hint (contoh format), parse(rawText) fn
   3. Gunakan helper: parseIdrNum(), parseDate(), COIN_NAMES, CRYPTO_COINS
   4. Return array of objects sesuai tipe:
      crypto  → { type, coin, name, amount, costBasisIdr, platform, date }
      stocks  → { type, ticker, name, shares, seedPrice, market, broker, date }
      savings → { type, name, bank, currency, foreignAmt, idr, annualYield, date }
════════════════════════════════════════════════════════════════ */

// ── ES Module Imports dari 5 parser files ───────────────────────
// Setiap file ada di folder js/parsers/ relatif terhadap js/
import { CRYPTO_PARSERS } from './parsers/tokocrypto.js';
import { STOCK_PARSERS }  from './parsers/stock.js';
import { SAVINGS_PARSERS } from './parsers/savings.js';
// parser-utils & binance diimport lewat file di atas (transitive)

/* ── Bridge: access main module internals via window getters ── */
const _bridge = {
  get DATA()           { return window._getDATA(); },
  set DATA(v)          { window._setDATA(v); },
  get S()              { return window._getS(); },
  get POPULAR_STOCKS() { return window._POPULAR_STOCKS; },
};
function DATA_get()   { return window._getDATA(); }
function S_get()      { return window._getS(); }
function uid()        { return window._uid(); }
function renderAll()  { window._renderAll(); }
function saveDataToCloud() { return window._saveCloud(); }
// Shorthand aliases used in parser code
const getDATA = () => window._getDATA();
const getS    = () => window._getS();

// ── i18n helper — baca bahasa dari state app ─────────────────────
function impT(id, en, id_) {
  try { return (window._getS?.()?.lang === 'en') ? en : id_; }
  catch(e) { return id_; }
}


/* ── Re-map DATA and S reads: every reference to DATA/S in parser
   functions is wrapped via getDATA()/getS() calls below.         */


/* ════════════════════════════════════════════════════════════════
   IMPORT ENGINE — Rule-Based Parsing with Regex
   Supports: Paste Text | PDF | Image (OCR)
   Sources:  Pintu, Indodax, Binance, Bibit, Stockbit, Generic
════════════════════════════════════════════════════════════════ */

// ── Coin name lookup ─────────────────────────────────────────────
const COIN_NAMES = {
  BTC:'Bitcoin',ETH:'Ethereum',XRP:'XRP',SOL:'Solana',ADA:'Cardano',
  DOT:'Polkadot',MATIC:'Polygon',BNB:'BNB',DOGE:'Dogecoin',AVAX:'Avalanche',
  LINK:'Chainlink',UNI:'Uniswap',ATOM:'Cosmos',LTC:'Litecoin',SHIB:'Shiba Inu',
  SAND:'The Sandbox',MANA:'Decentraland',NEAR:'NEAR Protocol',FTM:'Fantom',
  OP:'Optimism',ARB:'Arbitrum',APT:'Aptos',SUI:'Sui',TRX:'TRON',USDT:'Tether',
  USDC:'USD Coin',DAI:'DAI',
};
const CRYPTO_COINS = Object.keys(COIN_NAMES).join('|');

// ── Number parser (handles IDR format: 1.234.567 or 1,234,567) ──
function parseIdrNum(str){
  if(!str) return 0;
  str = str.toString().trim();
  // IDR format: dots as thousand separator, comma as decimal
  // e.g. "1.234.567" or "1.234.567,50"
  // US format: commas as thousand separator, dot as decimal
  // Heuristic: if more than one dot or ends with non-decimal pattern
  const cleaned = str.replace(/\s/g,'');
  // If has both dot and comma, determine which is decimal separator
  if(cleaned.includes('.') && cleaned.includes(',')){
    const dotPos  = cleaned.lastIndexOf('.');
    const commaPos= cleaned.lastIndexOf(',');
    if(commaPos > dotPos){
      // comma is decimal sep (IDR style: 1.234,56)
      return parseFloat(cleaned.replace(/\./g,'').replace(',','.')) || 0;
    } else {
      // dot is decimal sep (US style: 1,234.56)
      return parseFloat(cleaned.replace(/,/g,'')) || 0;
    }
  }
  if(cleaned.includes('.')){ 
    // Could be IDR thousand sep OR decimal
    const parts = cleaned.split('.');
    if(parts.length > 2) return parseFloat(cleaned.replace(/\./g,'')) || 0; // 1.234.567 → 1234567
    if(parts[parts.length-1].length === 3) return parseFloat(cleaned.replace(/\./g,'')) || 0; // 1.234 → 1234
    return parseFloat(cleaned) || 0;
  }
  if(cleaned.includes(',')){ 
    const parts = cleaned.split(',');
    if(parts.length > 2) return parseFloat(cleaned.replace(/,/g,'')) || 0;
    if(parts[parts.length-1].length === 3) return parseFloat(cleaned.replace(/,/g,'')) || 0;
    return parseFloat(cleaned.replace(',','.')) || 0;
  }
  return parseFloat(cleaned) || 0;
}

// ── Date parser ──────────────────────────────────────────────────
function parseDate(str){
  if(!str) return new Date().toISOString().split('T')[0];
  str = str.trim();
  // ISO format
  if(/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10);
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if(dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // D Mon YYYY (e.g. 12 Mar 2024)
  const monthNames={jan:'01',feb:'02',mar:'03',apr:'04',mei:'05',may:'05',jun:'06',
    jul:'07',agu:'08',aug:'08',sep:'09',okt:'10',oct:'10',nov:'11',des:'12',dec:'12'};
  const dmonth = str.match(/(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{4})/);
  if(dmonth){
    const m = monthNames[dmonth[2].toLowerCase()]||'01';
    return `${dmonth[3]}-${m}-${dmonth[1].padStart(2,'0')}`;
  }
  // YYYY/MM/DD
  const ymd = str.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if(ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return new Date().toISOString().split('T')[0];
}

// ════════════════════════════════════════════════════════════════
//  REGEX RULE SETS — one per platform/source
// ════════════════════════════════════════════════════════════════
const IMPORT_RULES = {

  // ── CRYPTO ────────────────────────────────────────────────────

  // ── Dari tokocrypto.js ──────────────────────────────────────────
  pintu:      { ...CRYPTO_PARSERS.pintu },
  indodax:    { ...CRYPTO_PARSERS.indodax },
  tokocrypto: { ...CRYPTO_PARSERS.tokocrypto },
  pluang:     { ...CRYPTO_PARSERS.pluang },

  // ── Parser Tax Report (PDF) & CSV ──────────────────────────────
  'indodax-tax':      { ...CRYPTO_PARSERS['indodax-tax'] },
  'pluang-csv':       { ...CRYPTO_PARSERS['pluang-csv'] },
  'floq-tax':         { ...CRYPTO_PARSERS['floq-tax'] },
  'tokocrypto-tax':   { ...CRYPTO_PARSERS['tokocrypto-tax'] },

  binance: {
    label:'Binance', category:'crypto',
    hint:`Buka Binance → Trade History → Export CSV, lalu paste isi CSV-nya\n\nContoh CSV:\nDate(UTC),Pair,Side,Price,Executed,Amount,Fee\n2024-01-15 10:30:00,BTCUSDT,BUY,43250.50,0.005 BTC,216.25 USDT,0.001`,
    parse(raw){
      const results=[];
      // CSV format: Date,Pair,Side,Price,Executed,Amount,Fee
      const re = new RegExp(
        `(\\d{4}-\\d{2}-\\d{2})[^,]*,([A-Z]+)USDT,BUY,([\\d.]+),(([\\d.]+)\\s*([A-Z]+)),([\\d.]+)`,
        'gi'
      );
      for(const m of raw.matchAll(re)){
        const coin = m[2].toUpperCase();
        const qty  = parseFloat(m[5])||0;
        const price_usdt = parseFloat(m[3])||0;
        const usdidr = getS().usdIdr||16200;
        results.push({
          type:'crypto', coin, name:COIN_NAMES[coin]||coin,
          amount:qty, costBasisIdr:Math.round(qty*price_usdt*usdidr),
          platform:'binance', date:parseDate(m[1])
        });
      }
      // Simple: BTCUSDT BUY qty price
      const re2 = new RegExp(
        `([A-Z]+)USDT\\s+(?:BUY|buy)\\s+([\\d.]+)\\s+@?\\s*([\\d.]+)`,
        'gi'
      );
      for(const m of raw.matchAll(re2)){
        const coin = m[1].toUpperCase();
        const qty = parseFloat(m[2])||0;
        const price_usdt = parseFloat(m[3])||0;
        const usdidr = getS().usdIdr||16200;
        if(!results.find(r=>r.coin===coin))
          results.push({
            type:'crypto', coin, name:COIN_NAMES[coin]||coin,
            amount:qty, costBasisIdr:Math.round(qty*price_usdt*usdidr),
            platform:'binance', date:new Date().toISOString().split('T')[0]
          });
      }
      return results;
    }
  },

  // ── SAHAM IDX ─────────────────────────────────────────────────


  // ── Dari stock.js ────────────────────────────────────────────────
  bibit:      { ...STOCK_PARSERS.bibit },

  stockbit:   { ...STOCK_PARSERS.stockbit },

  // ── SAHAM US ──────────────────────────────────────────────────

  us_generic: { ...STOCK_PARSERS['generic-stock'] },
  ibkr:       { ...STOCK_PARSERS.ibkr },

  // ── TABUNGAN ──────────────────────────────────────────────────


  // ── Dari savings.js ──────────────────────────────────────────────
  bank_generic:    { ...SAVINGS_PARSERS['savings-generic'] },
  'savings-csv':   { ...SAVINGS_PARSERS['savings-csv'] },

  // ── STOCKBIT TRADE CONFIRMATION PDF ──────────────────────────
  // Format: email konfirmasi transaksi PDF dari PT. Stockbit Sekuritas Digital
  // Contoh baris transaksi:
  //   0054305 RG CDIA Chandra Daya Investasi Tbk. 2 200.00 1,785.00 357,000.00 0.00
  //   0062228 RG CDIA Chandra Daya Investasi Tbk. 10 1,000.00 1,765.00 1,765,000.00 0.00

  stockbit_trade: {
    label: 'Stockbit — Trade Confirmation (PDF)',
    category: 'stocks',
    hint: `Upload PDF Trade Confirmation dari Stockbit\n\nParser membaca:\n• Ticker saham (CDIA, BBCA, dst)\n• Jumlah lot & harga per lembar\n• Tanggal transaksi\n• Biaya total (Total Cost)\n\nHanya transaksi BUY yang diimport.`,
    parse(raw) {
      const results = [];

      // ── Validasi: pastikan ini Trade Confirmation Stockbit
      if (!/STOCKBIT/i.test(raw) || !/Trade\s*Confirmation/i.test(raw)) return results;

      // ── Ekstrak tanggal transaksi
      // Format di PDF: "Transaction Date 19/12/2025"
      const dateM = raw.match(/Transaction\s*Date\s+(\d{2}\/\d{2}\/\d{4})/i);
      const txDate = dateM ? parseDate(dateM[1]) : new Date().toISOString().split('T')[0];

      // ── Ekstrak baris transaksi
      // Format: REF# BOARD TICKER CompanyName LOT QTY PRICE BUY SELL
      // Ciri khas:
      //   - REF: 5-7 digit angka
      //   - Board: RG / NG / TN
      //   - Ticker: 2-6 huruf kapital
      //   - Company name: bebas, diakhiri sebelum angka lot
      //   - Lot: integer sederhana (bukan desimal)
      //   - QTY, Price, Buy, Sell: selalu format ribuan dengan titik/koma dan 2 desimal
      //
      // Strategi regex:
      //   Step 1 — tangkap REF + board + ticker
      //   Step 2 — dari posisi itu, tangkap lot (integer) lalu qty/price/buy/sell (desimal)
      //   Company name = semua teks antara ticker dan lot

      // Regex utama — menangkap seluruh baris transaksi
      // Catatan: PDF.js kadang menggabungkan seluruh baris jadi 1 string panjang
      const tradeRe = /(\d{5,7})\s+(?:RG|NG|TN|UH)\s+([A-Z]{2,6})\s+(.+?)\s+(\d{1,4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/g;

      for (const m of raw.matchAll(tradeRe)) {
        const ticker     = m[2].toUpperCase();
        const company    = m[3].trim().replace(/\s+/g, ' ');
        const lots       = parseInt(m[4]);
        // m[5] = quantity (shares), m[6] = price per share, m[7] = buy total, m[8] = sell total
        const pricePerShare = parseFloat(m[6].replace(/,/g, ''));
        const buyTotal      = parseFloat(m[7].replace(/,/g, ''));
        const sellTotal     = parseFloat(m[8].replace(/,/g, ''));

        // Hanya proses BUY (buyTotal > 0, sellTotal = 0)
        if (buyTotal > 0 && sellTotal === 0) {
          // Cari Total Cost untuk akurasi (termasuk komisi, pajak, dll)
          // Format di PDF: "Total Cost 357,535.50 0.00" atau "Payment due to us IDR 357,535.50"
          const costM = raw.match(/Total\s*Cost\s+([\d,]+\.\d{2})/i)
                     || raw.match(/Payment\s+due\s+to\s+us\s+IDR\s+([\d,]+\.\d{2})/i);
          const totalCostIdr = costM ? parseFloat(costM[1].replace(/,/g, '')) : buyTotal;

          results.push({
            type: 'stocks',
            ticker,
            name: company,
            shares: lots,
            seedPrice: Math.round(pricePerShare),  // harga per lembar (bukan lot)
            market: 'IDX',
            broker: 'stockbit',
            date: txDate,
            _totalCost: totalCostIdr,              // metadata ekstra (tidak disimpan ke DATA)
          });
        }
      }

      return results;
    }
  },

  // ── PLUANG — EMAIL KONFIRMASI BELI CRYPTO PDF ─────────────────
  // Format: email "Your purchase of [Coin] was successful!" dari noreply@pluang.com
  // Field yang diparsing:
  //   Asset      → nama coin (BTC, ETH, dst)
  //   Amount     → 0.0001411 units
  //   Total Paid → Rp199979 (jumlah yang benar-benar dibayar, termasuk fee)
  //   Date       → 30 Jan 2026 07:31 WIB

  pluang_email: {
    label: 'Pluang — Email Konfirmasi Beli Crypto (PDF)',
    category: 'crypto',
    hint: `Upload PDF email dari Pluang:\n"Your purchase of [Coin] was successful!"\n\nParser membaca:\n• Jenis coin (BTC, ETH, dst)\n• Jumlah unit\n• Total Paid (termasuk fee & pajak)\n• Tanggal transaksi`,
    parse(raw) {
      const results = [];

      // ── Validasi: pastikan ini email Pluang
      if (!/pluang/i.test(raw)) return results;

      // ── Pattern 1: Baca per-transaksi dari blok Transaction Details
      // Format di PDF setelah diekstrak:
      //   Asset BTC
      //   Amount 0.0001411 units
      //   Price Rp1414626751
      //   Total Rp199604
      //   Transaction Fee Rp300
      //   Tax Rp75
      //   Total Paid Rp199979
      //   Date 30 Jan 2026 07:31 WIB

      // Regex: tangkap semua blok transaksi dalam 1 PDF (bisa multi-transaksi)
      // Anchor: dimulai dari "Asset [COIN]" hingga "Total Paid Rp[angka]"
      const blockRe = /Asset\s+([A-Z]+)\s+Amount\s+([\d.]+)\s*units[\s\S]{0,400}?Total\s+Paid\s+Rp([\d,]+)/gi;

      for (const m of raw.matchAll(blockRe)) {
        const coin       = m[1].toUpperCase();
        const amount     = parseFloat(m[2]);
        const totalPaid  = parseFloat(m[3].replace(/,/g, ''));

        // Cari tanggal dalam blok yang sama (antara "Asset" dan "Total Paid")
        const blockSlice = raw.slice(raw.indexOf(m[0]), raw.indexOf(m[0]) + m[0].length + 100);
        const dateM      = blockSlice.match(/Date\s+(\d{1,2}\s+\w+\s+\d{4})/i)
                        || raw.match(/Date\s+(\d{1,2}\s+\w+\s+\d{4})/i);
        const txDate     = dateM ? parseDate(dateM[1]) : new Date().toISOString().split('T')[0];

        results.push({
          type: 'crypto',
          coin,
          name: COIN_NAMES[coin] || coin,
          amount,
          costBasisIdr: totalPaid,   // pakai Total Paid (sudah termasuk fee & tax)
          platform: 'pluang',
          date: txDate,
        });
      }

      // ── Pattern 2 fallback — jika PDF.js memformat berbeda (spasi/newline tidak standard)
      // Tangkap coin dari subject, amount dari "X units", total dari "Total Paid RpX"
      if (results.length === 0) {
        const coinM   = raw.match(/Your\s+([A-Z]+)\s+purchase\s+of\s+([\d.]+)\s*units/i)
                     || raw.match(/purchase\s+of\s+([A-Z]+)\s+was\s+successful/i);
        const amtM    = raw.match(/Amount\s+([\d.]+)\s*units/i)
                     || raw.match(/purchase\s+of\s+([\d.]+)\s*units/i);
        const paidM   = raw.match(/Total\s+Paid\s+Rp\s*([\d,]+)/i);
        const dateM   = raw.match(/Date\s+(\d{1,2}\s+\w+\s+\d{4})/i);

        const coin    = (coinM?.[1] || 'BTC').toUpperCase();
        const amount  = parseFloat(amtM?.[1] || '0');
        const paid    = parseFloat((paidM?.[1] || '0').replace(/,/g, ''));
        const txDate  = dateM ? parseDate(dateM[1]) : new Date().toISOString().split('T')[0];

        if (amount > 0 && paid > 0) {
          results.push({
            type: 'crypto',
            coin,
            name: COIN_NAMES[coin] || coin,
            amount,
            costBasisIdr: paid,
            platform: 'pluang',
            date: txDate,
          });
        }
      }

      return results;
    }
  },

  // ── KROM — EMAIL KONFIRMASI DEPOSITO PDF ──────────────────────
  // Format: email "Deposito [NAMA] Berhasil Dibuat" dari noreply@krom.id
  // Field yang diparsing:
  //   Nama deposito → Deposito FEB 2026 (dari subject email)
  //   Jenis        → Krom Flex
  //   Saldo Awal   → Rp1.800.000
  //   Suku Bunga   → 6.5%
  //   Jatuh Tempo  → 27 Maret 2026 (dipakai sebagai catatan, bukan tanggal beli)

  krom_email: {
    label: 'Krom — Email Konfirmasi Deposito (PDF)',
    category: 'savings',
    hint: `Upload PDF email dari Krom:\n"Deposito [NAMA] Berhasil Dibuat"\n\nParser membaca:\n• Nama deposito (dari subject)\n• Saldo awal (Rp)\n• Suku bunga (% p.a.)\n• Jatuh tempo (sebagai catatan)`,
    parse(raw) {
      const results = [];

      // ── Validasi: pastikan ini email Krom
      if (!/krom/i.test(raw) || !/deposito/i.test(raw)) return results;

      // ── Nama deposito — dari subject email atau header
      // Format: "Deposito FEB 2026 Berhasil Dibuat"
      const nameM = raw.match(/Deposito\s+([A-Z]+\s+\d{4})\s+Berhasil/i)
                 || raw.match(/Deposito\s+([\w\s]+?)\s+(?:Berhasil|telah)/i);
      const depoName = nameM ? `Krom Deposito ${nameM[1].trim()}` : 'Krom Deposito';

      // ── Jenis deposito: "Jenis Deposito: Krom Flex"
      const jenisM = raw.match(/Jenis\s+Deposito\s*:\s*(.+?)[\r\n]/i);
      const jenis  = jenisM ? jenisM[1].trim() : 'Krom Flex';

      // ── Saldo Awal: "Saldo Awal: Rp1.800.000"
      // Catatan: angka IDR format "1.800.000" (titik = pemisah ribuan)
      const saldoM = raw.match(/Saldo\s+Awal\s*:\s*Rp\s*([\d.,]+)/i);
      if (!saldoM) return results;  // wajib ada saldo
      const saldo = parseIdrNum(saldoM[1]);

      // ── Suku bunga: "Suku Bunga: 6.5% p.a."
      const bungaM = raw.match(/Suku\s+Bunga\s*:\s*([\d.]+)\s*%/i);
      const bunga  = bungaM ? parseFloat(bungaM[1]) : 0;

      // ── Jatuh tempo: "Jatuh Tempo: 27 Maret 2026"
      // Ini bukan tanggal beli — pakai sebagai note, tanggal beli = hari ini
      const jatuhM = raw.match(/Jatuh\s+Tempo\s*:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
      const jatuhTempo = jatuhM ? jatuhM[1].trim() : '';

      // ── Tanggal email (tanggal deposito dibuat)
      // Format: "Fri, Mar 13, 2026 at 7:41 AM" atau "13/03/2026"
      const emailDateM = raw.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\w+\s+\d+,\s+\d{4}/i)
                      || raw.match(/(\d{1,2}\/\d{2}\/\d{4})/);
      const txDate = emailDateM ? parseDate(emailDateM[0]) : new Date().toISOString().split('T')[0];

      results.push({
        type: 'savings',
        name: depoName,
        bank: 'krom',
        currency: 'IDR',
        foreignAmt: saldo,
        idr: saldo,
        annualYield: bunga,
        date: txDate,
        _note: (() => {
          if (!jatuhTempo) return '';
          // Ringkas "27 Maret 2026" → "27/03/26"
          const mo={'januari':'01','februari':'02','maret':'03','april':'04','mei':'05',
            'juni':'06','juli':'07','agustus':'08','september':'09','oktober':'10',
            'november':'11','desember':'12'};
          const p = jatuhTempo.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
          if(p) {
            const mm = mo[p[2].toLowerCase()] || '??';
            return `JT: ${p[1].padStart(2,'0')}/${mm}/${p[3].slice(2)}`;
          }
          return jatuhTempo;
        })(),
      });

      return results;
    }
  },

  // ── GENERIC UNIVERSAL ─────────────────────────────────────────

  // ── PORTFOLIO.SYS PDF RE-IMPORT ───────────────────────────────
  // Baca kembali PDF export dari PORTFOLIO.SYS itu sendiri.
  // Semua 4 kelas aset: crypto, gold, stocks, savings.
  'portfolio-sys': {
    label: 'PORTFOLIO.SYS (PDF Export)',
    category: 'auto',
    hint: `Upload PDF laporan yang di-export dari PORTFOLIO.SYS sendiri.\n\nParser membaca semua aset:\n• Crypto (coin, jumlah, cost basis, platform)\n• Emas (gram, cost basis per gram)\n• Saham (ticker, lot, harga beli, broker)\n• Tabungan (bank, currency, saldo)`,
    parse(raw) {
      const results = [];

      // ── Helper: parse "Rp 54.86Jt" / "Rp 317.728" / "Rp 2.44M" ──
      function parseRpAbbr(str) {
        if (!str) return 0;
        str = String(str).replace(/\s/g, '').replace('Rp', '');
        const mulMap = { 'Jt': 1e6, 'M': 1e6, 'B': 1e9, 'Rb': 1e3, 'K': 1e3 };
        for (const [sfx, mul] of Object.entries(mulMap)) {
          const re = new RegExp(`^([\\d.,]+)${sfx}$`, 'i');
          const m = str.match(re);
          if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * mul);
        }
        return parseIdrNum(str);
      }

      // ── FIX #1a: Ticker lookup table untuk IDX stocks populer ──
      const IDX_TICKER_MAP = {
        'chandra daya':        'CDIA',
        'bangun kosambi':      'CBDK',
        'bank central asia':   'BBCA',
        'bank rakyat':         'BBRI',
        'bank mandiri':        'BMRI',
        'bank negara':         'BBNI',
        'bank tabungan':       'BBTN',
        'bank syariah':        'BRIS',
        'telkom':              'TLKM',
        'astra international': 'ASII',
        'unilever':            'UNVR',
        'indofood cbp':        'ICBP',
        'indofood':            'INDF',
        'kalbe farma':         'KLBF',
        'united tractors':     'UNTR',
        'merdeka copper':      'MDKA',
        'bukalapak':           'BUKA',
        'goto':                'GOTO',
        'elang mahkota':       'EMTK',
        'adaro energy':        'ADRO',
        'adaro andalan':       'AADI',
        'bukit asam':          'PTBA',
        'indo tambangraya':    'ITMG',
        'amman mineral':       'AMMN',
        'aneka tambang':       'ANTM',
        'vale indonesia':      'INCO',
        'barito renewables':   'BREN',
        'barito pacific':      'BRPT',
        'bumi serpong':        'BSDE',
        'ciputra':             'CTRA',
        'pakuwon':             'PWON',
        'summarecon':          'SMRA',
        'jasa marga':          'JSMR',
        'gudang garam':        'GGRM',
        'hm sampoerna':        'HMSP',
        'matahari department': 'LPPF',
        'sumber alfaria':      'AMRT',
      };

      function guessTickerFromName(name) {
        const nameLower = name.toLowerCase();
        // 1. Coba window._POPULAR_STOCKS (reverse lookup, 8-char prefix)
        const stocks = window._POPULAR_STOCKS || {};
        for (const [t, n] of Object.entries(stocks)) {
          if (n && nameLower.startsWith(n.toLowerCase().slice(0, 8))) return t;
        }
        // 2. Coba IDX_TICKER_MAP
        for (const [key, ticker] of Object.entries(IDX_TICKER_MAP)) {
          if (nameLower.includes(key)) return ticker;
        }
        // 3. Fallback: gabungkan 2 huruf pertama dari 2 kata pertama yang berarti
        const words = name.split(/\s+/).filter(w => w.length > 2 && !/tbk|pt\.|cv\./i.test(w));
        if (words.length >= 2) {
          return (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase();
        }
        return words[0]?.slice(0, 4).toUpperCase() || 'UNKN';
      }

      // ── FIX #1b: Broker map diperluas (termasuk truncated PDF text) ──
      const brokerMap = {
        st:  'stockbit', sto: 'stockbit', stoc: 'stockbit', stock: 'stockbit',
        bi:  'bibit',    bit: 'bibit',    bibi: 'bibit',
        ip:  'indopremier', indo: 'indopremier',
        pl:  'pluang',   plu: 'pluang',
        bni: 'bni sekuritas',
        bca: 'bca sekuritas',
        mnd: 'mandiri sekuritas',
        man: 'mandiri sekuritas',
        ph:  'phillip sekuritas',
      };

      const lines = raw.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
      let section = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Section detection
        if (/CRYPTO\s+HOLDINGS/i.test(line))  { section = 'crypto';  continue; }
        if (/GOLD\s+HOLDINGS/i.test(line))    { section = 'gold';    continue; }
        if (/STOCK\s+HOLDINGS/i.test(line))   { section = 'stocks';  continue; }
        if (/^SAVINGS\s*$/i.test(line))        { section = 'savings'; continue; }
        if (/PORTFOLIO\.SYS[\s\u2013\u2014-]/i.test(line)) { section = null; continue; }
        if (/^Nama\s+Qty\s+Nilai/i.test(line)) continue;

        if (section === 'crypto') {
          // "Bitcoin (indodax) 0.05621301 BTC Rp 68.04Jt Rp 54.86Jt 2023-12-20"
          const m = line.match(/^(.+?)\s+\((\w+)\)\s+([\d.]+)\s+([A-Z]+)\s+Rp\s*([\d.,A-Za-z]+)\s+Rp\s*([\d.,A-Za-z]+)\s+(\d{4}-\d{2}-\d{2})/i);
          if (m) {
            const coin = m[4].toUpperCase();
            results.push({
              type: 'crypto', coin,
              name: COIN_NAMES[coin] || coin,
              amount: parseFloat(m[3]),
              costBasisIdr: parseRpAbbr(m[6]),
              platform: m[2].toLowerCase(),
              date: m[7],
            });
          }
        }

        else if (section === 'gold') {
          // "Antam 25 gr 25g Rp 60.91Jt Rp 22.90Jt 2020-11-16"
          const m = line.match(/^(.+?)\s+([\d.]+)g\s+Rp\s*([\d.,A-Za-z]+)\s+Rp\s*([\d.,A-Za-z]+)\s+(\d{4}-\d{2}-\d{2})/i);
          if (m) {
            const grams = parseFloat(m[2]);
            const costTotal = parseRpAbbr(m[4]);
            results.push({
              type: 'gold',
              name: m[1].trim(),
              grams,
              costBasisPerGram: grams > 0 ? Math.round(costTotal / grams) : 0,
              date: m[5],
            });
          }
        }

        else if (section === 'stocks') {
          // "Chandra Daya Investasi Tbk (st 2 lot Rp 156.000 Rp 357.000 2025-12-19"
          // "(st" dan "(sto" keduanya = stockbit (truncated PDF text)
          const m = line.match(/^(.+?)\s+\((\w+)\s+(\d+)\s+lot\s+Rp\s*([\d.,A-Za-z]+)\s+Rp\s*([\d.,A-Za-z]+)\s+(\d{4}-\d{2}-\d{2})/i);
          if (m) {
            const lots = parseInt(m[3]);
            const costTotal = parseRpAbbr(m[5]);
            const seedPrice = lots > 0 ? Math.round(costTotal / (lots * 100)) : 0;
            const name = m[1].trim();
            const ticker = guessTickerFromName(name);
            const broker = brokerMap[m[2].toLowerCase()] || m[2].toLowerCase();
            results.push({
              type: 'stocks', ticker, name,
              shares: lots, seedPrice,
              market: 'IDX', broker,
              date: m[6], annualYield: 0,
            });
          }
        }

        else if (section === 'savings') {
          // "OCBC CAD 136.93 Rp 1.70Jt – 2025-07-28"
          // "CNY 2026 IDR 6,250,000 Rp 6.25Jt – 2026-02-17"
          const m = line.match(/^(.+?)\s+(IDR|USD|SGD|AUD|EUR|GBP|JPY|CAD|CNY|HKD|CHF|NZD)\s+([\d,]+(?:\.\d+)?)\s+Rp\s*([\d.,A-Za-z]+)\s+(?:–|-|—)\s+(\d{4}-\d{2}-\d{2})/i);
          if (m) {
            const name     = m[1].trim();
            const currency = m[2].toUpperCase();
            const foreignAmt = parseIdrNum(m[3]);
            const idr      = parseRpAbbr(m[4]);
            const bank     = name.split(' ')[0].toLowerCase();
            results.push({
              type: 'savings', name, bank: bank || 'other',
              currency, foreignAmt, idr,
              annualYield: 0, note: '', date: m[5],
            });
          }
        }
      }

      if (results.length === 0) {
        throw new Error('Tidak ada data yang terbaca.\nPastikan PDF yang diupload adalah PDF export dari PORTFOLIO.SYS (bukan PDF lain).');
      }
      return results;
    }
  },

  generic: {
    label:'Format Universal (Bebas)', category:'auto',
    hint:`Format bebas, satu aset per baris\n\nCRYPTO:\n  BTC 0.05 Rp50000000 [platform] [tanggal]\n  ETH 1.5 50000000\n\nSAHAM IDX:\n  BBCA 2 lot 9200 [broker] [tanggal]\n  TLKM 5lot 3850\n\nSAHAM US:\n  AAPL 3 185 USD\n  TSLA 2 250 USD\n\nTABUNGAN:\n  BCA Rp45000000\n  OCBC SGD 800`,
    parse(raw){
      const results=[];
      const lines = raw.split(/[\r\n]+/).map(l=>l.trim()).filter(Boolean);
      for(const line of lines){
        if(line.startsWith('#')||line.startsWith('//')||line.startsWith(';')) continue;
        // CRYPTO: BTC 0.05 [Rp]50000000
        const reCrypto = new RegExp(`^(${CRYPTO_COINS})\\s+([\\d.,]+)\\s+(?:Rp\\s*)?(\\d[\\d.,]*)(?:\\s+(\\w+))?(?:\\s+(\\d{4}-\\d{2}-\\d{2}))?`,'i');
        const mCrypto = line.match(reCrypto);
        if(mCrypto){
          const coin = mCrypto[1].toUpperCase();
          results.push({
            type:'crypto', coin, name:COIN_NAMES[coin]||coin,
            amount:parseIdrNum(mCrypto[2]), costBasisIdr:parseIdrNum(mCrypto[3]),
            platform:mCrypto[4]||'other', date:parseDate(mCrypto[5]||'')
          });
          continue;
        }
        // SAHAM US: AAPL 3 185 USD
        const reUS = /^([A-Z]{1,5})\s+(\d+)\s+([\d.]+)\s+USD/i;
        const mUS = line.match(reUS);
        if(mUS){
          const ticker = mUS[1].toUpperCase();
          const shares = parseInt(mUS[2]);
          const price  = parseFloat(mUS[3]);
          results.push({
            type:'stocks', ticker, name:(window._POPULAR_STOCKS||{})[ticker]||ticker,
            shares, seedPrice:Math.round(price*(getS().usdIdr||16200)),
            market:'US', broker:'other', date:new Date().toISOString().split('T')[0]
          });
          continue;
        }
        // SAHAM IDX: BBCA 2lot 9200 or BBCA 2 9200
        const reIDX = /^([A-Z]{4})\s+(\d+)\s*lot\s+([\d.,]+)/i;
        const mIDX = line.match(reIDX);
        if(mIDX){
          results.push({
            type:'stocks', ticker:mIDX[1].toUpperCase(),
            name:(window._POPULAR_STOCKS||{})[mIDX[1].toUpperCase()]||mIDX[1],
            shares:parseInt(mIDX[2]), seedPrice:parseIdrNum(mIDX[3]),
            market:'IDX', broker:'other', date:new Date().toISOString().split('T')[0]
          });
          continue;
        }
        // IDX without "lot" keyword: BBCA 2 9200 (4 uppercase chars)
        const reIDX2 = /^([A-Z]{4})\s+(\d+)\s+([\d.,]+)(?:\s+(bibit|stockbit|indopremier|other))?/i;
        const mIDX2 = line.match(reIDX2);
        if(mIDX2 && !COIN_NAMES[mIDX2[1].toUpperCase()]){
          results.push({
            type:'stocks', ticker:mIDX2[1].toUpperCase(),
            name:(window._POPULAR_STOCKS||{})[mIDX2[1].toUpperCase()]||mIDX2[1],
            shares:parseInt(mIDX2[2]), seedPrice:parseIdrNum(mIDX2[3]),
            market:'IDX', broker:mIDX2[4]||'other', date:new Date().toISOString().split('T')[0]
          });
          continue;
        }
        // SAVINGS: BCA Rp45000000 or BCA Rp 45.000.000
        const reSav = /^(BCA|BRI|BNI|Mandiri|OCBC|Krom)\s+(?:Rp\s*)?([\d.,]+)/i;
        const mSav = line.match(reSav);
        if(mSav){
          const bank = mSav[1].toLowerCase();
          results.push({
            type:'savings', name:`${mSav[1]} Tabungan`, bank,
            currency:'IDR', foreignAmt:parseIdrNum(mSav[2]), idr:parseIdrNum(mSav[2]),
            annualYield:0, date:new Date().toISOString().split('T')[0]
          });
        }
      }
      return results;
    }
  }
};

// ════════════════════════════════════════════════════════════════
//  IMPORT MODAL STATE & UI
// ════════════════════════════════════════════════════════════════
let _impStep    = 1;
let _impMethod  = 'text';   // text | pdf | ocr
let _impSource  = 'generic';
let _impResults = [];       // parsed items
let _impRaw     = '';       // raw text

function openImport(){
  _impStep=1; _impMethod='pdf'; _impSource='generic'; _impResults=[]; _impRaw='';
  document.getElementById('impOverlay').classList.add('open');
  impRenderStep();
}
function closeImport(){
  document.getElementById('impOverlay').classList.remove('open');
}

function impSetStep(n){
  _impStep=n;
  [1,2,3].forEach(i=>{
    const el=document.getElementById('impStep'+i);
    el.classList.remove('active','done');
    if(i<n) el.classList.add('done'), document.getElementById('impStepNum'+i).innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>';
    else if(i===n) el.classList.add('active'), document.getElementById('impStepNum'+i).textContent=i;
    else document.getElementById('impStepNum'+i).textContent=i;
  });
}

function impRenderStep(){
  impSetStep(_impStep);
  const body  = document.getElementById('impBody');
  const nextBtn= document.getElementById('impNextBtn');
  const backBtn= document.getElementById('impBackBtn');
  const info  = document.getElementById('impFooterInfo');

  if(_impStep===1){
    backBtn.style.display='none';
    nextBtn.style.display='';
    nextBtn.textContent=impT('parse','Parse →','Parse →');
    nextBtn.disabled=false;
    info.textContent=impT('step1','Select data source and paste text / upload file','Pilih sumber data dan tempelkan teks / upload file');

    const sourceOpts = Object.entries(IMPORT_RULES).map(([k,v])=>
      `<option value="${k}" ${k===_impSource?'selected':''}>${v.label}</option>`
    ).join('');

    const rule = IMPORT_RULES[_impSource];
    const hint = rule?.hint||'';

    body.innerHTML = `
      <div class="imp-source-row">
        <div class="form-group" style="margin:0">
          <label class="form-label">${impT('src','Source / Platform','Sumber / Platform')}</label>
          <select class="form-select" id="impSourceSel" onchange="impChangeSource(this.value)">${sourceOpts}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">${impT('method','Input Method','Metode Input')}</label>
          <div class="imp-tab-row" style="margin:0">
            <button class="imp-tab ${_impMethod==='text'?'active':''}" onclick="impSetMethod('text')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg> ${impT('text','Text','Teks')}</button>
            <button class="imp-tab ${_impMethod==='pdf'?'active':''}"  onclick="impSetMethod('pdf')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF</button>
            <button class="imp-tab ${_impMethod==='csv'?'active':''}"  onclick="impSetMethod('csv')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg> CSV</button>
            <button class="imp-tab ${_impMethod==='ocr'?'active':''}"  onclick="impSetMethod('ocr')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> ${impT('img','Image','Gambar')}</button>
          </div>
        </div>
      </div>
      <div id="impInputArea"></div>
      <div id="impTemplateArea"></div>
    `;
    impRenderInputArea();
    impRenderTemplate();
  }
  else if(_impStep===2){
    backBtn.style.display='';
    nextBtn.textContent=`${impT('add','Add','Tambah')} ${_impResults.filter(r=>r._checked).length} ${impT('items','Items →','Item →')}`;
    nextBtn.disabled=_impResults.filter(r=>r._checked).length===0;
    info.textContent=impT('step2','Check items to import','Centang item yang ingin diimport');
    impRenderPreview(body);
  }
  else if(_impStep===3){
    backBtn.style.display='none';
    nextBtn.style.display='none';
    info.textContent='';
    const added = _impResults.filter(r=>r._checked);
    body.innerHTML=`
      <div style="text-align:center;padding:24px 0">
        <div style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="36" height="36" style="color:#34d399"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg></div>
        <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;margin-bottom:6px">
          ${added.length} ${impT('success','Assets Imported Successfully!','Aset Berhasil Diimport!')}
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:20px">
          ${impT('saved','Data saved and synced to cloud automatically.','Data tersimpan dan di-sync ke cloud otomatis.')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:24px">
          ${added.map(r=>`<span class="ptag ${r.type==='crypto'?'t-pintu':r.type==='stocks'?'t-bibit':'t-bca'}">${r.type==='crypto'?r.coin:r.ticker||r.name}</span>`).join('')}
        </div>
        <button class="btn-primary" style="max-width:200px" onclick="closeImport()">${impT('close','Close','Tutup')}</button>
      </div>
    `;
  }
}

function impRenderInputArea(){
  const area = document.getElementById('impInputArea');
  if(!area) return;
  if(_impMethod==='text'){
    area.innerHTML=`
      <textarea class="imp-textarea" id="impTextarea"
        placeholder="${impT('paste','Paste text from broker app here…','Tempel teks dari app broker di sini…')}"
        oninput="_impRaw=this.value">${_impRaw}</textarea>
    `;
  } else if(_impMethod==='pdf'){
    area.innerHTML=`
      <div class="imp-dropzone" id="impDropzone"
        onclick="document.getElementById('impFileInput').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="impHandleDrop(event)">
        <div class="imp-dropzone-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
        <div class="imp-dropzone-label">${impT('drop_pdf','Click or drag PDF files here','Klik atau seret file PDF ke sini')}</div>
        <div class="imp-dropzone-sub">${impT('multi_pdf','Multi-file supported — text extracted via PDF.js','Bisa multi-file — teks diekstrak via PDF.js')}</div>
        <div class="imp-file-name" id="impFileName"></div>
      </div>
      <input type="file" class="imp-file-input" id="impFileInput" accept=".pdf" multiple onchange="impHandlePdf(this.files)">
      <div class="imp-progress" id="impProgress" style="display:none">
        <div class="imp-progress-bar-track"><div class="imp-progress-bar-fill" id="impProgFill" style="width:0%"></div></div>
        <div class="imp-progress-text" id="impProgText">Memuat PDF...</div>
      </div>
    `;
  } else if(_impMethod==='csv'){
    area.innerHTML=`
      <div class="imp-dropzone" id="impDropzone"
        onclick="document.getElementById('impCsvInput').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="impHandleDrop(event)">
        <div class="imp-dropzone-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg></div>
        <div class="imp-dropzone-label">Klik atau seret file CSV ke sini</div>
        <div class="imp-dropzone-sub">Format: Transaction History CSV dari Pluang</div>
        <div class="imp-file-name" id="impFileName"></div>
      </div>
      <input type="file" class="imp-file-input" id="impCsvInput" accept=".csv,.txt" multiple onchange="impHandleCsv(this.files)">
      <div class="imp-progress" id="impProgress" style="display:none">
        <div class="imp-progress-bar-track"><div class="imp-progress-bar-fill" id="impProgFill" style="width:0%"></div></div>
        <div class="imp-progress-text" id="impProgText">Membaca CSV...</div>
      </div>
    `;
  } else {
    area.innerHTML=`
      <div class="imp-dropzone" id="impDropzone"
        onclick="document.getElementById('impImgInput').click()"
        ondragover="event.preventDefault();this.classList.add('drag')"
        ondragleave="this.classList.remove('drag')"
        ondrop="impHandleDrop(event)">
        <div class="imp-dropzone-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
        <div class="imp-dropzone-label">${impT('drop_img','Click or drag screenshots here','Klik atau seret screenshot di sini')}</div>
        <div class="imp-dropzone-sub">${impT('multi_img','Multi-file supported — OCR via Tesseract.js','Bisa multi-file — OCR via Tesseract.js')}</div>
        <div class="imp-file-name" id="impFileName"></div>
      </div>
      <input type="file" class="imp-file-input" id="impImgInput" accept="image/*" multiple onchange="impHandleOcr(this.files)">
      <div class="imp-progress" id="impProgress" style="display:none">
        <div class="imp-progress-bar-track"><div class="imp-progress-bar-fill" id="impProgFill" style="width:0%"></div></div>
        <div class="imp-progress-text" id="impProgText">Menjalankan OCR...</div>
      </div>
    `;
  }
}

function impRenderTemplate(){
  const area = document.getElementById('impTemplateArea');
  if(!area) return;
  const rule = IMPORT_RULES[_impSource];
  if(!rule?.hint) return;
  area.innerHTML=`
    <div class="imp-template">
      <div class="imp-template-title">${impT('fmt','Recognized Format','Format yang Dikenali')}
        <button class="imp-copy-btn" onclick="impCopyTemplate()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ${impT('copy','Copy example','Copy contoh')}</button>
      </div>
      <pre id="impTemplateText">${rule.hint}</pre>
    </div>
  `;
}

function impCopyTemplate(){
  const t = document.getElementById('impTemplateText');
  if(t) navigator.clipboard.writeText(t.textContent).then(()=>{
    const btn = document.querySelector('.imp-copy-btn');
    if(btn){ btn.textContent='Copied!'; setTimeout(()=>btn.textContent='Copy example',1500); }
  });
}

function impChangeSource(val){
  _impSource=val;
  // Auto-switch method untuk parser yang punya format khusus
  if(val === 'pluang-csv') impSetMethod('csv');
  impRenderTemplate();
}

function impSetMethod(m){
  _impMethod=m;
  impRenderInputArea();
  // re-render method buttons
  document.querySelectorAll('.imp-tab').forEach(b=>{
    b.classList.toggle('active', b.textContent.toLowerCase().includes(
      {text:'teks',pdf:'pdf',csv:'csv',ocr:'gambar'}[m]
    ));
  });
}


// ════════════════════════════════════════════════════════════════
//  AUTO-DETECT PLATFORM dari teks yang diekstrak
//  Dipanggil setelah PDF.js / Tesseract selesai
// ════════════════════════════════════════════════════════════════
function autoDetectSource(rawText) {
  const t = rawText;

  // Stockbit Trade Confirmation
  if (/STOCKBIT/i.test(t) && /Trade\s*Confirmation/i.test(t))
    return 'stockbit_trade';

  // Pluang email beli crypto
  if (/pluang/i.test(t) && /purchase.*was\s+successful|Amount\s+[\d.]+\s+units/i.test(t))
    return 'pluang_email';

  // Krom deposito email
  if (/krom/i.test(t) && /Deposito.*Berhasil\s+Dibuat|Saldo\s+Awal\s*:\s*Rp/i.test(t))
    return 'krom_email';

  // Pintu
  if (/pintu/i.test(t) && /(?:Beli|Buy)\s+(?:BTC|ETH|XRP)/i.test(t))
    return 'pintu';

  // Tokocrypto
  if (/tokocrypto/i.test(t) && /BUY.*\/IDR|Qty:/i.test(t))
    return 'tokocrypto';

  // Indodax Tax Report PDF — cek lebih spesifik dulu
  if (/indodax/i.test(t) && /Final\s+Tax\s+Collection\s+Slip|Tax\s+Collection\s+Slip/i.test(t))
    return 'indodax-tax';

  // Indodax (copy-paste order history)
  if (/indodax/i.test(t))
    return 'indodax';

  // Tokocrypto Tax Report PDF
  if (/tokocrypto/i.test(t) && /Ringkasan\s+Pemotongan\s+Pajak|PT\.\s*Aset\s+Digital/i.test(t))
    return 'tokocrypto-tax';

  // Floq Tax Report PDF
  if (/floq|Kripto\s+Maksima\s+Koin/i.test(t) && /Laporan\s+Pajak\s+Aset\s+Kripto/i.test(t))
    return 'floq-tax';

  // Pluang CSV
  if (/Order\s+Date.*Order\s+Time.*Transaction\s+Type/i.test(t) && /Bumi\s+Sent?osa/i.test(t))
    return 'pluang-csv';

  // Binance CSV
  if (/Date\(UTC\).*Pair.*Side.*Price/i.test(t) || /BTCUSDT.*BUY/i.test(t))
    return 'binance';

  // PORTFOLIO.SYS PDF export (self-import)
  if (/PORTFOLIO\.SYS/i.test(t) && /CRYPTO\s+HOLDINGS|GOLD\s+HOLDINGS|STOCK\s+HOLDINGS/i.test(t))
    return 'portfolio-sys';

  // Bibit
  if (/bibit/i.test(t) && /lot/i.test(t))
    return 'bibit';

  // Stockbit portfolio (copy-paste, bukan PDF konfirmasi)
  if (/stockbit/i.test(t) && /rata-rata|avg/i.test(t))
    return 'stockbit';

  return null; // tidak dideteksi → biarkan user pilih manual
}

function applyAutoDetect(rawText) {
  const detected = autoDetectSource(rawText);
  if (!detected) return;

  // Update state & dropdown
  _impSource = detected;
  const sel = document.getElementById('impSourceSel');
  if (sel) sel.value = detected;

  // Update template hint
  impRenderTemplate();

  // Tampilkan notif kecil
  const fn = document.getElementById('impFileName');
  if (fn) fn.textContent += ` — Detected: ${IMPORT_RULES[detected]?.label || detected}`;
}

// ── PDF extraction ───────────────────────────────────────────────
async function impHandlePdf(filesOrFile){
  // Terima FileList (multi) atau File tunggal
  const files = (filesOrFile instanceof FileList)
    ? Array.from(filesOrFile)
    : (filesOrFile ? [filesOrFile] : []);
  if(!files.length) return;

  const progress=document.getElementById('impProgress');
  const fill=document.getElementById('impProgFill');
  const txt=document.getElementById('impProgText');
  progress.style.display='block'; fill.style.width='5%';
  txt.textContent=`${impT('loading_pdf','Loading','Memuat')} ${files.length} PDF...`;

  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  if(pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc=
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  _impRaw = '';
  let totalPages = 0;

  for(let fi=0; fi<files.length; fi++){
    const file = files[fi];
    txt.textContent=`(${fi+1}/${files.length}) ${impT('reading','Reading','Membaca')}: ${file.name}...`;
    try{
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({data:arrayBuffer}).promise;
      let fileText='';
      for(let i=1;i<=pdf.numPages;i++){
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Kelompokkan item berdasarkan posisi Y (baris yang sama = Y hampir sama)
        // agar tabel PDF tidak hancur saat diekstrak
        const items = content.items;
        if (items.length === 0) { fileText += '\n'; continue; }

        // Sort by Y descending (PDF Y dari bawah ke atas), lalu X ascending
        const sorted = [...items].sort((a, b) => {
          const dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
          return dy !== 0 ? dy : a.transform[4] - b.transform[4];
        });

        // Grouping: item dalam baris yang sama jika Y-nya beda < 3px
        let lines = [], curLine = [], curY = null;
        for (const item of sorted) {
          const y = Math.round(item.transform[5]);
          if (curY === null || Math.abs(y - curY) <= 3) {
            curLine.push(item.str);
            curY = y;
          } else {
            if (curLine.length) lines.push(curLine.join(' '));
            curLine = [item.str];
            curY = y;
          }
        }
        if (curLine.length) lines.push(curLine.join(' '));
        fileText += lines.join('\n') + '\n';

        const overall = ((fi/files.length) + (1/files.length)*(i/pdf.numPages))*90 + 5;
        fill.style.width=overall+'%';
      }
      // Tambah separator antar file agar tidak tercampur
      _impRaw += (fi>0 ? '\n\n--- FILE: '+file.name+' ---\n\n' : '') + fileText;
      totalPages += pdf.numPages;
    } catch(e){
      txt.textContent=`Gagal: ${file.name} — ${e.message}`;
      console.error(e);
    }
  }

  // Update nama file di UI
  const fn = document.getElementById('impFileName');
  if(fn) fn.textContent = files.length===1
    ? ''+files[0].name
    : `${files.length} file (${totalPages} pages)`;

  applyAutoDetect(_impRaw);
  fill.style.width='100%';
  txt.textContent=`${totalPages} pages from ${files.length} file diekstrak — ${_impRaw.length} karakter`;
  setTimeout(()=>progress.style.display='none',2500);
}

// ── OCR extraction ───────────────────────────────────────────────
async function impHandleOcr(filesOrFile){
  const files = (filesOrFile instanceof FileList)
    ? Array.from(filesOrFile)
    : (filesOrFile ? [filesOrFile] : []);
  if(!files.length) return;

  const progress=document.getElementById('impProgress');
  const fill=document.getElementById('impProgFill');
  const txt=document.getElementById('impProgText');
  progress.style.display='block'; fill.style.width='3%';
  txt.textContent=`${impT('starting_ocr','Starting OCR for','Memulai OCR')} ${files.length} ${impT('images','image(s)','gambar')}...`;

  _impRaw = '';
  const { createWorker } = Tesseract;
  // Buat 1 worker, reuse untuk semua file
  const worker = await createWorker(['ind','eng'],1,{
    logger: m => {
      if(m.status==='recognizing text'){
        // progress sudah diatur per-file di loop bawah
      }
    }
  });

  for(let fi=0; fi<files.length; fi++){
    const file = files[fi];
    const base = (fi/files.length)*90 + 3;
    txt.textContent=`OCR (${fi+1}/${files.length}): ${file.name}...`;
    try{
      const result = await worker.recognize(file, {}, {
        logger: m => {
          if(m.status==='recognizing text'){
            fill.style.width=(base + m.progress*(90/files.length))+'%';
          }
        }
      });
      const text = result.data.text;
      _impRaw += (fi>0 ? '\n\n--- FILE: '+file.name+' ---\n\n' : '') + text;
    } catch(e){
      txt.textContent=`OCR gagal: ${file.name} — ${e.message}`;
      console.error(e);
    }
  }

  await worker.terminate();
  const fn = document.getElementById('impFileName');
  if(fn) fn.textContent = files.length===1
    ? ''+files[0].name
    : `${files.length} images`;

  applyAutoDetect(_impRaw);
  fill.style.width='100%';
  txt.textContent=`OCR done — ${_impRaw.length} karakter dari ${files.length} file`;
  setTimeout(()=>progress.style.display='none',2500);
}

async function impHandleCsv(filesOrFile) {
  const files = filesOrFile instanceof FileList ? Array.from(filesOrFile)
              : Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
  if (!files.length) return;

  const progress = document.getElementById('impProgress');
  const fill     = document.getElementById('impProgFill');
  const txt      = document.getElementById('impProgText');
  if (progress) progress.style.display = '';
  if (fill) fill.style.width = '20%';
  if (txt) txt.textContent = 'Membaca CSV...';

  _impRaw = '';
  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    try {
      const text = await file.text();
      _impRaw += (fi > 0 ? '\n\n--- FILE: ' + file.name + ' ---\n\n' : '') + text;
      if (fill) fill.style.width = Math.round(((fi + 1) / files.length) * 90 + 5) + '%';
    } catch(e) {
      if (txt) txt.textContent = 'Failed: ' + file.name + ' — ' + e.message;
    }
  }

  const fn = document.getElementById('impFileName');
  if (fn) fn.textContent = files.length === 1
    ? files[0].name
    : `${files.length} CSV files`;

  applyAutoDetect(_impRaw);
  if (fill) fill.style.width = '100%';
  if (txt) txt.textContent = `${_impRaw.length} chars from ${files.length} CSV files`;
  setTimeout(() => { if (progress) progress.style.display = 'none'; }, 2500);
}

function impHandleDrop(e){
  e.preventDefault();
  document.getElementById('impDropzone')?.classList.remove('drag');
  const files = e.dataTransfer?.files;
  if(!files || !files.length) return;
  const pdfs = Array.from(files).filter(f=>f.type==='application/pdf');
  const imgs = Array.from(files).filter(f=>f.type.startsWith('image/'));
  const csvs = Array.from(files).filter(f=>f.name.match(/\.(csv|txt)$/i));
  if(pdfs.length) impHandlePdf(pdfs);
  if(imgs.length) impHandleOcr(imgs);
  if(csvs.length) impHandleCsv(csvs);
}

// ── Parsing & Preview ────────────────────────────────────────────
function impNext(){
  if(_impStep===1){
    // Grab text from textarea if text mode
    if(_impMethod==='text'){
      const ta = document.getElementById('impTextarea');
      if(ta) _impRaw = ta.value;
    }
    if(!_impRaw.trim()){
      alert(impT('no_data','No data! Paste text or upload a file first.','Belum ada data! Tempelkan teks atau upload file terlebih dahulu.'));
      return;
    }
    // Parse
    const rule = IMPORT_RULES[_impSource];
    if(!rule){ alert(impT('unknown_src','Unknown source','Sumber tidak dikenal')); return; }
    try{
      _impResults = rule.parse(_impRaw).map(r=>({...r, _checked:true, _id:uid()}));
    } catch(e){
      alert('Parse error: '+e.message); console.error(e); return;
    }
    if(_impResults.length===0){
      alert(impT('parse_fail','No data could be parsed.\n\nMake sure the text format matches the example shown.','Tidak ada data yang berhasil di-parse.\n\nPastikan format teks sesuai dengan contoh yang ditampilkan.'));
      return;
    }
    _impStep=2;
    impRenderStep();
  }
  else if(_impStep===2){
    // Commit import
    const toAdd = _impResults.filter(r=>r._checked);
    for(const r of toAdd){
      const {_checked,_id,...item}=r;
      if(item.type==='crypto'){
        getDATA().crypto.push({id:uid(),coin:item.coin,name:item.name,amount:item.amount,
          costBasisIdr:item.costBasisIdr,platform:item.platform,date:item.date});
      } else if(item.type==='stocks'){
        getDATA().stocks.push({id:uid(),ticker:item.ticker,name:item.name,shares:item.shares,
          seedPrice:item.seedPrice,market:item.market,broker:item.broker,date:item.date,
          annualYield:0});
      } else if(item.type==='savings'){
        getDATA().savings.push({id:uid(),name:item.name,bank:item.bank,currency:item.currency,
          foreignAmt:item.foreignAmt,idr:item.idr,annualYield:item.annualYield||0,
          note:item._note||'',date:item.date});
      } else if(item.type==='gold'){
        getDATA().gold.push({id:uid(),name:item.name,grams:item.grams,
          costBasisPerGram:item.costBasisPerGram,date:item.date});
      }
    }
    saveDataToCloud();
    renderAll();
    _impStep=3;
    impRenderStep();
  }
}

function impBack(){
  if(_impStep===2){ _impStep=1; impRenderStep(); }
}

function impToggleRow(id){
  const r=_impResults.find(x=>x._id===id);
  if(r){ r._checked=!r._checked; }
  const row=document.getElementById('impRow-'+id);
  if(row) row.classList.toggle('unchecked',!r._checked);
  const addBtn=document.getElementById('impNextBtn');
  if(addBtn) addBtn.textContent=`${impT('add','Add','Tambah')} ${_impResults.filter(r=>r._checked).length} ${impT('items','Items →','Item →')}`;
  addBtn.disabled=_impResults.filter(r=>r._checked).length===0;
}

function impToggleAll(){
  const anyUnchecked = _impResults.some(r=>!r._checked);
  _impResults.forEach(r=>r._checked=anyUnchecked);
  impRenderPreview(document.getElementById('impBody'));
  const addBtn=document.getElementById('impNextBtn');
  if(addBtn){ 
    addBtn.textContent=`${impT('add','Add','Tambah')} ${_impResults.filter(r=>r._checked).length} ${impT('items','Items →','Item →')}`;
    addBtn.disabled=_impResults.filter(r=>r._checked).length===0;
  }
}

function impRenderPreview(body){
  const ok  = _impResults.filter(r=>r._checked).length;
  const all = _impResults.length;
  body.innerHTML=`
    <div class="imp-preview-header">
      <div class="imp-preview-count">
        <span class="ok">${all}</span> ${impT('found','items found —','item ditemukan —')}
        <span class="ok">${ok}</span> ${impT('selected','selected','dipilih')}
      </div>
      <button class="imp-toggle-all" onclick="impToggleAll()">${impT('toggle_all','Select/Deselect All','Pilih/Hapus Semua')}</button>
    </div>
    <table class="imp-table">
      <thead><tr>
        <th></th><th>${impT('type','Type','Tipe')}</th><th>${impT('asset','Asset','Aset')}</th><th>${impT('qty','Qty / Amount','Qty / Jumlah')}</th><th>${impT('cost','Cost (IDR)','Modal (IDR)')}</th><th>Platform</th>
      </tr></thead>
      <tbody>
        ${_impResults.map(r=>{
          const typeBadge=`<span class="imp-type-badge imp-type-${r.type}">${r.type}</span>`;
          let assetCell='', qtyCell='', costCell='', platCell='';
          if(r.type==='crypto'){
            assetCell=`<strong>${r.coin}</strong> <span style="color:var(--muted);font-size:9px">${r.name}</span>`;
            qtyCell=`${r.amount}`;
            costCell=`Rp ${Math.round(r.costBasisIdr).toLocaleString('id-ID')}`;
            platCell=r.platform||'–';
          } else if(r.type==='stocks'){
            assetCell=`<strong>${r.ticker}</strong> <span style="color:var(--muted);font-size:9px">${r.name||''}</span>`;
            qtyCell=`${r.shares} ${r.market==='IDX'?'lot':'shares'}`;
            costCell=`Rp ${(r.seedPrice||0).toLocaleString('id-ID')} / ${r.market==='IDX'?'lembar':'share'}`;
            platCell=r.broker||'–';
          } else if(r.type==='gold'){
            assetCell=`<strong>${r.name}</strong>`;
            qtyCell=`${r.grams} g`;
            costCell=`Rp ${Math.round((r.costBasisPerGram||0) * r.grams).toLocaleString('id-ID')}`;
            platCell='antam';
          } else {
            assetCell=`<strong>${r.name}</strong>`;
            qtyCell=`${r.currency} ${(r.foreignAmt||0).toLocaleString('id-ID')}`;
            costCell=`Rp ${Math.round(r.idr||0).toLocaleString('id-ID')}`;
            platCell=r.bank||'–';
          }
          return `<tr id="impRow-${r._id}" class="${r._checked?'':'unchecked'}" onclick="impToggleRow('${r._id}')">
            <td><input type="checkbox" class="imp-row-check" ${r._checked?'checked':''} onclick="event.stopPropagation();impToggleRow('${r._id}')"></td>
            <td>${typeBadge}</td>
            <td>${assetCell}</td>
            <td>${qtyCell}</td>
            <td style="font-family:'JetBrains Mono',monospace">${costCell}</td>
            <td><span class="ptag t-${platCell}" style="font-size:7px">${platCell}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${_impResults.length===0?`<div class="no-results">Tidak ada item yang berhasil di-parse</div>`:''}
    <div class="imp-warn-msg">
      ${impT('warn','Review data before importing. Click rows to check/uncheck.\n      Imported data will be added to existing assets.','Periksa data sebelum import. Klik baris untuk centang/uncentang.\n      Data yang diimport akan ditambahkan ke aset yang sudah ada.')}
    </div>
  `;
}

window.openImport=openImport; window.closeImport=closeImport;
window.impNext=impNext; window.impBack=impBack;
window.impToggleRow=impToggleRow; window.impToggleAll=impToggleAll;
window.impSetMethod=impSetMethod; window.impChangeSource=impChangeSource;
window.impHandlePdf=impHandlePdf; window.impHandleOcr=impHandleOcr; window.impHandleCsv=impHandleCsv;
window.impHandleDrop=impHandleDrop; window.impCopyTemplate=impCopyTemplate;
document.getElementById('impOverlay').addEventListener('click',e=>{
  if(e.target.id==='impOverlay') closeImport();
});
