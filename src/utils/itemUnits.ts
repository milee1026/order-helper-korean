// Unit labels for display in automation ordering UI
// orderUnit = unit used for ordering (평균발주량, 추천발주량, 최종발주)
// stockUnit = unit used for stock measurement (최소재고량, 현재재고)

import type { AppSettings } from '@/types';

interface ItemUnits {
  orderUnit: string;
  stockUnit: string;
}

export const MEAT_PACKS_PER_TRAY: Record<'m-beef' | 'm-pork' | 'm-chicken', number> = {
  'm-beef': 5,
  'm-pork': 4,
  'm-chicken': 5,
};

const ITEM_UNITS: Record<string, ItemUnits> = {
  // Farmers
  'f-salad': { orderUnit: 'kg', stockUnit: '락' },
  'f-broccoli': { orderUnit: 'kg', stockUnit: '1/4바트' },
  'f-paprika': { orderUnit: 'kg', stockUnit: '1/4바트' },
  'f-chive': { orderUnit: '봉', stockUnit: '1/4바트' },

  // Meat
  'm-beef': { orderUnit: '판', stockUnit: '팩' },
  'm-pork': { orderUnit: '판', stockUnit: '팩' },
  'm-chicken': { orderUnit: '판', stockUnit: '팩' },

  // Sauces (regular)
  'ms-soy': { orderUnit: '팩', stockUnit: '팩' },
  'ms-beef': { orderUnit: '팩', stockUnit: '팩' },
  'ms-oriental': { orderUnit: '팩', stockUnit: '팩' },
  'ms-balsamic': { orderUnit: '팩', stockUnit: '팩' },
  'ms-salsa': { orderUnit: '팩', stockUnit: '팩' },
  'ms-mild-teri': { orderUnit: '팩', stockUnit: '팩' },
  'ms-med-teri': { orderUnit: '팩', stockUnit: '팩' },
  'ms-hot-teri': { orderUnit: '팩', stockUnit: '팩' },
  'ms-wasabi-dr': { orderUnit: '팩', stockUnit: '팩' },
  // Box sauces
  'ms-salpa': { orderUnit: '박스', stockUnit: '팩' },
  'ms-rose': { orderUnit: '박스', stockUnit: '팩' },
  'ms-curry': { orderUnit: '박스', stockUnit: '팩' },

  // Other refrigerated
  'mr-parmesan': { orderUnit: '팩', stockUnit: '팩' },
  'mr-yogurt': { orderUnit: '박스', stockUnit: '통' },
  'mr-myeongyi': { orderUnit: '통', stockUnit: '1/4바트' },

  // Frozen
  'mf-sweetpotato': { orderUnit: '박스', stockUnit: '팩' },
  'mf-pumpkin': { orderUnit: '박스', stockUnit: '팩' },
  'mf-greenbean': { orderUnit: '박스', stockUnit: '팩' },

  // Packaging
  'mp-16oz-pulp': { orderUnit: '박스', stockUnit: '팩' },
  'mp-24oz-pulp': { orderUnit: '박스', stockUnit: '팩' },
  'mp-32oz-pulp': { orderUnit: '팩', stockUnit: '팩' },
  'mp-curry-cont': { orderUnit: '봉지', stockUnit: '봉지' },
  'mp-075oz-cup': { orderUnit: '줄', stockUnit: '줄' },
  'mp-095oz-cup': { orderUnit: '줄', stockUnit: '줄' },
  'mp-2oz-cup': { orderUnit: '줄', stockUnit: '줄' },
  'mp-7oz-cup': { orderUnit: '줄', stockUnit: '줄' },
  'mp-12oz-cup': { orderUnit: '줄', stockUnit: '줄' },
  'mp-16oz-cup': { orderUnit: '줄', stockUnit: '줄' },
  'mp-22oz-cup': { orderUnit: '줄', stockUnit: '줄' },
  'mp-13oz-paper': { orderUnit: '줄', stockUnit: '줄' },
  'mp-hole-lid': { orderUnit: '줄', stockUnit: '줄' },
  'mp-nohole-lid': { orderUnit: '줄', stockUnit: '줄' },
  'mp-square-lid': { orderUnit: '박스', stockUnit: '봉지' },
  'mp-bag-s': { orderUnit: '봉지', stockUnit: '봉지' },
  'mp-band': { orderUnit: '박스', stockUnit: '박스' },
  'mp-drink-bag-1': { orderUnit: '봉지', stockUnit: '봉지' },
  'mp-drink-bag-2': { orderUnit: '봉지', stockUnit: '봉지' },

  // Other supplies
  'mo-pasta': { orderUnit: '박스', stockUnit: '봉지' },
  'mo-napkin': { orderUnit: '봉지', stockUnit: '봉지' },
  'mo-spoon': { orderUnit: '봉지', stockUnit: '봉지' },
  'mo-chopstick': { orderUnit: '박스', stockUnit: '박스' },
  'mo-smoothie-straw': { orderUnit: '팩', stockUnit: '팩' },
  'mo-green-straw': { orderUnit: '팩', stockUnit: '팩' },
  'mo-muffin-cup': { orderUnit: '팩', stockUnit: '팩' },
  'mo-wettissue': { orderUnit: '봉지', stockUnit: '봉지' },
  'mo-coffee': { orderUnit: '팩', stockUnit: '팩' },
  'mo-cupholder': { orderUnit: '박스', stockUnit: '박스' },
  'mo-granola': { orderUnit: '팩', stockUnit: '팩' },
  'mo-cereal': { orderUnit: '팩', stockUnit: '팩' },
  'mo-parsley': { orderUnit: '팩', stockUnit: '팩' },
  'mo-furikake': { orderUnit: '팩', stockUnit: '팩' },
  'mo-almond': { orderUnit: '팩', stockUnit: '팩' },
  'mo-agave': { orderUnit: '묶음', stockUnit: '통' },
  'mo-garlic-flake': { orderUnit: '통', stockUnit: '통' },
  'mo-yogurt-spoon': { orderUnit: '봉지', stockUnit: '봉지' },
  'mo-red-pepper': { orderUnit: '통', stockUnit: '통' },
  'mo-olive-oil': { orderUnit: '통', stockUnit: '통' },
  'mo-lid-sticker': { orderUnit: '팩', stockUnit: '팩' },
};

// Orderable unit step sizes (minimum orderable increment)
const ORDER_STEP: Record<string, number> = {
  'f-salad': 2,
  'f-broccoli': 4,
  'f-paprika': 5,
  'f-chive': 1,
};

export interface OrderRoundingContext {
  averageOrderCandidate?: number;
  medianOrderCandidate?: number;
  carryOverRatio?: number;
}

export interface OrderRoundingResult {
  value: number;
  policy: string;
  reason: string;
}

export function normalizeOrderQuantityWithPolicy(
  itemId: string,
  raw: number,
  context: OrderRoundingContext = {}
): OrderRoundingResult {
  if (raw <= 0) {
    return {
      value: 0,
      policy: '0 이하 추천',
      reason: '추천 raw가 0 이하라 발주 추천을 0으로 처리',
    };
  }
  const step = ORDER_STEP[itemId] || 1;
  if (['m-beef', 'm-pork', 'm-chicken'].includes(itemId)) {
    return normalizeMeatOrder(raw, context);
  }
  return {
    value: Math.ceil(raw / step) * step,
    policy: `발주 가능 단위(${step})로 올림`,
    reason: '기본 발주 단위를 지키기 위해 올림 적용',
  };
}

/** Round a raw order quantity to a valid orderable multiple. */
export function normalizeOrderQuantity(itemId: string, raw: number): number {
  return normalizeOrderQuantityWithPolicy(itemId, raw).value;
}

export function getOrderUnit(itemId: string): string {
  return ITEM_UNITS[itemId]?.orderUnit || '';
}

export function getStockUnit(itemId: string): string {
  return ITEM_UNITS[itemId]?.stockUnit || '';
}

export function getStockUnitsPerOrderUnit(itemId: string, settings?: AppSettings): number {
  switch (itemId) {
    case 'f-salad':
      return 0.5;
    case 'f-broccoli':
      return 1;
    case 'f-paprika':
      return 0.6;
    case 'f-chive':
      return 2;
    case 'm-beef':
    case 'm-pork':
    case 'm-chicken':
      return MEAT_PACKS_PER_TRAY[itemId as keyof typeof MEAT_PACKS_PER_TRAY];
    case 'ms-salpa':
    case 'ms-rose':
    case 'ms-curry':
      return 10;
    case 'mr-yogurt':
      return 2;
    case 'mo-pasta':
      return 20;
    case 'mo-agave':
      return 2;
    default:
      return 1;
  }
}

export function convertStockToOrderUnits(itemId: string, stockValue: number, settings?: AppSettings): number {
  const factor = getStockUnitsPerOrderUnit(itemId, settings);
  if (!Number.isFinite(stockValue) || factor <= 0) return 0;
  return stockValue / factor;
}

export function convertOrderUnitsToStock(itemId: string, orderValue: number, settings?: AppSettings): number {
  const factor = getStockUnitsPerOrderUnit(itemId, settings);
  if (!Number.isFinite(orderValue) || factor <= 0) return 0;
  return orderValue * factor;
}

/** Format a quantity with its unit while preserving zero values. */
export function formatQuantityWithUnit(val: number | undefined | null, unit: string): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return '-';
  const rounded = Math.round(val * 100) / 100;
  if (!unit) return `${rounded}`;
  if (unit.includes('/')) return `${rounded}(${unit})`;
  return `${rounded}${unit}`;
}

/** Format a value with its unit, returns '-' if value is falsy */
export function fmtWithUnit(val: number | undefined, unit: string): string {
  if (val === undefined || val === null || !val) return '-';
  const rounded = Math.round(val * 100) / 100;
  if (unit.includes('/')) return `${rounded}(${unit})`;
  return `${rounded}${unit}`;
}

function normalizeMeatOrder(raw: number, context: OrderRoundingContext): OrderRoundingResult {
  const lower = Math.floor(raw);
  const fraction = raw - lower;
  const roundedUp = Math.ceil(raw);
  if (lower > 0 && fraction > 0 && fraction <= 0.25) {
    const reference = Math.max(
      Number(context.averageOrderCandidate) || 0,
      Number(context.medianOrderCandidate) || 0
    );
    const isSafeAgainstReference = reference <= 0 || lower >= reference * 0.9;
    const hasVeryLowCarryOver = (Number(context.carryOverRatio) || 0) <= 0.15;
    const referenceClearlyHigher = reference > 0 && lower < reference * 0.9;

    if (isSafeAgainstReference && !(hasVeryLowCarryOver && referenceClearlyHigher)) {
      return {
        value: lower,
        policy: '고기류 소수점 허용 정책',
        reason: 'raw 소수점이 0.25 이하이고 내림값이 평균/중앙값 기준의 90% 이상이라 내림 허용',
      };
    }
  }

  return {
    value: roundedUp,
    policy: '고기류 보수적 올림',
    reason: 'raw 소수점이 크거나 내림 시 평균/중앙값 기준보다 낮아질 수 있어 올림 적용',
  };
}

