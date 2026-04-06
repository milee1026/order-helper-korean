export const DAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'];

export const FARMERS_ORDER_DAYS = [0, 1, 3, 5]; // 일, 월, 수, 금 (main pattern)
export const FARMERS_ALL_ORDER_DAYS = [0, 1, 2, 3, 4, 5]; // 일~금

export const FARMERS_COVER_MAP: Record<number, string> = {
  0: '월',
  1: '화,수',
  2: '수',
  3: '목,금',
  4: '금',
  5: '토,일',
};

export const MARKETBOM_ORDER_DAYS = [0, 2, 4]; // 일, 화, 목

export const MARKETBOM_COVER_MAP: Record<number, string> = {
  0: '화,수',
  2: '목,금',
  4: '토,일,월',
};

export function getCoverDays(vendor: 'farmers' | 'marketbom', dayOfWeek: number): string {
  const map = vendor === 'farmers' ? FARMERS_COVER_MAP : MARKETBOM_COVER_MAP;
  return map[dayOfWeek] || '';
}

export function getOrderDays(vendor: 'farmers' | 'marketbom'): number[] {
  return vendor === 'farmers' ? FARMERS_ALL_ORDER_DAYS : MARKETBOM_ORDER_DAYS;
}

export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}
