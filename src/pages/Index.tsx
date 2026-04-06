import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { TodayRecord } from '@/pages/TodayRecord';
import { RecordHistory } from '@/pages/RecordHistory';
import { AnalysisSummary } from '@/pages/AnalysisSummary';
import { SettingsExport } from '@/pages/SettingsExport';

const Index = () => {
  const [tab, setTab] = useState('today');

  return (
    <AppLayout activeTab={tab} onTabChange={setTab}>
      {tab === 'today' && <TodayRecord />}
      {tab === 'history' && <RecordHistory />}
      {tab === 'analysis' && <AnalysisSummary />}
      {tab === 'settings' && <SettingsExport />}
    </AppLayout>
  );
};

export default Index;
