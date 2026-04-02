/* ════════════════════════════════════════════════════════════════
   portfolio-sys-parser-fix.js
   Patch untuk import-parsers.js — 3 perbaikan

   CARA APPLY:
   1. FIX #1 — Ganti seluruh blok 'portfolio-sys': { ... } di IMPORT_RULES
   2. FIX #2 — Ganti blok else if stocks di impNext() dengan versi baru
   3. FIX #3 — Tambah blok gold di impRenderPreview()
════════════════════════════════════════════════════════════════ */


/* ────────────────────────────────────────────────────────────────
   FIX #1 — Ganti seluruh blok 'portfolio-sys': { ... } di IMPORT_RULES
   (cari baris "  'portfolio-sys': {" dan ganti sampai closing "},")
──────────────────────────────────────────────────────────────── */

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
      // Cari dari window._POPULAR_STOCKS dulu, fallback ke tabel ini
      const IDX_TICKER_MAP = {
        'chandra daya':        'CDIA',
        'bangun kosambi':      'BKSL',
        'bank central asia':   'BBCA',
        'bank rakyat':         'BBRI',
        'bank mandiri':        'BMRI',
        'bank negara':         'BBNI',
        'telkom':              'TLKM',
        'astra international': 'ASII',
        'unilever':            'UNVR',
        'indofood':            'INDF',
        'kalbe farma':         'KLBF',
        'united tractors':     'UNTR',
        'merdeka copper':      'MDKA',
        'bukalapak':           'BUKA',
        'goto':                'GOTO',
        'elang mahkota':       'EMTK',
      };

      function guessTickerFromName(name) {
        // 1. Coba window._POPULAR_STOCKS (reverse lookup)
        const stocks = window._POPULAR_STOCKS || {};
        const nameLower = name.toLowerCase();
        for (const [t, n] of Object.entries(stocks)) {
          if (n && nameLower.startsWith(n.toLowerCase().slice(0, 8))) return t;
        }
        // 2. Coba IDX_TICKER_MAP di atas
        for (const [key, ticker] of Object.entries(IDX_TICKER_MAP)) {
          if (nameLower.includes(key)) return ticker;
        }
        // 3. Fallback: ambil 2 huruf pertama tiap kata (maks 4 kata) → ≤8 huruf
        //    Lebih baik dari slice(0,6) nama pertama
        const words = name.split(/\s+/).filter(w => w.length > 2 && !/tbk|pt\.|cv\./i.test(w));
        if (words.length >= 2) {
          return (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase();
        }
        return words[0]?.slice(0, 4).toUpperCase() || 'UNKN';
      }

      // ── FIX #1b: Broker map diperluas ──
      const brokerMap = {
        st:  'stockbit', sto: 'stockbit',
        bi:  'bibit',    bit: 'bibit',
        ip:  'indopremier',
        pl:  'pluang',
        bni: 'bni sekuritas',
        bca: 'bca sekuritas',
        mnd: 'mandiri sekuritas',
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
        if (/^SAVINGS$/i.test(line))          { section = 'savings'; continue; }
        if (/PORTFOLIO\.SYS\s*—/i.test(line)) { section = null;      continue; }
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
            const ticker = guessTickerFromName(name);           // FIX #1a
            const broker = brokerMap[m[2].toLowerCase()] || m[2].toLowerCase(); // FIX #1b
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
          const m = line.match(/^(.+?)\s+(IDR|USD|SGD|AUD|EUR|GBP|JPY|CAD|CNY|HKD|CHF|NZD)\s+([\d,]+(?:\.\d+)?)\s+Rp\s*([\d.,A-Za-z]+)\s+[–-]\s+(\d{4}-\d{2}-\d{2})/i);
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


/* ────────────────────────────────────────────────────────────────
   FIX #2 — Di dalam impNext(), cari blok:
     } else if(item.type==='savings'){
       getDATA().savings.push({...});
     }
   Dan TAMBAHKAN blok gold DI BAWAHNYA (sebelum closing brace):
──────────────────────────────────────────────────────────────── */

      } else if (item.type === 'gold') {
        // FIX #2: commit gold entries (sebelumnya tidak ada handler ini)
        getDATA().gold.push({
          id:               uid(),
          name:             item.name,
          grams:            item.grams,
          costBasisPerGram: item.costBasisPerGram,
          date:             item.date,
        });
      }


/* ────────────────────────────────────────────────────────────────
   FIX #3 — Di dalam impRenderPreview(), di bagian yang render tiap row
   Cari:
     if(r.type==='crypto'){
       ...
     } else if(r.type==='stocks'){
       ...
     } else {        ← ini catch-all untuk savings
       ...
     }
   Tambah blok gold SEBELUM else terakhir (atau di dalam else jika tidak
   ada blok gold):
──────────────────────────────────────────────────────────────── */

          } else if (r.type === 'gold') {
            // FIX #3: render gold di preview table
            assetCell = `<strong>${r.name}</strong>`;
            qtyCell   = `${r.grams} g`;
            costCell  = `Rp ${Math.round((r.costBasisPerGram || 0) * r.grams).toLocaleString('id-ID')}`;
            platCell  = 'antam';
          }
