/**
 * Unit tests for the financial math in js/storage.js.
 *
 * These functions read the live S (prices/settings) and DATA (holdings)
 * singletons exported by state.js, so each test sets those up explicitly.
 * Covers the numbers that actually matter: totals, P&L, FX conversion,
 * lot multipliers, broker/crypto fees, tax mode, income, and analytics.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { S, DATA } from '../js/state.js';
import {
  stockMul, savingsIdr, totals, computeMetrics, assetMetrics,
  calcStockFees, calcCryptoFees, applyTax, computeAnnualIncome,
  computePortfolioAnalytics,
} from '../js/storage.js';

beforeEach(() => {
  // Deterministic prices / settings.
  S.currency = 'IDR';
  S.taxMode = 'pre';
  S.usdIdr = 16_000;
  S.btcIdr = 1_000_000_000;
  S.ethIdr = 50_000_000;
  S.xrpIdr = 10_000;
  S.goldGramIdr = 1_500_000;
  S.stockPrices = {};
  S.altcoinPrices = {};
  S.fxRates = { IDR: 1, USD: 16_000, SGD: 12_000, JPY: 107 };
  S.historyData = [];

  // Empty holdings by default; individual tests fill what they need.
  DATA.crypto = [];
  DATA.gold = [];
  DATA.stocks = [];
  DATA.savings = [];
});

describe('stockMul — lot multiplier', () => {
  it('IDX ordinary stock = 100 shares/lot', () => {
    expect(stockMul({ market: 'IDX', ticker: 'BBCA' })).toBe(100);
  });
  it('IDX index ticker (^IHSG) = 1 (index level, not a lot)', () => {
    expect(stockMul({ market: 'IDX', ticker: '^IHSG' })).toBe(1);
  });
  it('US stock = 1 share', () => {
    expect(stockMul({ market: 'US', ticker: 'AAPL' })).toBe(1);
  });
  it('INDEX fund = 1', () => {
    expect(stockMul({ market: 'INDEX', ticker: '^GSPC' })).toBe(1);
  });
});

describe('savingsIdr — FX conversion', () => {
  it('IDR account returns its balance directly', () => {
    expect(savingsIdr({ currency: 'IDR', foreignAmt: 5_000_000 })).toBe(5_000_000);
  });
  it('USD account converts at the current rate', () => {
    expect(savingsIdr({ currency: 'USD', foreignAmt: 500 })).toBe(500 * 16_000);
  });
  it('unknown currency falls back to rate 1', () => {
    expect(savingsIdr({ currency: 'XXX', foreignAmt: 100 })).toBe(100);
  });
});

describe('totals — portfolio valuation', () => {
  it('sums each class with correct multipliers', () => {
    DATA.crypto  = [{ coin: 'BTC', amount: 0.5 }];                 // 0.5 * 1e9 = 500,000,000
    DATA.gold    = [{ grams: 10 }];                                // 10 * 1.5e6 = 15,000,000
    DATA.stocks  = [{ market: 'IDX', ticker: 'BBCA', shares: 2, seedPrice: 9_000 }]; // 2*100*9000 = 1,800,000
    DATA.savings = [{ currency: 'USD', foreignAmt: 100 }];         // 100 * 16,000 = 1,600,000
    const T = totals();
    expect(T.c).toBe(500_000_000);
    expect(T.g).toBe(15_000_000);
    expect(T.k).toBe(1_800_000);
    expect(T.sv).toBe(1_600_000);
    expect(T.t).toBe(500_000_000 + 15_000_000 + 1_800_000 + 1_600_000);
  });

  it('uses live stock price over seed price when available', () => {
    DATA.stocks = [{ market: 'IDX', ticker: 'BBCA', shares: 1, seedPrice: 9_000 }];
    S.stockPrices = { BBCA: 10_000 };
    expect(totals().k).toBe(1 * 100 * 10_000);
  });
});

describe('computeMetrics — P&L and return %', () => {
  it('computes gain and return for a profitable crypto position', () => {
    DATA.crypto = [{ coin: 'BTC', amount: 1, costBasisIdr: 800_000_000 }]; // val 1e9, cost 8e8
    const M = computeMetrics(totals());
    expect(M.crypto.val).toBe(1_000_000_000);
    expect(M.crypto.cost).toBe(800_000_000);
    expect(M.crypto.pnl).toBe(200_000_000);
    expect(M.crypto.ret).toBeCloseTo(25, 6);
  });
  it('returns null P&L when there is no cost basis', () => {
    DATA.crypto = [{ coin: 'BTC', amount: 1, costBasisIdr: 0 }];
    const M = computeMetrics(totals());
    expect(M.crypto.pnl).toBeNull();
    expect(M.crypto.ret).toBeNull();
  });
});

describe('assetMetrics — per-asset', () => {
  it('gold uses costBasisPerGram', () => {
    const m = assetMetrics('gold', { grams: 10, costBasisPerGram: 1_000_000 });
    expect(m.val).toBe(15_000_000);   // 10 * 1.5e6
    expect(m.cost).toBe(10_000_000);  // 10 * 1e6
    expect(m.pnl).toBe(5_000_000);
    expect(m.ret).toBeCloseTo(50, 6);
  });
  it('savings has no P&L (cost == value)', () => {
    const m = assetMetrics('savings', { currency: 'IDR', foreignAmt: 3_000_000 });
    expect(m.val).toBe(3_000_000);
    expect(m.pnl).toBeNull();
  });
});

describe('calcStockFees', () => {
  it('buy fee uses the broker buy rate, no stamp duty unless requested', () => {
    const f = calcStockFees(10_000_000, 'stockbit', 'buy');
    expect(f.fee).toBe(15_000);   // 10M * 0.0015
    expect(f.stampDuty).toBe(0);
    expect(f.total).toBe(15_000);
  });
  it('sell above threshold with stamp duty enabled adds the duty', () => {
    const f = calcStockFees(20_000_000, 'stockbit', 'sell', true);
    expect(f.fee).toBe(50_000);   // 20M * 0.0025
    expect(f.stampDuty).toBe(10_000);
    expect(f.total).toBe(60_000);
  });
  it('value exactly at the threshold does not trigger stamp duty', () => {
    const f = calcStockFees(10_000_000, 'stockbit', 'sell', true);
    expect(f.stampDuty).toBe(0);
  });
  it('pluang adds US SEC + TAF fees', () => {
    const f = calcStockFees(10_000_000, 'pluang', 'buy');
    expect(f.fee).toBe(30_000);   // 10M * 0.003
    expect(f.usFees).toBe(Math.round(10_000_000 * (0.0000227 + 0.0000278)));
    expect(f.total).toBe(f.fee + f.usFees);
  });
  it('unknown broker falls back to the default rate', () => {
    expect(calcStockFees(10_000_000, 'no-such-broker', 'buy').fee).toBe(15_000);
  });
});

describe('calcCryptoFees', () => {
  it('taker-fee platform (indodax) + PPh22', () => {
    const f = calcCryptoFees(10_000_000, 'indodax', 'buy');
    expect(f.platformFee).toBe(30_000);  // 10M * 0.003 taker
    expect(f.pph22).toBe(21_000);        // 10M * 0.0021
    expect(f.total).toBe(51_000);
  });
  it('spread platform (pintu) uses the average of min/max', () => {
    const f = calcCryptoFees(10_000_000, 'pintu', 'buy');
    expect(f.platformFee).toBe(125_000); // 10M * (0.005+0.02)/2
    expect(f.total).toBe(125_000 + 21_000);
  });
  it('zero-fee platform (floq) still charges PPh22', () => {
    const f = calcCryptoFees(10_000_000, 'floq', 'buy');
    expect(f.platformFee).toBe(0);
    expect(f.total).toBe(21_000);
  });
});

describe('applyTax', () => {
  it('pre-tax mode returns P&L unchanged', () => {
    S.taxMode = 'pre';
    expect(applyTax(1_000_000, 'savings')).toBe(1_000_000);
  });
  it('non-positive P&L is never taxed', () => {
    S.taxMode = 'post';
    expect(applyTax(-500, 'savings')).toBe(-500);
    expect(applyTax(0, 'savings')).toBe(0);
  });
  it('savings interest taxed at 20% in post mode', () => {
    S.taxMode = 'post';
    expect(applyTax(1_000_000, 'savings')).toBe(800_000);
  });
  it('crypto post-tax subtracts sell fees from gain', () => {
    S.taxMode = 'post';
    const asset = { coin: 'BTC', amount: 1, platform: 'indodax' }; // val = 1e9
    const fees = calcCryptoFees(1_000_000_000, 'indodax', 'sell', true);
    expect(applyTax(500_000_000, 'crypto', asset)).toBe(500_000_000 - fees.total);
  });
});

describe('computeAnnualIncome', () => {
  it('sums dividend yield (stocks) and interest (savings)', () => {
    DATA.stocks = [{ market: 'IDX', ticker: 'BBCA', shares: 1, seedPrice: 10_000, annualYield: 3 }]; // val 1,000,000 * 3%
    DATA.savings = [{ currency: 'IDR', foreignAmt: 10_000_000, annualYield: 5 }];                    // 10M * 5%
    const inc = computeAnnualIncome();
    expect(inc.stocks).toBeCloseTo(30_000, 6);
    expect(inc.savings).toBeCloseTo(500_000, 6);
    expect(inc.total).toBeCloseTo(530_000, 6);
  });
});

describe('computePortfolioAnalytics', () => {
  it('returns null with fewer than 2 data points', () => {
    S.historyData = [{ date: '2026-01-01', value: 100 }];
    expect(computePortfolioAnalytics()).toBeNull();
  });
  it('computes total return across the history window', () => {
    S.historyData = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 110 },
      { date: '2026-01-03', value: 120 },
    ];
    const a = computePortfolioAnalytics();
    expect(a.totalReturn).toBeCloseTo(20, 6); // 120/100 - 1
    expect(a.dataPoints).toBe(3);
    expect(a.maxDD).toBe(0); // monotonically rising → no drawdown
  });
});
