/**
 * ══════════════════════════════════════════
 * PARSERS/BINANCE.JS - Binance Statement Parser
 * ══════════════════════════════════════════
 * [Fix 2] Parser belum diimplementasikan — throw error informatif
 * alih-alih return [] diam-diam.
 */

import { parseIdrNum, parseDate, COIN_NAMES } from './parser-utils.js';

/**
 * Deteksi apakah teks berasal dari export Binance.
 * @param {string} text
 * @returns {boolean}
 */
export function isBinanceData(text) {
  const indicators = ['binance', 'spot wallet', 'trade history', 'order history', 'User_ID'];
  const lower = text.toLowerCase();
  return indicators.some(ind => lower.includes(ind));
}

/**
 * Parse Binance export data.
 * @param {string} text - Raw text/CSV dari Binance
 * @throws {Error} Parser belum diimplementasikan
 */
export function parseBinance(text) {
  throw new Error(
    'Parser Binance belum tersedia.\n\n' +
    'Alternatif sementara:\n' +
    '• Export data dari Binance sebagai CSV\n' +
    '• Gunakan parser "Generic (IDX + US)" atau input manual\n\n' +
    'Format manual:\n' +
    '  BTC 0.005 95000000 2024-01-15\n' +
    '  ETH 0.8 33000000 2024-02-10'
  );
}

export const BINANCE_PARSER = {
  binance: {
    label:     'Binance (Coming Soon)',
    category:  'crypto',
    available: false,
    hint: `⚠ Parser Binance belum tersedia.

Sementara gunakan input manual:
  COIN JUMLAH COST_IDR TANGGAL
  BTC 0.005 95000000 2024-01-15`,
    parse: parseBinance,
  },
};

console.log('[PARSER:BINANCE] Binance parser module loaded (not yet implemented)');
