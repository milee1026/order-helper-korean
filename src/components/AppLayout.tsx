import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

const TABS = [
  { id: 'today', label: '?ㅻ뒛 湲곕줉' },
  { id: 'automation', label: '?먮룞??諛쒖＜' },
  { id: 'history', label: '湲곕줉 ?댁뿭' },
  { id: 'analysis', label: '遺꾩꽍 / ?붿빟' },
  { id: 'settings', label: '?ㅼ젙 / ?대낫?닿린' },
];

export function AppLayout({ activeTab, onTabChange, onLogout, children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background pb-14">
        <header className="border-b bg-background sticky top-0 z-10 px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-foreground">?ш퀬 湲곕줉</span>
          {onLogout && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onLogout}>
              ?α겕?솗
            </Button>
          )}
        </header>
        <main className="p-2">{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 border-t bg-background z-10 flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-primary border-t-2 border-primary bg-primary/5'
                  : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center px-4 h-10 gap-3">
          <span className="text-sm font-bold mr-6 text-foreground">?ш퀬 湲곕줉</span>
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
          {onLogout && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={onLogout}>
              ?α겕?솗
            </Button>
          )}
        </div>
      </nav>
      <main className="p-3 max-w-[1024px] mx-auto">{children}</main>
    </div>
  );
}
