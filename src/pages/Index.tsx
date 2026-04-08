import React, { useState } from 'react';

import { AppLayout } from '@/components/AppLayout';
import { AnalysisSummary } from '@/pages/AnalysisSummary';
import { AutomationOrder } from '@/pages/AutomationOrder';
import { RecordHistory } from '@/pages/RecordHistory';
import { SettingsExport } from '@/pages/SettingsExport';
import { TodayRecord } from '@/pages/TodayRecord';

interface IndexProps {
  onLogout?: () => void;
}

const Index = ({ onLogout }: IndexProps) => {
  const [tab, setTab] = useState('today');

  return (
    <AppLayout activeTab={tab} onTabChange={setTab} onLogout={onLogout}>
      {tab === 'today' && <TodayRecord />}
      {tab === 'automation' && <AutomationOrder />}
      {tab === 'history' && <RecordHistory />}
      {tab === 'analysis' && <AnalysisSummary />}
      {tab === 'settings' && <SettingsExport />}
    </AppLayout>
  );
};

export default Index;
