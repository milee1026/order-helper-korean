import { ItemConfig, AppSettings } from '@/types';

// ─── FARMERS ───
export const FARMERS_ITEMS: ItemConfig[] = [
  {
    id: 'f-salad', name: '샐야', category: '야채', vendor: 'farmers', unitDesc: '락 (2kg=1봉지=1락)',
    fields: [
      { key: 'unusedPortioned', label: '미사용 소분량(락)', type: 'number' },
      { key: 'usedRatio', label: '사용중 소분량 비율', type: 'ratio' },
      { key: 'unportioned', label: '미소분량(락)', type: 'number' },
      { key: 'inbound', label: '입고분(락)', type: 'number' },
      { key: 'orderKg', label: '발주량(kg)', type: 'number' },
    ],
    totalLabel: '총재고(락)',
    computeTotal: (v) => (Number(v.unusedPortioned) || 0) + (Number(v.usedRatio) || 0) + (Number(v.unportioned) || 0) + (Number(v.inbound) || 0),
  },
  {
    id: 'f-broccoli', name: '브로콜리', category: '야채', vendor: 'farmers', unitDesc: '1/4 바트 (4송이=1통)',
    fields: [
      { key: 'unusedBlanched', label: '미사용 데침(1/4 바트)', type: 'number' },
      { key: 'usedBlanchedRatio', label: '사용 데침 비율', type: 'ratio' },
      { key: 'prepped', label: '손질(1/4 바트)', type: 'number' },
      { key: 'untrimmed', label: '미손질(송이)', type: 'number' },
      { key: 'inboundKg', label: '입고분(kg)', type: 'number' },
      { key: 'inboundCount', label: '입고분(송이)', type: 'number' },
      { key: 'orderKg', label: '발주량(kg)', type: 'number' },
    ],
    totalLabel: '총재고(1/4 바트)',
    computeTotal: (v) => (Number(v.unusedBlanched) || 0) + (Number(v.usedBlanchedRatio) || 0) + (Number(v.prepped) || 0) + (Number(v.untrimmed) || 0) / 4,
  },
  {
    id: 'f-paprika', name: '파프리카', category: '야채', vendor: 'farmers', unitDesc: '1/4 바트 (5kg=3개)',
    fields: [
      { key: 'unusedPrepped', label: '미사용 손질(1/4 바트)', type: 'number' },
      { key: 'usedRatio', label: '사용 손질 비율', type: 'ratio' },
      { key: 'untrimmedKg', label: '미손질(kg)', type: 'number' },
      { key: 'inbound', label: '입고분(kg)', type: 'number' },
      { key: 'orderKg', label: '발주량(kg)', type: 'number' },
    ],
    totalLabel: '총재고(1/4 바트)',
    computeTotal: (v) => (Number(v.unusedPrepped) || 0) + (Number(v.usedRatio) || 0) + (Number(v.untrimmedKg) || 0) / 5 * 3 + (Number(v.inbound) || 0) / 5 * 3,
  },
  {
    id: 'f-chive', name: '쪽파', category: '야채', vendor: 'farmers', unitDesc: '1/4 바트 (1봉지≈900g=2개)',
    fields: [
      { key: 'unusedPortioned', label: '미사용 소분(1/4 바트)', type: 'number' },
      { key: 'usedRatio', label: '사용 소분 비율', type: 'ratio' },
      { key: 'unportionedBags', label: '미소분(봉지)', type: 'number' },
      { key: 'inbound', label: '입고분(봉지)', type: 'number' },
      { key: 'orderBags', label: '발주량(봉지)', type: 'number' },
    ],
    totalLabel: '총재고(1/4 바트)',
    computeTotal: (v) => (Number(v.unusedPortioned) || 0) + (Number(v.usedRatio) || 0) + (Number(v.unportionedBags) || 0) * 2 + (Number(v.inbound) || 0) * 2,
  },
];

// ─── HELPER FACTORIES ───
function ratioItem(id: string, name: string, cat: string, unitDesc: string, opts?: {
  usedLabel?: string; unusedLabel?: string; ratioOnly?: boolean; unusedOnly?: boolean;
  noInbound?: boolean; customFields?: ItemConfig['fields'];
  totalLabel?: string;
  computeTotal?: ItemConfig['computeTotal'];
}): ItemConfig {
  const fields: ItemConfig['fields'] = opts?.customFields || [];
  if (!opts?.customFields) {
    if (opts?.ratioOnly) {
      fields.push({ key: 'usedRatio', label: opts?.usedLabel || '잔여비율', type: 'ratio' });
    } else if (opts?.unusedOnly) {
      fields.push({ key: 'unused', label: opts?.unusedLabel || '미사용 수', type: 'number' });
    } else {
      fields.push({ key: 'unused', label: opts?.unusedLabel || '미사용 수', type: 'number' });
      fields.push({ key: 'usedRatio', label: opts?.usedLabel || '사용중 비율', type: 'ratio' });
    }
    if (!opts?.noInbound) fields.push({ key: 'inbound', label: '입고분', type: 'number' });
    fields.push({ key: 'order', label: '발주량', type: 'number' });
  }

  // Determine the unit suffix from unitDesc for totalLabel
  const defaultLabel = (() => {
    const parts = unitDesc.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const unit = last.replace(/^\d+/, '');
    return `총재고(${unit})`;
  })();

  const defaultCompute: ItemConfig['computeTotal'] = (v) => {
    if (opts?.ratioOnly) {
      return (Number(v.usedRatio) || 0);
    }
    if (opts?.unusedOnly) {
      return (Number(v.unused) || 0);
    }
    return (Number(v.unused) || 0) + (Number(v.usedRatio) || 0);
  };

  return {
    id, name, category: cat, vendor: 'marketbom', unitDesc, fields,
    totalLabel: opts?.totalLabel || defaultLabel,
    computeTotal: opts?.computeTotal || defaultCompute,
  };
}

// ─── MARKETBOM - MEAT ───
const MEAT_ITEMS: ItemConfig[] = [
  { id: 'm-beef', name: '소', category: '고기류', vendor: 'marketbom', unitDesc: '10kg 1판',
    fields: [
      { key: 'unusedTrays', label: '미사용 판 수', type: 'number' },
      { key: 'openPacks', label: '사용중 남은 팩', type: 'number' },
      { key: 'inbound', label: '입고분(판)', type: 'number' },
      { key: 'order', label: '발주량(판)', type: 'number' },
    ],
    totalLabel: '총재고(팩)',
    computeTotal: (v, s) => {
      const ppt = s?.meatPacksPerTray?.['m-beef'] || 10;
      return (Number(v.unusedTrays) || 0) * ppt + (Number(v.openPacks) || 0);
    },
  },
  { id: 'm-pork', name: '돼지', category: '고기류', vendor: 'marketbom', unitDesc: '10kg 1판',
    fields: [
      { key: 'unusedTrays', label: '미사용 판 수', type: 'number' },
      { key: 'openPacks', label: '사용중 남은 팩', type: 'number' },
      { key: 'inbound', label: '입고분(판)', type: 'number' },
      { key: 'order', label: '발주량(판)', type: 'number' },
    ],
    totalLabel: '총재고(팩)',
    computeTotal: (v, s) => {
      const ppt = s?.meatPacksPerTray?.['m-pork'] || 10;
      return (Number(v.unusedTrays) || 0) * ppt + (Number(v.openPacks) || 0);
    },
  },
  { id: 'm-chicken', name: '닭', category: '고기류', vendor: 'marketbom', unitDesc: '10kg 1판',
    fields: [
      { key: 'unusedTrays', label: '미사용 판 수', type: 'number' },
      { key: 'openPacks', label: '사용중 남은 팩', type: 'number' },
      { key: 'inbound', label: '입고분(판)', type: 'number' },
      { key: 'order', label: '발주량(판)', type: 'number' },
    ],
    totalLabel: '총재고(팩)',
    computeTotal: (v, s) => {
      const ppt = s?.meatPacksPerTray?.['m-chicken'] || 10;
      return (Number(v.unusedTrays) || 0) * ppt + (Number(v.openPacks) || 0);
    },
  },
];

// ─── SAUCES ───
const sauceNames: [string, string, string][] = [
  ['ms-soy', '소이소스', '1팩'],
  ['ms-beef', '비프소스', '1팩'],
  ['ms-oriental', '오리엔탈', '1팩'],
  ['ms-balsamic', '발사믹', '1팩'],
  ['ms-salsa', '살사', '1팩'],
  ['ms-mild-teri', '순한데리', '1팩'],
  ['ms-med-teri', '중간데리', '1팩'],
  ['ms-hot-teri', '매운데리', '1팩'],
  ['ms-wasabi-dr', '와사비드레싱', '1팩'],
  ['ms-salpa', '샐파소스', '10팩 1박스'],
  ['ms-rose', '로제소스', '10팩 1박스'],
  ['ms-curry', '커리소스', '10팩 1박스'],
];
const SAUCE_INBOUND_MULTIPLIER: Record<string, number> = {
  'ms-salpa': 10, 'ms-rose': 10, 'ms-curry': 10,
};
const SAUCE_ITEMS: ItemConfig[] = sauceNames.map(([id, name, unit]) => {
  const mult = SAUCE_INBOUND_MULTIPLIER[id];
  if (mult) {
    return ratioItem(id, name, '소스류', unit, {
      totalLabel: '총재고(팩)',
      computeTotal: (v) => (Number(v.unused) || 0) + (Number(v.usedRatio) || 0),
    });
  }
  return ratioItem(id, name, '소스류', unit, { totalLabel: '총재고(팩)' });
});

// ─── OTHER REFRIGERATED ───
const REFRIG_ITEMS: ItemConfig[] = [
  ratioItem('mr-parmesan', '파마산', '그 외 냉장제품', '팩', { usedLabel: '사용중 비율', unusedLabel: '미사용팩', totalLabel: '총재고(팩)' }),
  ratioItem('mr-yogurt', '요거트', '그 외 냉장제품', '2통 1박스', {
    usedLabel: '사용중 비율', unusedLabel: '미사용통', totalLabel: '총재고(통)',
    computeTotal: (v) => (Number(v.unused) || 0) + (Number(v.usedRatio) || 0),
  }),
  {
    id: 'mr-myeongyi', name: '명이나물', category: '그 외 냉장제품', vendor: 'marketbom', unitDesc: '10kg 1통',
    fields: [
      { key: 'unusedQuarter', label: '미사용(1/4 바트)', type: 'number' },
      { key: 'quarterRatio', label: '사용중(1/4) 비율', type: 'ratio' },
      { key: 'halfRatio', label: '손질(1/2) 사용중 비율', type: 'ratio' },
      { key: 'inbound', label: '입고분(통)', type: 'number' },
      { key: 'order', label: '발주량(통)', type: 'number' },
    ],
  },
];

// ─── FROZEN ───
const FROZEN_ITEMS: ItemConfig[] = [
  ratioItem('mf-sweetpotato', '고구마', '냉동제품', '2팩 1박스', {
    totalLabel: '총재고(팩)',
    computeTotal: (v) => (Number(v.unused) || 0) + (Number(v.usedRatio) || 0),
  }),
  ratioItem('mf-pumpkin', '단호박', '냉동제품', '5팩 1박스', {
    totalLabel: '총재고(팩)',
    computeTotal: (v) => (Number(v.unused) || 0) + (Number(v.usedRatio) || 0),
  }),
  ratioItem('mf-greenbean', '그린빈', '냉동제품', '10팩 1박스', {
    totalLabel: '총재고(팩)',
    computeTotal: (v) => (Number(v.unused) || 0) + (Number(v.usedRatio) || 0),
  }),
];

// ─── PACKAGING ───
const PKG_DEFS: [string, string, string, { ratioOnly?: boolean; unusedOnly?: boolean; totalLabel?: string; computeTotal?: ItemConfig['computeTotal'] }?][] = [
  ['mp-16oz-pulp', '16온스 펄프용기', '75개 4팩 1박스'],
  ['mp-24oz-pulp', '24온스 펄프용기', '75개 4팩 1박스'],
  ['mp-32oz-pulp', '32온스 펄프용기', '75개 1팩'],
  ['mp-curry-cont', '커리용기', '50개 1봉지'],
  ['mp-075oz-cup', '0.75온스 컵(생와사비용)', '100개 1줄'],
  ['mp-095oz-cup', '0.95온스 컵(와드용)', '100개 1줄'],
  ['mp-2oz-cup', '2온스 컵(소스용)', '100개 1줄'],
  ['mp-7oz-cup', '7온스 컵(그래놀라용)', '50개 1줄'],
  ['mp-12oz-cup', '12온스 컵(요거트용)', '50개 1줄'],
  ['mp-16oz-cup', '16온스 컵(음료용)', '50개 1줄'],
  ['mp-22oz-cup', '22온스 컵(라지 음료용)', '50개 1줄'],
  ['mp-13oz-paper', '13온스 종이컵(핫 음료용)', '100개 1줄'],
  ['mp-hole-lid', '타공리드', '100개 1줄'],
  ['mp-nohole-lid', '무타공리드', '100개 1줄'],
  ['mp-square-lid', '사각리드', '50개 6봉지 1박스', {
    totalLabel: '총재고(봉지)',
    computeTotal: (v: Record<string, number>) => (Number(v.unused) || 0) + (Number(v.usedRatio) || 0),
  }],
  ['mp-bag-s', '포장봉투(소)', '200장 1봉지', { unusedOnly: true }],
  ['mp-band', '띠지', '2500장 1박스', { ratioOnly: true }],
  ['mp-drink-bag-1', '1구짜리 음료 봉투', '200개 1봉지', { unusedOnly: true }],
  ['mp-drink-bag-2', '2구짜리 음료 봉투', '200개 1봉지', { unusedOnly: true }],
];
const PKG_ITEMS: ItemConfig[] = PKG_DEFS.map(([id, name, unit, opts]) =>
  ratioItem(id, name, '포장용품', unit, opts)
);

// ─── OTHER SUPPLIES ───
const OTHER_DEFS: [string, string, string, { ratioOnly?: boolean; unusedOnly?: boolean; customFields?: ItemConfig['fields']; totalLabel?: string; computeTotal?: ItemConfig['computeTotal'] }?][] = [
  ['mo-pasta', '파스타면', '20봉지 1박스', {
    totalLabel: '총재고(봉지)',
    customFields: [
      { key: 'openBags', label: '사용중 박스 남은 봉지 수', type: 'number' },
      { key: 'unused', label: '미사용 박스 수', type: 'number' },
      { key: 'inbound', label: '입고분(박스)', type: 'number' },
      { key: 'order', label: '발주량', type: 'number' },
    ],
    computeTotal: (v) => (Number(v.unused) || 0) * 20 + (Number(v.openBags) || 0),
  }],
  ['mo-napkin', '냅킨', '500장 1봉지'],
  ['mo-spoon', '숟가락', '100개 1봉지'],
  ['mo-chopstick', '젓가락', '3000개 1박스', { ratioOnly: true }],
  ['mo-smoothie-straw', '스무디 스트로우', '200개 1팩'],
  ['mo-green-straw', '초록색 스트로우', '500개 1팩'],
  ['mo-muffin-cup', '머핀컵', '200개 1팩'],
  ['mo-wettissue', '물티슈', '1000개 1봉지', { ratioOnly: true }],
  ['mo-coffee', '커피콩', '1팩'],
  ['mo-cupholder', '컵홀더', '1000개 1박스', { ratioOnly: true }],
  ['mo-granola', '그래놀라', '1팩'],
  ['mo-cereal', '시리얼', '1팩'],
  ['mo-parsley', '파슬리', '1팩'],
  ['mo-furikake', '후리가케', '1팩'],
  ['mo-almond', '아몬드분태', '1팩'],
  ['mo-agave', '아가베시럽', '2통 1묶음', {
    totalLabel: '총재고(통)',
    computeTotal: (v: Record<string, number>) => (Number(v.unused) || 0) + (Number(v.usedRatio) || 0),
  }],
  ['mo-yogurt-spoon', '요거트스푼', '100개 1봉지'],
  ['mo-red-pepper', '크러쉬드 레드페퍼', '1통'],
  ['mo-olive-oil', '올리브유', '1통'],
  ['mo-lid-sticker', '무타공리드 스티커', '1000개 1팩', { ratioOnly: true, totalLabel: '총재고(팩)' }],
];
const OTHER_ITEMS: ItemConfig[] = OTHER_DEFS.map(([id, name, unit, opts]) =>
  ratioItem(id, name, '그 외 비품', unit, opts)
);

// ─── EXPORTS ───
export const MARKETBOM_ITEMS: ItemConfig[] = [
  ...MEAT_ITEMS, ...SAUCE_ITEMS, ...REFRIG_ITEMS, ...FROZEN_ITEMS, ...PKG_ITEMS, ...OTHER_ITEMS,
];

export const ALL_ITEMS: ItemConfig[] = [...FARMERS_ITEMS, ...MARKETBOM_ITEMS];

export const MARKETBOM_CATEGORIES = ['고기류', '소스류', '그 외 냉장제품', '냉동제품', '포장용품', '그 외 비품'];

export function getItemById(id: string): ItemConfig | undefined {
  return ALL_ITEMS.find(i => i.id === id);
}

export function getItemsByVendor(vendor: 'farmers' | 'marketbom'): ItemConfig[] {
  return vendor === 'farmers' ? FARMERS_ITEMS : MARKETBOM_ITEMS;
}

export function getItemsByCategory(category: string): ItemConfig[] {
  return MARKETBOM_ITEMS.filter(i => i.category === category);
}
