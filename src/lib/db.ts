// Data store keys - EXACT same as original
export const KEYS = { products: 'mw_products', inventory: 'mw_inventory', promotions: 'mw_promotions', orders: 'mw_orders', settings: 'mw_settings', rebate: 'mw_rebate' };

// Types
export interface Product {
  code: string; manageCode?: string; category?: string; subcategory?: string; detail?: string;
  orderNum?: string; ttiNum?: string; model?: string; description?: string;
  supplyPrice?: number; productDC?: number; cost?: number;
  priceA?: number; priceRetail?: number; priceNaver?: number; priceOpen?: number;
  raisedPrice?: number; raiseRate?: number; discontinued?: string;
  ttiStock?: string; inDate?: string;
  [key: string]: any;
}
export interface InventoryItem { code: string; stock: number; note1?: string; note2?: string; }
export interface Promotion {
  code: string; cost?: number; period?: string; promoCode?: string; promoName?: string;
  model?: string; orderNum?: string; dealerPrice?: number; promoPrice?: number;
  qty?: number; discountRate?: number; limitQty?: string; periodDetail?: string;
  note?: string; memo?: string;
}
export interface Settings {
  quarterDC: number; yearDC: number; vat: number; naverFee: number;
  openElecFee: number; openHandFee: number; domaeFee: number;
  mkDomae: number; mkRetail: number; mkNaver: number; mkOpen: number;
  mkOpenElec?: number; mkOpenHand?: number;
  promoFee1: number; promoFee2: number;
  arPromos: {name:string;rate:number}[]; volPromos: {name:string;rate:number}[];
  [key: string]: any;
}
export interface OrderHistory {
  id?: string; date: string; items: {code:string; qty:number; supplyPrice?:number; cost:number; promoPrice?:number; promoNo?:string}[];
  type?: string;
}

// Load/Save helpers
export function load(key: string): any[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch { return []; }
}
export function save(key: string, data: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}
export function loadObj(key: string, def: any): any {
  if (typeof window === 'undefined') return def;
  try { return JSON.parse(localStorage.getItem(key) || 'null') || def; } catch { return def; }
}

// Default settings
const DEFAULT_SETTINGS: Settings = {
  quarterDC: 0.04, yearDC: 0.018, vat: 0.1, naverFee: 0.059,
  openElecFee: 0.13, openHandFee: 0.176, domaeFee: 0.01,
  mkDomae: 1, mkRetail: 15, mkNaver: 17, mkOpen: 27,
  promoFee1: 5.8, promoFee2: 3.6,
  arPromos: [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}],
  volPromos: [{name:'',rate:0},{name:'',rate:0},{name:'',rate:0},{name:'',rate:0}]
};

const DEFAULT_REBATE = [
  { min: 6000000, rate: 0.02 }, { min: 15000000, rate: 0.023 }, { min: 30000000, rate: 0.025 },
  { min: 60000000, rate: 0.027 }, { min: 100000000, rate: 0.029 }, { min: 200000000, rate: 0.031 },
  { min: 300000000, rate: 0.034 }, { min: 500000000, rate: 0.037 }, { min: 700000000, rate: 0.038 },
  { min: 1000000000, rate: 0.04 }
];

// DB singleton
class Database {
  products: Product[] = [];
  inventory: InventoryItem[] = [];
  promotions: Promotion[] = [];
  orders: { elec: any[]; hand: any[]; pack: any[] } = { elec: [], hand: [], pack: [] };
  settings: Settings = { ...DEFAULT_SETTINGS };
  rebate: { min: number; rate: number }[] = [];

  init() {
    if (typeof window === 'undefined') return;
    this.products = load(KEYS.products);
    this.inventory = load(KEYS.inventory);
    this.promotions = load(KEYS.promotions);
    this.orders = loadObj(KEYS.orders, { elec: [], hand: [], pack: [] });
    this.settings = loadObj(KEYS.settings, { ...DEFAULT_SETTINGS });
    this.rebate = load(KEYS.rebate);
    if (!this.rebate.length) {
      this.rebate = [...DEFAULT_REBATE];
      save(KEYS.rebate, this.rebate);
    }
  }

  saveProducts() { save(KEYS.products, this.products); }
  saveInventory() { save(KEYS.inventory, this.inventory); }
  savePromotions() { save(KEYS.promotions, this.promotions); }
  saveOrders() { save(KEYS.orders, this.orders); }
  saveSettings() { save(KEYS.settings, this.settings); }
  saveRebate() { save(KEYS.rebate, this.rebate); }
  saveAll() {
    this.saveProducts(); this.saveInventory(); this.savePromotions();
    this.saveOrders(); this.saveSettings();
  }
}

export const DB = new Database();

// Initialize on client side
if (typeof window !== 'undefined') {
  DB.init();
}

// Helpers
export function findProduct(code: string | number): Product | undefined {
  return DB.products.find(p => String(p.code) === String(code));
}
export function findStock(code: string | number): number | null {
  const inv = DB.inventory.find(i => String(i.code) === String(code));
  return inv ? inv.stock : null;
}
export function findPromo(code: string | number): Promotion | undefined {
  return DB.promotions.find(p => String(p.code) === String(code));
}

// Order history helpers
export function getOrderHistory(): OrderHistory[] {
  return loadObj('mw_order_history', []);
}
export function getPoHistory(): OrderHistory[] {
  return loadObj('mw_promo_order_history', []);
}
