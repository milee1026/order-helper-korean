import React from 'react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

const TABS = [
  { id: 'today', label: '오늘 기록' },
  { id: 'history', label: '기록 내역' },
  { id: 'analysis', label: '분석 / 요약' },
  { id: 'settings', label: '설정 / 내보내기' },
];

export function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center px-4 h-10">
          <span className="text-sm font-bold mr-6 text-foreground">재고 기록</span>
          <div className="flex gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-t transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="p-3 max-w-[1024px] mx-auto">{children}</main>
    </div>
  );
}
