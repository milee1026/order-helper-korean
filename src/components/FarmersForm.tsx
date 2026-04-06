import React from 'react';
import { ItemConfig, ItemData } from '@/types';
import { FARMERS_ITEMS } from '@/config/items';
import { Input } from '@/components/ui/input';

interface FarmersFormProps {
  data: Record<string, ItemData>;
  onChange: (itemId: string, data: ItemData) => void;
}

export function FarmersForm({ data, onChange }: FarmersFormProps) {
  const getItem = (id: string): ItemData => data[id] || { itemId: id, values: {}, inbound: '', order: '', memo: '' };

  const updateField = (itemId: string, key: string, val: string | number) => {
    const current = getItem(itemId);
    const updated = { ...current, values: { ...current.values, [key]: val } };
    // Handle inbound and order as top-level too
    if (key === 'inbound') updated.inbound = val;
    if (key === 'order') updated.order = val;
    onChange(itemId, updated);
  };

  const updateMemo = (itemId: string, val: string) => {
    const current = getItem(itemId);
    onChange(itemId, { ...current, memo: val });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="border px-2 py-1 text-left w-20">품목</th>
            <th className="border px-2 py-1 text-left" colSpan={4}>입력 항목</th>
            <th className="border px-2 py-1 text-left w-20">총재고</th>
            <th className="border px-2 py-1 text-left w-32">메모</th>
          </tr>
        </thead>
        <tbody>
          {FARMERS_ITEMS.map(item => {
            const d = getItem(item.id);
            const total = item.computeTotal
              ? item.computeTotal(d.values as Record<string, number>)
              : undefined;
            return (
              <tr key={item.id} className="hover:bg-accent/50">
                <td className="border px-2 py-1 font-medium">{item.name}</td>
                <td className="border px-1 py-1" colSpan={4}>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {item.fields.map(f => (
                      <label key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                        <Input
                          type={f.type === 'text' ? 'text' : 'number'}
                          className="w-16 h-7 text-xs px-1"
                          value={d.values[f.key] ?? ''}
                          onChange={e => updateField(item.id, f.key, f.type === 'number' ? e.target.value : e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </td>
                <td className="border px-2 py-1 text-center font-mono text-xs">
                  {total != null ? (Math.round(total * 100) / 100) : '-'}
                </td>
                <td className="border px-1 py-1">
                  <Input
                    className="h-7 text-xs px-1"
                    placeholder="메모"
                    value={d.memo}
                    onChange={e => updateMemo(item.id, e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
