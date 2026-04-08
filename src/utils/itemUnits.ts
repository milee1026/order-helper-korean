// Unit labels for display in automation ordering UI
// orderUnit = unit used for ordering (평균발주량, 추천발주량, 최종발주)
// stockUnit = unit used for stock measurement (최소재고량, 현재재고)

interface ItemUnits {
  orderUnit: string;
  stockUnit: string;
}

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
  'mo-yogurt-spoon': { orderUnit: '봉지', stockUnit: '봉지' },
  'mo-red-pepper': { orderUnit: '통', stockUnit: '통' },
  'mo-olive-oil': { orderUnit: '통', stockUnit: '통' },
  'mo-lid-sticker': { orderUnit: '팩', stockUnit: '팩' },
};

export function getOrderUnit(itemId: string): string {
  return ITEM_UNITS[itemId]?.orderUnit || '';
}

export function getStockUnit(itemId: string): string {
  return ITEM_UNITS[itemId]?.stockUnit || '';
}

/** Format a value with its unit, returns '-' if value is falsy */
export function fmtWithUnit(val: number | undefined, unit: string): string {
  if (val === undefined || val === null || !val) return '-';
  const rounded = Math.round(val * 100) / 100;
  if (unit.includes('/')) return `${rounded}(${unit})`;
  return `${rounded}${unit}`;
}
