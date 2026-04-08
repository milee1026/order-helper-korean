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
    <div className={cn('inline-flex gap-0 isolate', className)} onClick={e => e.stopPropagation()}>
      {RATIOS.map((r, i) => (
        <button
          key={r}
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(r); }}
          className={cn(
            'min-w-[2.5rem] px-2.5 py-1.5 text-xs border transition-colors touch-manipulation select-none',
            i === 0 && 'rounded-l',
            i === RATIOS.length - 1 ? 'rounded-r' : 'border-r-0',
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
