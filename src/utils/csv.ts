import { DailyRecord, CsvRow } from '@/types';
import { getItemById, ALL_ITEMS } from '@/config/items';
import { DAY_NAMES_KR } from '@/config/ordering';
import { loadSettings } from './storage';

export function recordsToCsvRows(records: DailyRecord[]): CsvRow[] {
  const settings = loadSettings();
  const rows: CsvRow[] = [];
  for (const rec of records) {
    for (const item of rec.items) {
      const cfg = getItemById(item.itemId);
      if (!cfg) continue;
      const total = cfg.computeTotal
        ? cfg.computeTotal(item.values as Record<string, number>, settings)
        : item.totalStock;
      rows.push({
        date: rec.date,
        vendor: rec.vendor,
        recorder_type: rec.recorderType,
        order_day: DAY_NAMES_KR[rec.orderDay],
        cover_days: rec.coverDays.join(','),
        category: cfg.category,
        item_name: cfg.name,
        unit_type: cfg.unitDesc,
        used_amount: String(item.values.usedRatio ?? item.values.openPacks ?? ''),
        unused_amount: String(item.values.unused ?? item.values.unusedTrays ?? item.values.morningStock ?? ''),
        inbound_amount: String(item.inbound ?? ''),
        order_amount: String(item.order ?? ''),
        total_stock_converted: total != null ? String(Math.round(total * 100) / 100) : '',
        memo: item.memo || '',
        raw_values: JSON.stringify(item.values),
      });
    }
  }
  return rows;
}

export function csvRowsToString(rows: CsvRow[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = String((row as unknown as Record<string, string>)[h] ?? '');
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ),
  ];
  return lines.join('\n');
}

export function downloadCsv(content: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function parseCsvString(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

export function csvToRecords(csvRows: Record<string, string>[]): DailyRecord[] {
  const grouped = new Map<string, DailyRecord>();
  for (const row of csvRows) {
    const key = `${row.date}-${row.vendor}`;
    if (!grouped.has(key)) {
      const dayIdx = DAY_NAMES_KR.indexOf(row.order_day);
      grouped.set(key, {
        id: crypto.randomUUID(),
        date: row.date,
        vendor: row.vendor as 'farmers' | 'marketbom',
        recorderType: (row.recorder_type as 'manager' | 'staff') || 'manager',
        orderDay: dayIdx >= 0 ? dayIdx : 0,
        coverDays: row.cover_days ? row.cover_days.split(',') : [],
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const rec = grouped.get(key)!;
    let rawValues: Record<string, number | string> = {};
    try { rawValues = JSON.parse(row.raw_values || '{}'); } catch { /* ignore */ }
    rec.items.push({
      itemId: findItemIdByName(row.item_name) || row.item_name,
      values: rawValues,
      inbound: row.inbound_amount || '',
      order: row.order_amount || '',
      memo: row.memo || '',
      totalStock: row.total_stock_converted ? Number(row.total_stock_converted) : undefined,
    });
  }
  return Array.from(grouped.values());
}

function findItemIdByName(name: string): string | undefined {
  return ALL_ITEMS.find((i) => i.name === name)?.id;
}
