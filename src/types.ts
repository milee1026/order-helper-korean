export type Vendor = 'farmers' | 'marketbom';
export type RecorderType = 'manager' | 'staff';
export type FieldType = 'number' | 'ratio' | 'text';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  suffix?: string;
}

export interface ItemConfig {
  id: string;
  name: string;
  category: string;
  vendor: Vendor;
  unitDesc: string;
  fields: FieldConfig[];
  computeTotal?: (values: Record<string, number>, settings?: AppSettings) => number;
  totalLabel?: string;
}

export interface ItemData {
  itemId: string;
  values: Record<string, number | string>;
  inbound: number | string;
  order: number | string;
  memo: string;
  totalStock?: number;
}

export interface DailyRecord {
  id: string;
  date: string;
  vendor: Vendor;
  recorderType: RecorderType;
  orderDay: number;
  coverDays: string[];
  items: ItemData[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  trackingWeeks: 2 | 4;
  meatPacksPerTray: Record<string, number>;
}

export interface CsvRow {
  date: string;
  vendor: string;
  recorder_type: string;
  order_day: string;
  cover_days: string;
  category: string;
  item_name: string;
  unit_type: string;
  used_amount: string;
  unused_amount: string;
  inbound_amount: string;
  order_amount: string;
  total_stock_converted: string;
  memo: string;
  raw_values: string;
}
