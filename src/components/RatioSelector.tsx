import React from 'react';
import { cn } from '@/lib/utils';

const RATIOS = [0.7, 0.5, 0.3, 0];

interface RatioSelectorProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

export function RatioSelector({ value, onChange, className }: RatioSelectorProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      {RATIOS.map(r => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            'px-2 py-0.5 text-xs rounded border transition-colors',
            value === r
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-input hover:bg-accent'
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
