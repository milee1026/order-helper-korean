import React from 'react';
import { cn } from '@/lib/utils';

const RATIOS = [0.8, 0.5, 0.2, 0];

interface RatioSelectorProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

export function RatioSelector({ value, onChange, className }: RatioSelectorProps) {
  return (
    <div className={cn('inline-flex gap-0', className)} onClick={e => e.stopPropagation()}>
      {RATIOS.map(r => (
        <button
          key={r}
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(r); }}
          className={cn(
            'px-2.5 py-1 text-xs border transition-colors touch-manipulation',
            'first:rounded-l last:rounded-r border-r-0 last:border-r',
            value === r
              ? 'bg-primary text-primary-foreground border-primary z-10 relative'
              : 'bg-background text-foreground border-input hover:bg-accent'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
