import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, children, className, headerRight }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('border rounded mb-2', className)}>
      <div className="flex items-center bg-muted hover:bg-accent transition-colors">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-left"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {title}
        </button>
        {headerRight && <div className="px-2">{headerRight}</div>}
      </div>
      {open && <div className="p-2">{children}</div>}
    </div>
  );
}
