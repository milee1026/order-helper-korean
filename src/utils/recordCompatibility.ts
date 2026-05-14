import type { AppSettings, ItemConfig, ItemData } from '@/types';

function hasStoredValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function readCompatibleInbound(item: ItemData): number | string {
  if (hasStoredValue(item.inbound)) return item.inbound;

  if (item.itemId === 'f-broccoli' && hasStoredValue(item.values?.inboundKg)) {
    return item.values.inboundKg;
  }

  if (hasStoredValue(item.values?.inbound)) return item.values.inbound;

  return '';
}

export function readCompatibleTotalStock(
  item: ItemData,
  config: ItemConfig,
  settings: AppSettings
): number | undefined {
  if (typeof item.totalStock === 'number' && Number.isFinite(item.totalStock)) {
    return item.totalStock;
  }

  if (hasStoredValue(item.totalStock)) {
    const numeric = Number(item.totalStock);
    if (Number.isFinite(numeric)) return numeric;
  }

  return config.computeTotal ? config.computeTotal(item.values as Record<string, number>, settings) : undefined;
}
