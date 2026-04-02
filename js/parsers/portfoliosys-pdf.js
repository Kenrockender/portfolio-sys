
export const PORTFOLIOSYS_PARSERS = {
  'portfoliosys-pdf': {
    label: 'PORTFOLIO.SYS — Report PDF',
    category: 'auto',
    hint: `Upload PDF Laporan dari PORTFOLIO.SYS\n\nParser membaca:\n• Crypto (coin, platform, jumlah, cost basis)\n• Gold (berat gram, cost basis/gram)\n• Stocks IDX (nama, lot, harga beli)\n• Savings (mata uang, saldo)`,
    parse(raw) {
      const results = [];

      // ── Helper: parse angka IDR/Jt ────────────────────────────
      const parseJt = (str) => {
        if (!str || /^[–\-]$/.test(str.trim())) return 0;
        str = str.toString().trim().replace(/^Rp\s*/i, '').trim();
        if (/Jt$/i.test(str)) return parseFloat(str.replace(/Jt/i, '')) * 1_000_000;
        // IDR: titik = pemisah ribuan
        const noThousands = str.replace(/\./g, '').replace(',', '.');
        return parseFloat(noThousands) || 0;
      };

      // ── Helper: isolasi blok per seksi ────────────────────────
      const getBlock = (start, end) => {
        const re = new RegExp(
          `${start}[\\s\\S]*?(?=${end}|PORTFOLIO\\.SYS\\s*—|$)`, 'i'
        );
        return raw.match(re)?.[0] || '';
      };

      const cryptoBlock = getBlock('CRYPTO HOLDINGS', 'GOLD HOLDINGS');
      const goldBlock   = getBlock('GOLD HOLDINGS',   'STOCK HOLDINGS');
      const stockBlock  = getBlock('STOCK HOLDINGS',  'SAVINGS');
      const savBlock    = getBlock('SAVINGS',          'PORTFOLIO\\.SYS\\s*—');

      // ── CRYPTO ────────────────────────────────────────────────
      // Format PDF: "Bitcoin (indodax) 0.05621301 BTC Rp 68.04Jt Rp 54.86Jt 2023-12-20"
      // Nilai (kolom 3) diabaikan — hanya Modal (kolom 4) yang dipakai untuk costBasisIdr
      const cryptoRe = /([A-Za-z][A-Za-z\s]+?)\s*\(([^)]+)\)\s+([\d.]+)\s+([A-Z]{2,6})\s+Rp\s+[\d.,]+(?:Jt)?\s+Rp\s+([\d.,]+(?:Jt)?)\s+(\d{4}-\d{2}-\d{2})/g;
      for (const m of cryptoBlock.matchAll(cryptoRe)) {
        const name = m[1].trim();
        // Skip header baris jika ada
        if (name.toLowerCase() === 'nama') continue;
        results.push({
          type:         'crypto',
          name,
          platform:     m[2].trim().toLowerCase(),
          amount:       parseFloat(m[3]),
          coin:         m[4].toUpperCase(),
          costBasisIdr: parseJt(m[5]),
          date:         m[6],
        });
      }

      // ── GOLD ──────────────────────────────────────────────────
      // Format PDF: "Antam 25 gr 25g Rp 60.91Jt Rp 22.90Jt 2020-11-16"
      // Nama mengandung berat (misal "Antam 25 gr"), qty adalah "25g"
      const goldRe = /(Antam[^R\n]+?)\s+([\d.]+)\s*g\s+Rp\s+[\d.,]+(?:Jt)?\s+Rp\s+([\d.,]+(?:Jt)?)\s+(\d{4}-\d{2}-\d{2})/g;
      for (const m of goldBlock.matchAll(goldRe)) {
        const grams     = parseFloat(m[2]);
        const totalCost = parseJt(m[3]);
        results.push({
          type:              'gold',
          name:              m[1].trim(),
          grams,
          costBasisPerGram:  grams > 0 ? Math.round(totalCost / grams) : 0,
          date:              m[4],
        });
      }

      // ── STOCKS ────────────────────────────────────────────────
      // Format PDF: "Chandra Daya Investasi Tbk (st 2 lot Rp 156.000 Rp 357.000 2025-12-19"
      // CATATAN: jsPDF truncate nama broker dalam kurung — tidak ada closing ")"
      // sehingga regex original \([^)]*?\) GAGAL total.
      // Regex ini match \(\w+ tanpa membutuhkan closing paren.
      const IDX_REVERSE = {
        'chandra daya':        'CDIA',
        'bangun kosambi':      'CBDK',
        'bank central asia':   'BBCA',
        'bank rakyat':         'BBRI',
        'bank mandiri':        'BMRI',
        'bank negara':         'BBNI',
        'bank tabungan':       'BBTN',
        'bank syariah':        'BRIS',
        'bank jago':           'ARTO',
        'telkom':              'TLKM',
        'astra international': 'ASII',
        'unilever':            'UNVR',
        'indofood cbp':        'ICBP',
        'indofood sukses':     'INDF',
        'indocement':          'INTP',
        'semen indonesia':     'SMGR',
        'gudang garam':        'GGRM',
        'hm sampoerna':        'HMSP',
        'kalbe farma':         'KLBF',
        'goto':                'GOTO',
        'bukalapak':           'BUKA',
        'pantai indah kapuk':  'PANI',
        'adaro energy':        'ADRO',
        'bayan resources':     'BYAN',
        'vale indonesia':      'INCO',
        'aneka tambang':       'ANTM',
        'amman mineral':       'AMMN',
        'merdeka copper':      'MDKA',
        'xlsmart':             'EXCL',
        'indosat':             'ISAT',
        'bukit asam':          'PTBA',
        'chandra asri':        'TPIA',
      };
      const resolveTicker = (name) => {
        const lower = name.toLowerCase();
        for (const [key, ticker] of Object.entries(IDX_REVERSE)) {
          if (lower.includes(key)) return ticker;
        }
        return '';
      };

      const stockRe = /([A-Za-z][A-Za-z\s]+?Tbk)\s*\(\w+\s+(\d+)\s*lot\s+Rp\s+[\d.,]+(?:Jt)?\s+Rp\s+([\d.,]+(?:Jt)?)\s+(\d{4}-\d{2}-\d{2})/g;
      for (const m of stockBlock.matchAll(stockRe)) {
        const name   = m[1].trim();
        const shares = parseInt(m[2]);
        const cost   = parseJt(m[3]);
        results.push({
          type:        'stocks',
          ticker:      resolveTicker(name),
          name,
          shares,
          seedPrice:   shares > 0 ? Math.round(cost / (shares * 100)) : 0,
          market:      'IDX',
          broker:      'stockbit',
          date:        m[4],
          annualYield: 0,
        });
      }

      // ── SAVINGS ───────────────────────────────────────────────
      // Format PDF: "OCBC CAD 136.93 Rp 1.70Jt – 2025-07-28"
      //             "CNY 2026 IDR 6,250,000 Rp 6.25Jt – 2026-02-17"
      // CATATAN: kolom Modal selalu "–" (tidak ada cost basis untuk savings)
      // sehingga regex original gagal karena tidak handle karakter –
      const savRe = /^([^\n]+?)\s+(IDR|USD|CAD|SGD|AUD|EUR|GBP|JPY|HKD|CHF|NZD|CNH|CNY)\s+([\d,]+(?:\.\d+)?)\s+Rp\s+([\d.,]+(?:Jt)?)\s+[–\-]\s+(\d{4}-\d{2}-\d{2})/gm;
      for (const m of savBlock.matchAll(savRe)) {
        const name = m[1].trim();
        if (!name || name.toLowerCase() === 'nama') continue;
        const currency = m[2] === 'CNY' ? 'CNH' : m[2]; // normalize CNY → CNH
        results.push({
          type:        'savings',
          name,
          bank:        'other',
          currency,
          foreignAmt:  parseFloat(m[3].replace(/,/g, '')),
          idr:         parseJt(m[4]),
          annualYield: 0,
          date:        m[5],
        });
      }

      return results;
    }
  }
};