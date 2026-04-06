import React from 'react';
import { ItemConfig, ItemData, AppSettings } from '@/types';
import { MARKETBOM_CATEGORIES, getItemsByCategory } from '@/config/items';
import { Input } from '@/components/ui/input';
import { RatioSelector } from '@/components/RatioSelector';
import { CollapsibleSection } from '@/components/CollapsibleSection';

import { Button } from '@/components/ui/button';

interface MarketbomFormProps {
  data: Record<string, ItemData>;
  onChange: (itemId: string, data: ItemData) => void;
  settings: AppSettings;
}

export function MarketbomForm({ data, onChange, settings }: MarketbomFormProps) {
  const getItem = (id: string): ItemData => data[id] || { itemId: id, values: {}, inbound: '', order: '', memo: '' };

  const updateField = (itemId: string, key: string, val: string | number) => {
    const current = getItem(itemId);
    const sanitized = typeof val === 'string' ? val.replace(/-/g, '') : (val < 0 ? 0 : val);
    const updated = { ...current, values: { ...current.values, [key]: sanitized } };
    if (key === 'inbound') updated.inbound = sanitized;
    if (key === 'order') updated.order = sanitized;
    onChange(itemId, updated);
  };

  const updateMemo = (itemId: string, val: string) => {
    const current = getItem(itemId);
    onChange(itemId, { ...current, memo: val });
  };

  const resetCategory = (cat: string) => {
    const items = getItemsByCategory(cat);
    items.forEach(item => {
      onChange(item.id, { itemId: item.id, values: {}, inbound: '', order: '', memo: '' });
    });
  };

  return (
    <div>
      {MARKETBOM_CATEGORIES.map(cat => {
        const items = getItemsByCategory(cat);
        return (
          <CollapsibleSection
            key={cat}
            title={`${cat} (${items.length})`}
            headerRight={
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); resetCategory(cat); }}
              >
                초기화
              </Button>
            }
          >
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border px-1 py-1 text-left w-28">품목</th>
                  <th className="border px-1 py-1 text-left">입력</th>
                  <th className="border px-1 py-1 w-16">총재고</th>
                  <th className="border px-1 py-1 w-24">메모</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const d = getItem(item.id);
                  const total = item.computeTotal
                    ? item.computeTotal(d.values as Record<string, number>, settings)
                    : undefined;
                  return (
                    <tr key={item.id} className="hover:bg-accent/30">
                      <td className="border px-1 py-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-muted-foreground" style={{ fontSize: '10px' }}>{item.unitDesc}</div>
                      </td>
                      <td className="border px-1 py-1">
                        <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                          {item.fields.map(f => (
                            <FieldInput
                              key={f.key}
                              field={f}
                              value={d.values[f.key]}
                              onChange={(val) => updateField(item.id, f.key, val)}
                              unitDesc={item.unitDesc}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="border px-1 py-1 text-center font-mono">
                        {total != null ? (
                          <div>
                            <div className="text-muted-foreground" style={{ fontSize: '9px' }}>{item.totalLabel || '총재고'}</div>
                            <div>{Math.round(total * 100) / 100}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="border px-1 py-1">
                        <Input
                          className="h-6 text-xs px-1"
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
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

function FieldInput({ field, value, onChange, unitDesc }: {
  field: { key: string; label: string; type: string };
  value: string | number | undefined;
  onChange: (val: string | number) => void;
  unitDesc?: string;
}) {
  const showUnit = (field.key === 'inbound' || field.key === 'order') && unitDesc && !field.label.includes('(');
  const primaryUnit = unitDesc ? extractPrimaryUnit(unitDesc) : '';

  if (field.type === 'ratio') {
    return (
      <label className="flex items-center gap-1">
        <span className="text-muted-foreground whitespace-nowrap">{field.label}</span>
        <RatioSelector value={Number(value) || 0} onChange={onChange} />
      </label>
    );
  }
  return (
    <label className="flex items-center gap-1">
      <span className="text-muted-foreground whitespace-nowrap">{field.label}</span>
      <Input
        type={field.type === 'text' ? 'text' : 'number'}
        min={field.type === 'number' ? '0' : undefined}
        className="w-14 h-6 text-xs px-1"
        value={value ?? ''}
        onChange={e => onChange(field.type === 'number' ? e.target.value : e.target.value)}
      />
      {showUnit && <span className="text-muted-foreground whitespace-nowrap" style={{ fontSize: '10px' }}>{primaryUnit}</span>}
    </label>
  );
}

function extractPrimaryUnit(unitDesc: string): string {
  // e.g. "75개 4팩 1박스" → "박스", "1팩" → "팩", "락" → "락"
  const parts = unitDesc.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.replace(/^\d+/, '');
}
