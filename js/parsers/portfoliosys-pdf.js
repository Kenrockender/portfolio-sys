/**
 * Parser untuk Laporan PDF Internal PORTFOLIO.SYS
 */

export const PORTFOLIOSYS_PARSERS = {
  'portfoliosys-pdf': {
    label: 'PORTFOLIO.SYS — Internal Report (PDF)',
    category: 'auto',
    hint: `Upload PDF Laporan PORTFOLIO.SYS\n\nParser membaca:\n• Crypto, Gold, Stocks, Savings\n• Kuantitas & Modal (Cost Basis)\n• Tanggal transaksi\n• Platform asal`,
    parse(raw) {
      const results = [];
      
      // Helper untuk parsing format IDR (contoh: 1.234.567)
      const parseIdrNum = (str) => {
        if(!str) return 0;
        str = str.toString().trim();
        const cleaned = str.replace(/\s/g,'');
        if(cleaned.includes('.') && cleaned.includes(',')){
          const dotPos  = cleaned.lastIndexOf('.');
          const commaPos= cleaned.lastIndexOf(',');
          if(commaPos > dotPos){
            return parseFloat(cleaned.replace(/\./g,'').replace(',','.')) || 0;
          } else {
            return parseFloat(cleaned.replace(/,/g,'')) || 0;
          }
        }
        if(cleaned.includes('.')){ 
          const parts = cleaned.split('.');
          if(parts.length > 2) return parseFloat(cleaned.replace(/\./g,'')) || 0;
          if(parts[parts.length-1].length === 3) return parseFloat(cleaned.replace(/\./g,'')) || 0;
          return parseFloat(cleaned) || 0;
        }
        if(cleaned.includes(',')){ 
          const parts = cleaned.split(',');
          if(parts.length > 2) return parseFloat(cleaned.replace(/,/g,'')) || 0;
          if(parts[parts.length-1].length === 3) return parseFloat(cleaned.replace(/,/g,'')) || 0;
          return parseFloat(cleaned.replace(',','.')) || 0;
        }
        return parseFloat(cleaned) || 0;
      };

      // Helper untuk parsing format Juta (contoh: Rp 1.88Jt)
      const parseJt = (str) => {
        if(!str) return 0;
        let s = str.replace(/Rp\s*/i, '').replace(/,/g, '').trim();
        if (/Jt$/i.test(s)) {
          return parseFloat(s.replace(/Jt/i, '')) * 1000000;
        }
        return parseIdrNum(s);
      };

      // Isolasi blok teks berdasarkan seksi untuk menghindari regex bocor ke tabel lain
      const cryptoBlock = raw.match(/CRYPTO HOLDINGS[\s\S]*?(?=GOLD HOLDINGS|STOCK HOLDINGS|SAVINGS|PORTFOLIO\.SYS|$)/i)?.[0] || '';
      const goldBlock = raw.match(/GOLD HOLDINGS[\s\S]*?(?=STOCK HOLDINGS|SAVINGS|PORTFOLIO\.SYS|$)/i)?.[0] || '';
      const stockBlock = raw.match(/STOCK HOLDINGS[\s\S]*?(?=SAVINGS|PORTFOLIO\.SYS|$)/i)?.[0] || '';
      const savingsBlock = raw.match(/SAVINGS[\s\S]*?(?=PORTFOLIO\.SYS|$)/i)?.[0] || '';

      // 1. Ekstrak Crypto
      const cryptoRe = /([a-zA-Z0-9\s-]+?)\s*\(([^)]+)\)[\s",]+([\d.,]+)\s*([A-Za-z0-9]{2,7})[\s\S]{1,40}?Rp\s*[\d.,]+(?:Jt)?[\s",]+(?:Rp\s*)?([\d.,]+(?:Jt)?)[\s",]+(\d{4}-\d{2}-\d{2})/gi;
      for (const m of cryptoBlock.matchAll(cryptoRe)) {
        results.push({
          type: 'crypto',
          name: m[1].trim(),
          platform: m[2].trim(),
          amount: parseFloat(m[3].replace(/,/g, '.')), // format US dot untuk crypto
          coin: m[4].toUpperCase(),
          costBasisIdr: parseJt(m[5]),
          date: m[6]
        });
      }

      // 2. Ekstrak Gold
      const goldRe = /(Antam[\s\w]+?)[\s",]+([\d.,]+)\s*g[\s\S]{1,40}?Rp\s*[\d.,]+(?:Jt)?[\s",]+(?:Rp\s*)?([\d.,]+(?:Jt)?)[\s",]+(\d{4}-\d{2}-\d{2})/gi;
      for (const m of goldBlock.matchAll(goldRe)) {
        results.push({
          type: 'gold',
          name: m[1].trim(),
          amount: parseFloat(m[2].replace(/,/g, '.')),
          costBasisIdr: parseJt(m[3]),
          date: m[4]
        });
      }

      // 3. Ekstrak Stocks
      const stockRe = /([A-Za-z0-9\s]+?)\s*\([^)]*?\)[\s",]+([\d.,]+)\s*lot[\s\S]{1,40}?Rp\s*[\d.,]+(?:Jt)?[\s",]+(?:Rp\s*)?([\d.,]+(?:Jt)?)[\s",]+(\d{4}-\d{2}-\d{2})/gi;
      for (const m of stockBlock.matchAll(stockRe)) {
        let name = m[1].trim();
        let shares = parseInt(m[2].replace(/,/g, ''));
        let costBasis = parseJt(m[3]);
        let seedPrice = Math.round(costBasis / (shares * 100)); // IDX: 100 lembar/lot
        results.push({
          type: 'stocks',
          ticker: name.substring(0, 4).toUpperCase(), // Ambil 4 huruf pertama jika tidak ada ticker penuh
          name: name,
          shares: shares,
          seedPrice: seedPrice,
          market: 'IDX',
          broker: 'manual',
          date: m[4]
        });
      }

      // 4. Ekstrak Savings
      const savRe = /"?([^",\n]+)"?[\s",]+([A-Za-z]{3})\s+([\d.,]+)[\s",]+(?:Rp\s*)?([\d.,]+(?:Jt)?)[\s",]*(\d{4}-\d{2}-\d{2})/gi;
      for (const m of savingsBlock.matchAll(savRe)) {
        if(m[1].includes("PORTFOLIO")) continue; // Skip jika header match bocor
        results.push({
          type: 'savings',
          name: m[1].trim(),
          currency: m[2].toUpperCase(),
          foreignAmt: parseFloat(m[3].replace(/,/g, '')),
          idr: parseJt(m[4]),
          bank: m[1].trim().split(' ')[0].toLowerCase(),
          date: m[5]
        });
      }

      return results;
    }
  }
};