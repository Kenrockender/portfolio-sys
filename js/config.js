/**
 * ══════════════════════════════════════════
 * CONFIG.JS - Configuration Constants
 * ══════════════════════════════════════════
 * Contains all configuration, colors, translations, and constants
 */

// ── Platform Colors ─────────────────────────────────────────────
export const PLAT_COLORS = {
  floq: '#8b5cf6', triv: '#22d3ee', pintu: '#fcd34d', pluang: '#34d399',
  indodax: '#f97316', tokocrypto: '#0ea5e9',
  binance: '#fde047', bitget: '#67e8f9', stockbit: '#4ade80', bibit: '#86efac',
  indopremier: '#a5b4fc', manual: '#94a3b8', other: '#64748b',
  bca: '#60a5fa', bri: '#fca5a5', bni: '#fdba74', mandiri: '#fde047',
  ocbc: '#fca5a5', krom: '#c4b5fd', cash: '#4ade80', physical: '#fcd34d'
};

// ── FX Pairs for Yahoo Finance ───────────────────────────────────
export const FX_PAIRS = {
  USD: 'USDIDR=X', AUD: 'AUDIDR=X', SGD: 'SGDIDR=X', JPY: 'JPYIDR=X',
  HKD: 'HKDIDR=X', EUR: 'EURIDR=X', GBP: 'GBPIDR=X', NZD: 'NZDIDR=X',
  CHF: 'CHFIDR=X', CAD: 'CADIDR=X', CNH: 'CNHIDR=X'
};

// ── Stock Market Colors ──────────────────────────────────────────
export const STK_MKT_COLORS = {
  IDX: '#22d3ee', US: '#f5c518', INDEX: '#a78bfa', other: '#64748b'
};

export const STK_MKT_LABELS = {
  IDX: 'IDX', US: 'US', INDEX: 'Index/ETF', other: 'Other'
};

// ── Savings Currency Colors ──────────────────────────────────────
export const SAV_CCY_COLORS = {
  IDR: '#4ade80', USD: '#60a5fa', SGD: '#fcd34d', AUD: '#fdba74',
  JPY: '#fca5a5', EUR: '#93c5fd', GBP: '#a5b4fc', other: '#64748b'
};

// ── Asset Chart Accent Colors ────────────────────────────────────
export const AC_ACCENT = {
  crypto:  { hex: '#8b5cf6', rgb: '139,92,246' },
  gold:    { hex: '#f5c518', rgb: '245,197,24' },
  stocks:  { hex: '#22d3ee', rgb: '34,211,238' },
  savings: { hex: '#f472b6', rgb: '244,114,182' },
};

// ── CoinGecko ID Mapping ─────────────────────────────────────────
export const CG_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', XRP: 'ripple',
  SOL: 'solana', ADA: 'cardano', BNB: 'binancecoin', DOGE: 'dogecoin',
  AVAX: 'avalanche-2', DOT: 'polkadot', MATIC: 'matic-network',
  LINK: 'chainlink', UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin',
  SHIB: 'shiba-inu', USDT: 'tether', USDC: 'usd-coin',
  TRX: 'tron', TON: 'the-open-network', SUI: 'sui',
  APT: 'aptos', ARB: 'arbitrum', OP: 'optimism',
  INJ: 'injective-protocol', SEI: 'sei-network',
  NEAR: 'near', FTM: 'fantom', SAND: 'the-sandbox',
  MANA: 'decentraland', AXS: 'axie-infinity',
  CRO: 'crypto-com-chain', VET: 'vechain',
  ALGO: 'algorand', XLM: 'stellar', FIL: 'filecoin',
  HBAR: 'hedera-hashgraph', ICP: 'internet-computer',
  PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk',
  JUP: 'jupiter-exchange-solana', PYTH: 'pyth-network',
};

// ── Chart Range Days Mapping ─────────────────────────────────────
export const RANGE_DAYS = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

// ── IDX Stocks ───────────────────────────────────────────────────
export const POPULAR_STOCKS_IDX = {

  // ── PERBANKAN ────────────────────────────────────────────────────
  "BBCA":  "Bank Central Asia Tbk",
  "BBRI":  "Bank Rakyat Indonesia Tbk",
  "BMRI":  "Bank Mandiri Tbk",
  "BBNI":  "Bank Negara Indonesia Tbk",
  "BBTN":  "Bank Tabungan Negara Tbk",
  "BRIS":  "Bank Syariah Indonesia Tbk",
  "ARTO":  "Bank Jago Tbk",
  "BTPS":  "Bank BTPN Syariah Tbk",
  "BNGA":  "Bank CIMB Niaga Tbk",
  "BJBR":  "Bank Pembangunan Daerah Jabar Banten Tbk",
  "BDMN":  "Bank Danamon Indonesia Tbk",
  "BJTM":  "Bank Pembangunan Daerah Jawa Timur Tbk",
  "BSIM":  "Bank Sinarmas Tbk",
  "NISP":  "Bank OCBC NISP Tbk",
  "PNBN":  "Bank Pan Indonesia Tbk",
  "MEGA":  "Bank Mega Tbk",
  "AGRO":  "Bank Raya Indonesia Tbk",
  "BNLI":  "Bank Permata Tbk",
  "MAYA":  "Bank Mayapada Internasional Tbk",
  "NOBU":  "Bank Nationalnobu Tbk",

  // ── TELEKOMUNIKASI & TEKNOLOGI ───────────────────────────────────
  "TLKM":  "Telkom Indonesia Tbk",
  "EXCL":  "XLSmart Telecom Sejahtera Tbk",
  "ISAT":  "Indosat Tbk",
  "TBIG":  "Tower Bersama Infrastructure Tbk",
  "TOWR":  "Sarana Menara Nusantara Tbk",
  "MTEL":  "Dayamitra Telekomunikasi Tbk",
  "EMTK":  "Elang Mahkota Teknologi Tbk",
  "WIFI":  "Solusi Sinergi Digital Tbk",
  "GOTO":  "GoTo Gojek Tokopedia Tbk",
  "BUKA":  "Bukalapak.com Tbk",
  "DMMX":  "Digital Mediatama Maxima Tbk",

  // ── ENERGI & BATUBARA ────────────────────────────────────────────
  "ADRO":  "Adaro Energy Indonesia Tbk",
  "AADI":  "Adaro Andalan Indonesia Tbk",
  "ADMR":  "Adaro Minerals Indonesia Tbk",
  "BYAN":  "Bayan Resources Tbk",
  "PTBA":  "Bukit Asam Tbk",
  "ITMG":  "Indo Tambangraya Megah Tbk",
  "HRUM":  "Harum Energy Tbk",
  "DSSA":  "Dian Swastatika Sentosa Tbk",
  "RAJA":  "Rukun Raharja Tbk",
  "KKGI":  "Resource Alam Indonesia Tbk",
  "MBSS":  "Mitrabahtera Segara Sejati Tbk",
  "PTRO":  "Petrosea Tbk",
  "GTBO":  "Garda Tujuh Buana Tbk",
  "PKPK":  "Perdana Karya Perkasa Tbk",
  "BSSR":  "Baramulti Suksessarana Tbk",

  // ── MINYAK & GAS ─────────────────────────────────────────────────
  "PGAS":  "Perusahaan Gas Negara Tbk",
  "MEDC":  "Medco Energi Internasional Tbk",
  "ESSA":  "Essa Industries Indonesia Tbk",
  "RUIS":  "Radiant Utama Interinsco Tbk",
  "ELSA":  "Elnusa Tbk",
  "PGEO":  "Pertamina Geothermal Energy Tbk",

  // ── PERTAMBANGAN & LOGAM ─────────────────────────────────────────
  "ANTM":  "Aneka Tambang Tbk",
  "AMMN":  "Amman Mineral Internasional Tbk",
  "MDKA":  "Merdeka Copper Gold Tbk",
  "MBMA":  "Merdeka Battery Materials Tbk",
  "INCO":  "Vale Indonesia Tbk",
  "TINS":  "Timah Tbk",
  "BUMI":  "Bumi Resources Tbk",
  "CDIA":  "Chandra Daya Investasi Tbk",
  "TPIA":  "Chandra Asri Pacific Tbk",
  "SMCB":  "Solusi Bangun Indonesia Tbk",
  "PSAB":  "J Resources Asia Pasifik Tbk",
  "DKFT":  "Central Omega Resources Tbk",
  "NCKL":  "Trimegah Bangun Persada Tbk",
  "IFSH":  "Ifishdeco Tbk",

  // ── KONSUMER & RETAIL ────────────────────────────────────────────
  "UNVR":  "Unilever Indonesia Tbk",
  "ICBP":  "Indofood CBP Sukses Makmur Tbk",
  "INDF":  "Indofood Sukses Makmur Tbk",
  "MYOR":  "Mayora Indah Tbk",
  "SIDO":  "Industri Jamu Sido Muncul Tbk",
  "ULTJ":  "Ultra Jaya Milk Industry Tbk",
  "CLEO":  "Sariguna Primatirta Tbk",
  "KEJU":  "Mulia Boga Raya Tbk",
  "FOOD":  "Sentra Food Indonesia Tbk",
  "GOOD":  "Garudafood Putra Putri Jaya Tbk",
  "HOKI":  "Buyung Poetra Sembada Tbk",
  "DLTA":  "Delta Djakarta Tbk",
  "MLBI":  "Multi Bintang Indonesia Tbk",
  "AMRT":  "Sumber Alfaria Trijaya Tbk",
  "RALS":  "Ramayana Lestari Sentosa Tbk",
  "LPPF":  "Matahari Department Store Tbk",
  "MAPI":  "Mitra Adiperkasa Tbk",
  "MAPA":  "Map Aktif Adiperkasa Tbk",
  "CSAP":  "Catur Sentosa Adiprana Tbk",
  "ACES":  "Ace Hardware Indonesia Tbk",
  "HERO":  "Hero Supermarket Tbk",
  "MIDI":  "Midi Utama Indonesia Tbk",
  "MPPA":  "Matahari Putra Prima Tbk",
  "RANC":  "Supra Boga Lestari Tbk",

  // ── INDUSTRI & MANUFAKTUR ────────────────────────────────────────
  "ASII":  "Astra International Tbk",
  "INTP":  "Indocement Tunggal Prakarsa Tbk",
  "SMGR":  "Semen Indonesia Tbk",
  "WTON":  "Wijaya Karya Beton Tbk",
  "WSBP":  "Waskita Beton Precast Tbk",
  "ARNA":  "Arwana Citramulia Tbk",
  "TOTO":  "Surya Toto Indonesia Tbk",
  "KIAS":  "Keramika Indonesia Assosiasi Tbk",
  "JPFA":  "Japfa Comfeed Indonesia Tbk",
  "CPIN":  "Charoen Pokphand Indonesia Tbk",
  "MAIN":  "Malindo Feedmill Tbk",
  "BISI":  "BISI International Tbk",
  "GJTL":  "Gajah Tunggal Tbk",
  "AUTO":  "Astra Otoparts Tbk",
  "SMSM":  "Selamat Sempurna Tbk",
  "NIPS":  "Nipress Tbk",
  "PRAS":  "Prima Alloy Steel Universal Tbk",
  "INAI":  "Indal Aluminium Industry Tbk",
  "KDSI":  "Kedawung Setia Industrial Tbk",
  "LION":  "Lion Metal Works Tbk",
  "ALMI":  "Alumindo Light Metal Industry Tbk",
  "NIKL":  "Pelat Timah Nusantara Tbk",
  "KBLI":  "KMI Wire & Cable Tbk",
  "VOKS":  "Voksel Electric Tbk",
  "SCCO":  "Supreme Cable Manufacturing Tbk",
  "EKAD":  "Ekadharma International Tbk",
  "TKIM":  "Pabrik Kertas Tjiwi Kimia Tbk",
  "INKP":  "Indah Kiat Pulp & Paper Tbk",
  "FASW":  "Fajar Surya Wisesa Tbk",
  "DAJK":  "Dwi Aneka Jaya Kemasindo Tbk",

  // ── PROPERTI ─────────────────────────────────────────────────────
  "BSDE":  "Bumi Serpong Damai Tbk",
  "CTRA":  "Ciputra Development Tbk",
  "PWON":  "Pakuwon Jati Tbk",
  "SMRA":  "Summarecon Agung Tbk",
  "LPKR":  "Lippo Karawaci Tbk",
  "DILD":  "Intiland Development Tbk",
  "ASRI":  "Alam Sutera Realty Tbk",
  "KIJA":  "Kawasan Industri Jababeka Tbk",
  "SSIA":  "Surya Semesta Internusa Tbk",
  "APLN":  "Agung Podomoro Land Tbk",
  "MMLP":  "Mega Manunggal Property Tbk",
  "DMAS":  "Puradelta Lestari Tbk",
  "LPCK":  "Lippo Cikarang Tbk",
  "KPIG":  "MNC Land Tbk",
  "JRPT":  "Jaya Real Property Tbk",
  "MTLA":  "Metropolitan Land Tbk",
  "NIRO":  "Nirvana Development Tbk",
  "RODA":  "Pikko Land Development Tbk",
  "ARMY":  "Armidian Karyatama Tbk",
  "FORZ":  "Forza Land Indonesia Tbk",
  "CBDK":  "Bangun Kosambi Sukses Tbk",
  "PANI":  "Pantai Indah Kapuk Dua Tbk",
  "MERU":  "Vastland Indonesia Tbk",
  "RATU":  "Raharja Energi Cepu Tbk",

  // ── INFRASTRUKTUR & KONSTRUKSI ───────────────────────────────────
  "WSKT":  "Waskita Karya Tbk",
  "WIKA":  "Wijaya Karya Tbk",
  "ADHI":  "Adhi Karya Tbk",
  "PTPP":  "PP Tbk",
  "JSMR":  "Jasa Marga Tbk",
  "NRCA":  "Nusa Raya Cipta Tbk",
  "TOTL":  "Total Bangun Persada Tbk",
  "ACST":  "Acset Indonusa Tbk",
  "MTRA":  "Mitra Pemuda Tbk",
  "IDPR":  "Indonesia Pondasi Raya Tbk",

  // ── MEDIA & HIBURAN ──────────────────────────────────────────────
  "SCMA":  "Surya Citra Media Tbk",
  "MNCN":  "Media Nusantara Citra Tbk",
  "BMTR":  "Global Mediacom Tbk",
  "FILM":  "MD Pictures Tbk",
  "IPTV":  "MNC Vision Networks Tbk",

  // ── KESEHATAN & FARMASI ──────────────────────────────────────────
  "KLBF":  "Kalbe Farma Tbk",
  "KAEF":  "Kimia Farma Tbk",
  "PYFA":  "Pyridam Farma Tbk",
  "TSPC":  "Tempo Scan Pacific Tbk",
  "DVLA":  "Darya-Varia Laboratoria Tbk",
  "MIKA":  "Mitra Keluarga Karyasehat Tbk",
  "SILO":  "Siloam International Hospitals Tbk",
  "HEAL":  "Medikaloka Hermina Tbk",
  "PRAY":  "Prima Cakrawala Abadi Tbk",
  "PRIM":  "Prima Globalindo Medika Tbk",
  "RSGK":  "RS Gading Pluit Tbk",

  // ── AGRIKULTUR & PERKEBUNAN ──────────────────────────────────────
  "AALI":  "Astra Agro Lestari Tbk",
  "LSIP":  "PP London Sumatra Indonesia Tbk",
  "SSMS":  "Sawit Sumbermas Sarana Tbk",
  "TAPG":  "Triputra Agro Persada Tbk",
  "TBLA":  "Tunas Baru Lampung Tbk",
  "DSNG":  "Dharma Satya Nusantara Tbk",
  "SGRO":  "Sampoerna Agro Tbk",
  "BWPT":  "Eagle High Plantations Tbk",
  "PALM":  "Provident Agro Tbk",
  "MGRO":  "Mahkota Group Tbk",
  "ANJT":  "Austindo Nusantara Jaya Tbk",
  "GZCO":  "Gozco Plantations Tbk",

  // ── TRANSPORTASI & LOGISTIK ──────────────────────────────────────
  "GIAA":  "Garuda Indonesia Tbk",
  "BIRD":  "Blue Bird Tbk",
  "SAFE":  "Steady Safe Tbk",
  "TMAS":  "Pelayaran Tempuran Emas Tbk",
  "NELY":  "Pelayaran Nelly Dwi Putri Tbk",
  "TPMA":  "Trans Power Marine Tbk",
  "HAJJ":  "Humpuss Maritim Internasional Tbk",
  "SMDR":  "Samudera Indonesia Tbk",
  "TRUK":  "Guna Timur Raya Tbk",

  // ── KEUANGAN NON-BANK ────────────────────────────────────────────
  "BFIN":  "BFI Finance Indonesia Tbk",
  "MFIN":  "Mandala Multifinance Tbk",
  "ADMF":  "Adira Dinamika Multi Finance Tbk",
  "CFIN":  "Clipan Finance Indonesia Tbk",
  "TIFA":  "Tifa Finance Tbk",
  "VRNA":  "Verena Multi Finance Tbk",
  "SRTG":  "Saratoga Investama Sedaya Tbk",
  "MTDL":  "Metrodata Electronics Tbk",

  // ── KONGLOMERAT & INVESTASI ──────────────────────────────────────
  "BREN":  "Barito Renewables Energy Tbk",
  "BRPT":  "Barito Pacific Tbk",
  "UNTR":  "United Tractors Tbk",
  "HEXA":  "Hexindo Adiperkasa Tbk",
  "ASSA":  "Adi Sarana Armada Tbk",
  "MPMX":  "Mitra Pinasthika Mustika Tbk",
  "MLPT":  "Multipolar Technology Tbk",
  "BHIT":  "MNC Investama Tbk",

  // ── ROKOK ────────────────────────────────────────────────────────
  "HMSP":  "HM Sampoerna Tbk",
  "GGRM":  "Gudang Garam Tbk",
  "WIIM":  "Wismilak Inti Makmur Tbk",
  "RMBA":  "Bentoel Internasional Investama Tbk",
  "ITIC":  "Indonesian Tobacco Tbk",

  // ── ENERGI TERBARUKAN ────────────────────────────────────────────
  "ENRG":  "Energi Mega Persada Tbk",

  // ── IPO POPULER 2024-2025 ────────────────────────────────────────
  "NICL":  "Trimegah Bangun Persada Tbk",

  // ── US STOCKS ────────────────────────────────────────────────────
  "AAPL":  "Apple Inc.",
  "MSFT":  "Microsoft Corporation",
  "GOOGL": "Alphabet Inc. (Google)",
  "AMZN":  "Amazon.com Inc.",
  "TSLA":  "Tesla Inc.",
  "NVDA":  "NVIDIA Corporation",
  "META":  "Meta Platforms Inc.",
  "BRK.B": "Berkshire Hathaway B",
  "JNJ":   "Johnson & Johnson",
  "JPM":   "JPMorgan Chase & Co.",
  "V":     "Visa Inc.",
  "WMT":   "Walmart Inc.",
  "MA":    "Mastercard Inc.",
  "UNH":   "UnitedHealth Group",
  "HD":    "The Home Depot Inc.",
  "XOM":   "Exxon Mobil Corp.",
  "LLY":   "Eli Lilly and Co.",
  "AVGO":  "Broadcom Inc.",
  "PG":    "Procter & Gamble Co.",
  "COST":  "Costco Wholesale Corp.",
  "AMD":   "Advanced Micro Devices Inc.",
  "NFLX":  "Netflix Inc.",
  "ORCL":  "Oracle Corporation",
  "ADBE":  "Adobe Inc.",
  "CRM":   "Salesforce Inc.",
  "BAC":   "Bank of America Corp.",
  "INTC":  "Intel Corporation",
  "DIS":   "The Walt Disney Company",
  "PYPL":  "PayPal Holdings Inc.",
  "UBER":  "Uber Technologies Inc.",
};

// ── US Stocks ────────────────────────────────────────────────────
export const US_STOCKS = {
  "AAPL":  "Apple Inc.",
  "MSFT":  "Microsoft Corporation",
  "NVDA":  "NVIDIA Corporation",
  "AMZN":  "Amazon.com Inc.",
  "GOOGL": "Alphabet Inc. (Class A)",
  "GOOG":  "Alphabet Inc. (Class C)",
  "META":  "Meta Platforms Inc.",
  "TSLA":  "Tesla Inc.",
  "BRK.B": "Berkshire Hathaway Inc.",
  "JPM":   "JPMorgan Chase & Co.",
  "V":     "Visa Inc.",
  "UNH":   "UnitedHealth Group Inc.",
  "XOM":   "Exxon Mobil Corporation",
  "JNJ":   "Johnson & Johnson",
  "WMT":   "Walmart Inc.",
  "MA":    "Mastercard Inc.",
  "LLY":   "Eli Lilly and Company",
  "AVGO":  "Broadcom Inc.",
  "PG":    "Procter & Gamble Co.",
  "HD":    "The Home Depot Inc.",
  "MRK":   "Merck & Co. Inc.",
  "CVX":   "Chevron Corporation",
  "ABBV":  "AbbVie Inc.",
  "KO":    "The Coca-Cola Company",
  "PEP":   "PepsiCo Inc.",
  "COST":  "Costco Wholesale Corporation",
  "ADBE":  "Adobe Inc.",
  "AMD":   "Advanced Micro Devices Inc.",
  "NFLX":  "Netflix Inc.",
  "CRM":   "Salesforce Inc.",
  "TMO":   "Thermo Fisher Scientific Inc.",
  "ACN":   "Accenture plc",
  "MCD":   "McDonald's Corporation",
  "INTC":  "Intel Corporation",
  "DIS":   "The Walt Disney Company",
  "PYPL":  "PayPal Holdings Inc.",
  "UBER":  "Uber Technologies Inc.",
};

// ── Index Funds & ETFs ────────────────────────────────────────────
export const INDEX_FUNDS = {
  // ── US Index ETFs ─────────────────────────────────────────────
  "SPY":   "SPDR S&P 500 ETF",
  "VOO":   "Vanguard S&P 500 ETF",
  "IVV":   "iShares Core S&P 500 ETF",
  "QQQ":   "Invesco QQQ Trust (Nasdaq-100)",
  "QQQM":  "Invesco Nasdaq-100 ETF",
  "VTI":   "Vanguard Total Market ETF",
  "DIA":   "SPDR Dow Jones Industrial Average ETF",
  "VEA":   "Vanguard FTSE Developed Markets ETF",
  "VWO":   "Vanguard FTSE Emerging Markets ETF",
  "VT":    "Vanguard Total World Stock ETF",
  "SCHB":  "Schwab U.S. Broad Market ETF",
  "GLD":   "SPDR Gold Shares ETF",
  "IAU":   "iShares Gold Trust ETF",
  "TLT":   "iShares 20+ Year Treasury Bond ETF",
  // ── Index Trackers (Yahoo Finance) ────────────────────────────
  "^GSPC": "S&P 500 Index",
  "^IXIC": "Nasdaq Composite Index",
  "^DJI":  "Dow Jones Industrial Average",
  "^RUT":  "Russell 2000 Index",
  "^VIX":  "CBOE Volatility Index (VIX)",
  // ── Indonesian Index ──────────────────────────────────────────
  "^IHSG": "IHSG / IDX Composite",
  "^LQ45": "LQ45 Index",
  "^IDX30":"IDX30 Index",
};

// ── Merged (backward compat — used by import-parsers & rebalance) ─
export const POPULAR_STOCKS = { ...POPULAR_STOCKS_IDX, ...US_STOCKS, ...INDEX_FUNDS };

// ── Bank Options for Savings ─────────────────────────────────────
export const BANK_OPTS = `
  <option value="bca">BCA</option>
  <option value="bri">BRI</option>
  <option value="bni">BNI</option>
  <option value="mandiri">Mandiri</option>
  <option value="ocbc">OCBC</option>
  <option value="krom">Krom</option>
  <option value="cash">Cash</option>
  <option value="other">Lainnya</option>
`;

// ═════════════════════════════════════════════════════════════════
// TAX & FEE STRUCTURES 2026 (Indonesia)
// ═════════════════════════════════════════════════════════════════

/**
 * Stock Trading Fees (BEI) - 2026
 * 
 * Stockbit: Beli 0.15%, Jual 0.25% (All-in)
 * IPOT: Beli 0.19%, Jual 0.29%
 * Pluang (Saham AS): Beli/Jual 0.20% - 0.30% + SEC/TAF fees
 * 
 * Biaya Meterai: Rp10.000 jika total transaksi (Beli+Jual) dalam 1 hari
 *                 pada 1 sekuritas > Rp10.000.000
 */
export const STOCK_FEES = {
  stockbit: { buy: 0.0015, sell: 0.0025 },
  indopremier: { buy: 0.0019, sell: 0.0029 },
  bibit: { buy: 0.0015, sell: 0.0025 },
  pluang: { buy: 0.003, sell: 0.003, usSecFee: 0.0000227, usTafFee: 0.0000278 }, // US stocks
  other: { buy: 0.0015, sell: 0.0025 },
  stampDutyThreshold: 10_000_000,
  stampDutyFee: 10_000
};

/**
 * Crypto Trading Fees (Regulasi 2026 - PMK 50/2025)
 * 
 * Pajak: PPN 0%, PPh 22 Final 0.21% (Dikenakan pada setiap transaksi Beli dan Jual)
 * 
 * Platform Fees:
 * - Indodax: Taker 0.30%, Maker 0%
 * - Pintu: Spread model (0.5% - 2%)
 * - Triv: Spot 0%, Market 0.1%
 * - Pluang: 0.10% + biaya bursa CFX
 * - Floq: 0% (Hanya kenakan PPh 0.21%)
 * - Binance: 0.10% standard
 * 
 * Biaya Meterai Crypto: Sama dengan saham, potong Rp10.000 jika total
 *                       transaksi harian di satu platform > Rp10.000.000
 */
export const CRYPTO_FEES = {
  // Pajak 2026 (PMK 50/2025)
  ppn: 0,              // PPN 0%
  pph22: 0.0021,       // PPh 22 Final 0.21% per transaksi (beli & jual)
  
  // Platform fees (maker/taker or spread)
  indodax: { taker: 0.003, maker: 0 },
  pintu: { spreadMin: 0.005, spreadMax: 0.02 },
  triv: { spot: 0, market: 0.001 },
  pluang: { fee: 0.001 }, // + CFX exchange fee
  floq: { fee: 0 },       // 0% platform fee
  binance: { fee: 0.001 },
  bitget: { fee: 0.001 },
  other: { fee: 0.002 },
  
  // Stamp duty (same as stocks)
  stampDutyThreshold: 10_000_000,
  stampDutyFee: 10_000
};

// ── Currency Options ─────────────────────────────────────────────
export const CCY_OPTS = `
  <option value="IDR">IDR — Rupiah</option>
  <option value="USD">USD</option>
  <option value="AUD">AUD</option>
  <option value="SGD">SGD</option>
  <option value="JPY">JPY</option>
  <option value="EUR">EUR</option>
  <option value="GBP">GBP</option>
  <option value="NZD">NZD</option>
  <option value="CHF">CHF</option>
  <option value="CAD">CAD</option>
  <option value="CNH">CNH</option>
`;

// ── I18N Translations ────────────────────────────────────────────
export const I18N = {
  id: {
    // ── Brand & Nav ──────────────────────────────────────────────
    brand_sub:          'Personal Net Worth Dashboard',
    not_synced:         'belum disync',
    synced_label:       'sudah disync',
    syncing:            'menyinkron…',
    home:               'Home',
    holdings:           'Holdings',
    portfolio_overview: 'Ringkasan Portofolio',
    visualization:      'Visualisasi',
    breakdown:          'Ringkasan',
    asset_allocation:   'Alokasi Aset',
    performance:        'Performa',
    portfolio_history:  'Riwayat Portofolio',
    benchmarking:       'Pembandingan',
    vs_indices:         'vs. Indeks Pasar',
    benchmark_title:    'Portofolio vs IHSG vs S&P 500',
    total_portfolio:    'Total Portofolio',
    equity_only:        'Saham Saja',
    advanced_analytics: 'Analitik Lanjutan',
    portfolio_statistics:'Statistik Portofolio',
    // ── Timeframes ───────────────────────────────────────────────
    tf_1w: '1M', tf_1m: '1B', tf_3m: '3B', tf_6m: '6B', tf_1y: '1T', tf_all: 'SEMUA',
    tf_week: 'Minggu', tf_month: 'Bulan', tf_year: 'Tahun',
    // ── KPI & Totals ─────────────────────────────────────────────
    total_net_worth:    'Total Kekayaan Bersih',
    cost_basis:         'Modal Beli',
    current_value:      'Nilai Saat Ini',
    return:             'Return',
    goal_label:         'Target',
    // ── Holdings sections ────────────────────────────────────────
    crypto_holdings:    'Kepemilikan Kripto',
    other_holdings:     'Kepemilikan Lainnya',
    stocks_equity:      'Saham & Ekuitas',
    gold_physical:      'Emas (Fisik)',
    savings:            'Rekening Tabungan',
    add:                '+ Tambah',
    // ── Allocation ───────────────────────────────────────────────
    allocation_by_platform: 'Alokasi per Platform',
    allocation_by_coin:     'Alokasi per Koin',
    allocation_by_ticker:   'Alokasi per Saham',
    // ── Search & Filter ──────────────────────────────────────────
    all_platforms:      'Semua Platform',
    reset_filter:       '✕ Reset',
    // ── Tax mode ─────────────────────────────────────────────────
    tax_mode:           'Mode Pajak',
    pre_tax:            'Sebelum Pajak',
    post_tax:           'Setelah Pajak',
    // ── Analytics ────────────────────────────────────────────────
    daily_snapshots:    'Berdasarkan snapshot harian',
    est_annual_income:  'Estimasi Pendapatan Tahunan',
    volatility:         'Volatilitas (Tahunan)',
    sharpe:             'Sharpe Ratio',
    max_dd:             'Max Drawdown',
    total_return:       'Total Return',
    best_day:           'Hari Terbaik',
    worst_day:          'Hari Terburuk',
    daily_change:       'Perubahan Harian',
    weekly_change:      'Perubahan Mingguan',
    snapshots_note:     'Berdasarkan {n} snapshot harian. Volatilitas = std dev return harian × √252. Sharpe = risk-free 6% p.a.',
    need_more_data:     'Butuh minimal 2 snapshot historis',
    first_snapshot:     'Sinkronisasi harga setiap hari untuk membangun data historis.',
    rf_label:           'Rf = 6% p.a. (BI Rate)',
    excellent_sharpe:   'Return risk-adjusted sangat baik',
    ok_sharpe:          'Return cukup baik',
    bad_sharpe:         'Di bawah risk-free rate',
    low_risk:           'Risiko rendah',
    high_dd:            'Drawdown tinggi',
    // ── AI ───────────────────────────────────────────────────────
    ai_advisor:         'Gemini Portfolio Advisor',
    generate_insights:  '✨ Generate Insights',
    ai_placeholder:     'Klik "Generate Insights" untuk analisis portofolio menggunakan Gemini API.',
    // ── Modal — Add/Edit Asset ────────────────────────────────────
    cancel:             'Batal',
    add_asset:          'Tambah Aset',
    delete_asset:       'Hapus Aset?',
    delete_msg:         'Anda akan menghapus:',
    irreversible:       'Tindakan ini tidak dapat dibatalkan.',
    cancel_btn:         'Batal',
    delete_btn:         'Hapus',
    label_edit_mode:    '✎ Mode Edit',
    save_changes:       'Simpan Perubahan',
    modal_crypto_title: 'Kripto',
    modal_crypto_sub:   'BTC, ETH, XRP, atau koin lainnya',
    modal_gold_title:   'Emas (Fisik)',
    modal_gold_sub:     'Batangan, koin, atau LM fisik',
    modal_stocks_title: 'Saham / Ekuitas',
    modal_stocks_sub:   'IDX (mis. BBCA), US (mis. AAPL), atau Indeks',
    modal_savings_title:'Rekening Tabungan',
    modal_savings_sub:  'Bank, deposito, atau kas',
    // ── Form fields ──────────────────────────────────────────────
    f_coin:             'Koin',
    f_amount:           'Jumlah',
    f_costbasis:        'Modal Beli Total (IDR)',
    f_costbasis_hint:   'Total IDR yang dibayarkan — untuk hitung P&L',
    f_platform:         'Platform',
    f_date:             'Tanggal Transaksi',
    f_desc:             'Deskripsi',
    f_grams:            'Berat (gram)',
    f_price_per_gram:   'Harga Beli / Gram (IDR)',
    f_ticker:           'Kode Saham',
    f_market:           'Bursa',
    f_company:          'Nama Perusahaan',
    f_shares:           'Jumlah (Lot/Lembar)',
    f_price:            'Harga Beli / Lembar (IDR)',
    f_price_hint:       'Digunakan sebagai cost basis untuk P&L',
    f_broker:           'Broker',
    f_annual_yield:     'Yield Tahunan (% p.a.)',
    f_dividends:        'Dividen Diterima (IDR)',
    f_bank:             'Bank',
    f_currency:         'Mata Uang',
    f_balance:          'Saldo',
    f_note:             'Catatan (opsional)',
    f_yield_hint:       'Untuk estimasi pendapatan tahunan (dividen, kupon, dsb)',
    fetch_price_hint:   'pindah kursor untuk ambil harga live',
    custom_platform:    'Ketik nama platform…',
    custom_broker:      'Ketik nama broker…',
    custom_bank:        'Ketik nama bank…',
    ticker_not_found:   '✗ tidak ditemukan — isi manual',
    // ── Manual Price Modal ────────────────────────────────────────
    manual_price_title: '✎ HARGA MANUAL',
    manual_price_hint:  'Isi harga yang ingin diubah. Kosongkan jika tidak perlu diubah.',
    manual_price_crypto:'KRIPTO',
    manual_price_goldfx:'EMAS & KURS',
    manual_price_stocks:'SAHAM',
    manual_price_alts:  'ALTCOIN',
    save_price:         '✎ Simpan Harga',
    // ── Theme Picker ──────────────────────────────────────────────
    theme_picker_title: '🎨 PILIH TEMA',
    theme_click_hint:   'Klik tema untuk langsung diterapkan',
    theme_dark:         'Gelap',
    theme_light:        'Terang',
    theme_midnight:     'Midnight',
    theme_forest:       'Hutan',
    theme_dracula:      'Dracula',
    theme_amoled:       'AMOLED',
    theme_solarized:    'Solarized',
    theme_colorful:     'Warna-Warni',
    // ── Sync ─────────────────────────────────────────────────────
    auto_snapshot:      'Snapshot otomatis tersimpan tiap Sync',
    snapshot_hint:      'Sync harga setiap hari untuk membangun data historis.\nSetiap klik Sync → snapshot otomatis tersimpan.',
    // ── Rebalancing Calculator ────────────────────────────────────
    rebal_title:        'Rebalancing Calculator',
    rebal_subtitle:     'Atur target % → lihat apa yang perlu dibeli/dijual',
    rebal_class_title:  'ALOKASI PER KELAS ASET',
    rebal_ticker_title: 'ALOKASI PER TICKER / KOIN',
    rebal_ticker_opt:   '(opsional)',
    rebal_col_class:    'Kelas',
    rebal_col_now:      'Saat ini',
    rebal_col_target:   'Target',
    rebal_col_diff:     'Selisih',
    rebal_col_action:   'Aksi',
    rebal_total:        'TOTAL',
    rebal_balanced:     '✓ Seimbang',
    rebal_buy:          '↑ Beli',
    rebal_sell:         '↓ Jual',
    rebal_warn:         'Total target harus 100%',
    rebal_hint:         'Target tersimpan otomatis. Simulasi berdasarkan nilai portofolio saat ini:',
    rebal_no_assets:    'Tambah aset terlebih dahulu untuk melihat rebalancing.',
    // ── Transaction Log ───────────────────────────────────────────
    txlog_title:        'Transaction Log',
    txlog_subtitle:     'Riwayat Aktivitas',
    txlog_empty:        'Belum ada aktivitas tercatat.',
    txlog_empty_hint:   'Setiap tambah, edit, atau hapus aset akan muncul di sini.',
    txlog_export_csv:   '⬇ CSV',
    tx_add:             'TAMBAH',
    tx_edit:            'EDIT',
    tx_delete:          'HAPUS',
    // ── PDF Export ────────────────────────────────────────────────
    export_pdf:         '⬇ PDF',
    pdf_report_title:   'Laporan Portofolio',
    pdf_generated:      'Digenerate',
    pdf_page:           'Halaman',
    pdf_of:             'dari',
    pdf_alloc_title:    'ALOKASI ASET',
    pdf_col_class:      'Kelas Aset',
    pdf_col_value:      'Nilai',
    pdf_col_alloc:      'Alokasi',
    pdf_col_pnl:        'P&L',
    pdf_col_return:     'Return',
  },

  en: {
    // ── Brand & Nav ──────────────────────────────────────────────
    brand_sub:          'Personal Net Worth Dashboard',
    not_synced:         'not synced',
    synced_label:       'synced',
    syncing:            'syncing…',
    home:               'Home',
    holdings:           'Holdings',
    portfolio_overview: 'Portfolio Overview',
    visualization:      'Visualization',
    breakdown:          'Breakdown',
    asset_allocation:   'Asset Allocation',
    performance:        'Performance',
    portfolio_history:  'Portfolio History',
    benchmarking:       'Benchmarking',
    vs_indices:         'vs. Market Indices',
    benchmark_title:    'Portfolio vs IHSG vs S&P 500',
    total_portfolio:    'Total Portfolio',
    equity_only:        'Equity Only',
    advanced_analytics: 'Advanced Analytics',
    portfolio_statistics:'Portfolio Statistics',
    // ── Timeframes ───────────────────────────────────────────────
    tf_1w: '1W', tf_1m: '1M', tf_3m: '3M', tf_6m: '6M', tf_1y: '1Y', tf_all: 'ALL',
    tf_week: 'Week', tf_month: 'Month', tf_year: 'Year',
    // ── KPI & Totals ─────────────────────────────────────────────
    total_net_worth:    'Total Net Worth',
    cost_basis:         'Cost Basis',
    current_value:      'Current Value',
    return:             'Return',
    goal_label:         'Goal',
    // ── Holdings sections ────────────────────────────────────────
    crypto_holdings:    'Crypto Holdings',
    other_holdings:     'Other Holdings',
    stocks_equity:      'Stocks & Equity',
    gold_physical:      'Gold (Physical)',
    savings:            'Saving Account',
    add:                '+ Add',
    // ── Allocation ───────────────────────────────────────────────
    allocation_by_platform: 'Allocation by Platform',
    allocation_by_coin:     'Allocation by Coin',
    allocation_by_ticker:   'Allocation by Ticker',
    // ── Search & Filter ──────────────────────────────────────────
    all_platforms:      'All Platforms',
    reset_filter:       '✕ Reset',
    // ── Tax mode ─────────────────────────────────────────────────
    tax_mode:           'Tax Mode',
    pre_tax:            'Pre-tax',
    post_tax:           'Post-tax',
    // ── Analytics ────────────────────────────────────────────────
    daily_snapshots:    'Based on daily snapshots',
    est_annual_income:  'Estimated Annual Income',
    volatility:         'Volatility (Ann.)',
    sharpe:             'Sharpe Ratio',
    max_dd:             'Max Drawdown',
    total_return:       'Total Return',
    best_day:           'Best Day',
    worst_day:          'Worst Day',
    daily_change:       'Daily Change',
    weekly_change:      'Weekly Change',
    snapshots_note:     'Based on {n} daily snapshots. Volatility = daily return std dev × √252. Sharpe uses 6% p.a. risk-free.',
    need_more_data:     'Requires min. 2 historical snapshots',
    first_snapshot:     'Sync prices daily to build historical data.',
    rf_label:           'Rf = 6% p.a. (BI Rate)',
    excellent_sharpe:   'Excellent risk-adj. return',
    ok_sharpe:          'Acceptable return',
    bad_sharpe:         'Below risk-free rate',
    low_risk:           'Low risk',
    high_dd:            'High drawdown',
    // ── AI ───────────────────────────────────────────────────────
    ai_advisor:         'Gemini Portfolio Advisor',
    generate_insights:  '✨ Generate Insights',
    ai_placeholder:     'Click "Generate Insights" to get AI-powered portfolio analysis using Gemini API.',
    // ── Modal — Add/Edit Asset ────────────────────────────────────
    cancel:             'Cancel',
    add_asset:          'Add Asset',
    delete_asset:       'Delete Asset?',
    delete_msg:         'You are about to delete:',
    irreversible:       'This action cannot be undone.',
    cancel_btn:         'Cancel',
    delete_btn:         'Delete',
    label_edit_mode:    '✎ Edit Mode',
    save_changes:       'Save Changes',
    modal_crypto_title: 'Crypto',
    modal_crypto_sub:   'BTC, ETH, XRP, or other coins',
    modal_gold_title:   'Gold (Physical)',
    modal_gold_sub:     'Bars, coins, or physical bullion',
    modal_stocks_title: 'Stocks / Equity',
    modal_stocks_sub:   'IDX (e.g. BBCA), US (e.g. AAPL), or Index',
    modal_savings_title:'Saving Account',
    modal_savings_sub:  'Bank, deposit, or cash',
    // ── Form fields ──────────────────────────────────────────────
    f_coin:             'Coin',
    f_amount:           'Amount',
    f_costbasis:        'Total Cost Basis (IDR)',
    f_costbasis_hint:   'Total IDR paid — used to calculate P&L',
    f_platform:         'Platform',
    f_date:             'Transaction Date',
    f_desc:             'Description',
    f_grams:            'Weight (grams)',
    f_price_per_gram:   'Buy Price / Gram (IDR)',
    f_ticker:           'Ticker',
    f_market:           'Market',
    f_company:          'Company Name',
    f_shares:           'Qty (Lot/Shares)',
    f_price:            'Buy Price / Share (IDR)',
    f_price_hint:       'Used as cost basis for P&L',
    f_broker:           'Broker',
    f_annual_yield:     'Annual Yield (% p.a.)',
    f_dividends:        'Dividends Received (IDR)',
    f_bank:             'Bank',
    f_currency:         'Currency',
    f_balance:          'Balance',
    f_note:             'Note (optional)',
    f_yield_hint:       'For estimated annual income (dividends, coupons, etc)',
    fetch_price_hint:   'blur field to fetch live price',
    custom_platform:    'Enter platform name…',
    custom_broker:      'Enter broker name…',
    custom_bank:        'Enter bank name…',
    ticker_not_found:   '✗ not found — enter manually',
    // ── Manual Price Modal ────────────────────────────────────────
    manual_price_title: '✎ MANUAL PRICE',
    manual_price_hint:  'Fill in prices to override. Leave blank to keep unchanged.',
    manual_price_crypto:'CRYPTO',
    manual_price_goldfx:'GOLD & FX RATES',
    manual_price_stocks:'STOCKS',
    manual_price_alts:  'ALTCOINS',
    save_price:         '✎ Save Prices',
    // ── Theme Picker ──────────────────────────────────────────────
    theme_picker_title: '🎨 CHOOSE THEME',
    theme_click_hint:   'Click a theme to apply instantly',
    theme_dark:         'Dark',
    theme_light:        'Light',
    theme_midnight:     'Midnight',
    theme_forest:       'Forest',
    theme_dracula:      'Dracula',
    theme_amoled:       'AMOLED',
    theme_solarized:    'Solarized',
    theme_colorful:     'Colorful',
    // ── Sync ─────────────────────────────────────────────────────
    auto_snapshot:      'Snapshot saved automatically on every Sync',
    snapshot_hint:      'Sync prices daily to build historical data.\nEvery Sync click → snapshot auto-saved.',
    // ── Rebalancing Calculator ────────────────────────────────────
    rebal_title:        'Rebalancing Calculator',
    rebal_subtitle:     'Set target % → see what to buy/sell',
    rebal_class_title:  'ALLOCATION BY ASSET CLASS',
    rebal_ticker_title: 'ALLOCATION BY TICKER / COIN',
    rebal_ticker_opt:   '(optional)',
    rebal_col_class:    'Class',
    rebal_col_now:      'Current',
    rebal_col_target:   'Target',
    rebal_col_diff:     'Diff',
    rebal_col_action:   'Action',
    rebal_total:        'TOTAL',
    rebal_balanced:     '✓ Balanced',
    rebal_buy:          '↑ Buy',
    rebal_sell:         '↓ Sell',
    rebal_warn:         'Total target must equal 100%',
    rebal_hint:         'Targets auto-saved. Simulation based on current portfolio value:',
    rebal_no_assets:    'Add assets first to see rebalancing suggestions.',
    // ── Transaction Log ───────────────────────────────────────────
    txlog_title:        'Transaction Log',
    txlog_subtitle:     'Activity History',
    txlog_empty:        'No activity recorded yet.',
    txlog_empty_hint:   'Every add, edit, or delete will appear here.',
    txlog_export_csv:   '⬇ CSV',
    tx_add:             'ADD',
    tx_edit:            'EDIT',
    tx_delete:          'DELETE',
    // ── PDF Export ────────────────────────────────────────────────
    export_pdf:         '⬇ PDF',
    pdf_report_title:   'Portfolio Report',
    pdf_generated:      'Generated',
    pdf_page:           'Page',
    pdf_of:             'of',
    pdf_alloc_title:    'ASSET ALLOCATION',
    pdf_col_class:      'Asset Class',
    pdf_col_value:      'Value',
    pdf_col_alloc:      'Allocation',
    pdf_col_pnl:        'P&L',
    pdf_col_return:     'Return',
  }
};

// ── Benchmark Data (IHSG & S&P 500) ─────────────────────────────
export const BENCH_IHSG = [
  { date: '2023-03-01', idx: 100.0 }, { date: '2023-04-01', idx: 101.2 }, { date: '2023-05-01', idx: 100.5 },
  { date: '2023-06-01', idx: 102.8 }, { date: '2023-07-01', idx: 103.4 }, { date: '2023-08-01', idx: 102.1 },
  { date: '2023-09-01', idx: 101.6 }, { date: '2023-10-01', idx: 103.2 }, { date: '2023-11-01', idx: 105.8 },
  { date: '2023-12-01', idx: 107.3 }, { date: '2024-01-01', idx: 106.5 }, { date: '2024-02-01', idx: 107.9 },
  { date: '2024-03-01', idx: 109.2 }, { date: '2024-04-01', idx: 108.6 }, { date: '2024-05-01', idx: 110.4 },
  { date: '2024-06-01', idx: 111.8 }, { date: '2024-07-01', idx: 113.1 }, { date: '2024-08-01', idx: 115.6 },
  { date: '2024-09-01', idx: 117.3 }, { date: '2024-10-01', idx: 116.4 }, { date: '2024-11-01', idx: 118.9 },
  { date: '2024-12-01', idx: 122.1 }, { date: '2025-01-01', idx: 124.3 }, { date: '2025-02-01', idx: 126.0 },
  { date: '2025-03-01', idx: 123.8 }, { date: '2025-04-01', idx: 125.4 }, { date: '2025-05-01', idx: 127.2 },
  { date: '2025-06-01', idx: 128.9 }, { date: '2025-07-01', idx: 127.5 }, { date: '2025-08-01', idx: 129.3 },
  { date: '2025-09-01', idx: 131.1 }, { date: '2025-10-01', idx: 130.4 }, { date: '2025-11-01', idx: 132.8 },
  { date: '2025-12-01', idx: 134.5 }, { date: '2026-01-01', idx: 133.2 }, { date: '2026-02-01', idx: 131.9 },
  { date: '2026-03-01', idx: 130.6 }, { date: '2026-03-13', idx: 130.1 }
];

export const BENCH_SP500 = [
  { date: '2023-03-01', idx: 100.0 }, { date: '2023-04-01', idx: 102.4 }, { date: '2023-05-01', idx: 101.8 },
  { date: '2023-06-01', idx: 105.3 }, { date: '2023-07-01', idx: 108.9 }, { date: '2023-08-01', idx: 107.2 },
  { date: '2023-09-01', idx: 104.6 }, { date: '2023-10-01', idx: 103.1 }, { date: '2023-11-01', idx: 109.8 },
  { date: '2023-12-01', idx: 114.5 }, { date: '2024-01-01', idx: 116.2 }, { date: '2024-02-01', idx: 119.7 },
  { date: '2024-03-01', idx: 123.4 }, { date: '2024-04-01', idx: 120.8 }, { date: '2024-05-01', idx: 125.6 },
  { date: '2024-06-01', idx: 129.3 }, { date: '2024-07-01', idx: 132.1 }, { date: '2024-08-01', idx: 135.4 },
  { date: '2024-09-01', idx: 138.2 }, { date: '2024-10-01', idx: 136.5 }, { date: '2024-11-01', idx: 144.8 },
  { date: '2024-12-01', idx: 148.3 }, { date: '2025-01-01', idx: 149.6 }, { date: '2025-02-01', idx: 152.1 },
  { date: '2025-03-01', idx: 149.8 }, { date: '2025-04-01', idx: 153.4 }, { date: '2025-05-01', idx: 157.2 },
  { date: '2025-06-01', idx: 160.8 }, { date: '2025-07-01', idx: 158.3 }, { date: '2025-08-01', idx: 162.5 },
  { date: '2025-09-01', idx: 166.1 }, { date: '2025-10-01', idx: 164.3 }, { date: '2025-11-01', idx: 169.7 },
  { date: '2025-12-01', idx: 173.2 }, { date: '2026-01-01', idx: 170.5 }, { date: '2026-02-01', idx: 166.8 },
  { date: '2026-03-01', idx: 163.4 }, { date: '2026-03-13', idx: 162.1 }
];

console.log('[CONFIG] Configuration loaded');
