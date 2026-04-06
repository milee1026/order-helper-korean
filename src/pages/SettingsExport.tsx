import React, { useState, useRef } from 'react';
import { loadSettings, saveSettings, loadRecords, saveRecords } from '@/utils/storage';
import { recordsToCsvRows, csvRowsToString, downloadCsv, parseCsvString, csvToRecords } from '@/utils/csv';
import { computeAnalysis } from '@/utils/analysis';
import { exportToExcel, exportAnalysisToExcel, exportToPdf, exportAnalysisToPdf } from '@/utils/exportFiles';
import { AppSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useToast } from '@/hooks/use-toast';

export function SettingsExport() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateSettings = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    toast({ title: '설정 저장됨' });
  };

  const updateMeatPacks = (itemId: string, val: number) => {
    updateSettings({ meatPacksPerTray: { ...settings.meatPacksPerTray, [itemId]: val } });
  };

  const handleExportAllCsv = () => {
    const records = loadRecords();
    const rows = recordsToCsvRows(records);
    const csv = csvRowsToString(rows);
    downloadCsv(csv, `inventory-data-${new Date().toISOString().split('T')[0]}.csv`);
    toast({ title: '다운로드 완료', description: `${rows.length}행 CSV 내보내기` });
  };

  const handleExportAllExcel = () => {
    const records = loadRecords();
    const result = exportToExcel(records, settings);
    if (result.count === 0) { toast({ title: '내보낼 데이터가 없습니다', variant: 'destructive' }); return; }
    toast({ title: '다운로드 완료', description: `${result.count}행 Excel 내보내기` });
  };

  const handleExportAllPdf = () => {
    const records = loadRecords();
    const result = exportToPdf(records, settings);
    if (result.count === 0) { toast({ title: '내보낼 데이터가 없습니다', variant: 'destructive' }); return; }
    toast({ title: '다운로드 완료', description: `${result.count}행 PDF 내보내기` });
  };

  const handleExportAnalysisCsv = () => {
    const records = loadRecords();
    const analysis = computeAnalysis(records, settings);
    const headers = ['품목', '카테고리', '발주횟수', '평균발주', '최빈발주', '평균재고', '최소재고', '최대재고', '중위재고', '평균입고', '기본발주후보', '최소기준후보'];
    const lines = [
      headers.join(','),
      ...analysis.map(a => [
        a.itemName, a.category, a.orderCount, a.avgOrder, a.modeOrder,
        a.avgStock, a.minStock, a.maxStock, a.medianStock, a.avgInbound,
        a.defaultOrderCandidate, a.minThresholdCandidate,
      ].join(','))
    ];
    downloadCsv(lines.join('\n'), `inventory-analysis-${new Date().toISOString().split('T')[0]}.csv`);
    toast({ title: '분석 CSV 다운로드 완료' });
  };

  const handleExportAnalysisExcel = () => {
    const records = loadRecords();
    const analysis = computeAnalysis(records, settings);
    const result = exportAnalysisToExcel(analysis);
    if (result.count === 0) { toast({ title: '내보낼 데이터가 없습니다', variant: 'destructive' }); return; }
    toast({ title: '분석 Excel 다운로드 완료' });
  };

  const handleExportAnalysisPdf = () => {
    const records = loadRecords();
    const analysis = computeAnalysis(records, settings);
    const result = exportAnalysisToPdf(analysis);
    if (result.count === 0) { toast({ title: '내보낼 데이터가 없습니다', variant: 'destructive' }); return; }
    toast({ title: '분석 PDF 다운로드 완료' });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const csv = ev.target?.result as string;
        const rows = parseCsvString(csv);
        const imported = csvToRecords(rows);
        const existing = loadRecords();
        const merged = [...existing, ...imported];
        saveRecords(merged);
        toast({ title: '가져오기 완료', description: `${imported.length}건 추가됨` });
      } catch (err) {
        toast({ title: '오류', description: '파일 형식이 올바르지 않습니다.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClearAll = () => {
    if (!confirm('모든 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    saveRecords([]);
    toast({ title: '전체 삭제 완료' });
  };

  const meatItems = [
    { id: 'm-beef', name: '소' },
    { id: 'm-pork', name: '돼지' },
    { id: 'm-chicken', name: '닭' },
  ];

  return (
    <div className="space-y-3">
      <CollapsibleSection title="기록 기간 설정">
        <label className="flex items-center gap-2 text-xs">
          <span>추적 기간:</span>
          <select
            className="h-7 border rounded px-2 text-xs bg-background"
            value={settings.trackingWeeks}
            onChange={e => updateSettings({ trackingWeeks: Number(e.target.value) as 2 | 4 })}
          >
            <option value={2}>2주</option>
            <option value={4}>4주</option>
          </select>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="고기 판당 평균 팩 수 설정">
        <div className="space-y-2">
          {meatItems.map(m => (
            <label key={m.id} className="flex items-center gap-2 text-xs">
              <span className="w-12">{m.name}:</span>
              <Input
                type="number"
                className="w-20 h-7 text-xs"
                value={settings.meatPacksPerTray[m.id] || 10}
                onChange={e => updateMeatPacks(m.id, Number(e.target.value))}
              />
              <span className="text-muted-foreground">팩/판</span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="데이터 내보내기 / 가져오기">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExportAll}>전체 데이터 CSV 다운로드</Button>
            <Button size="sm" variant="outline" onClick={handleExportAnalysis}>분석 요약 CSV 다운로드</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">CSV 가져오기:</span>
            <input ref={fileRef} type="file" accept=".csv" className="text-xs" onChange={handleImport} />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="데이터 관리" defaultOpen={false}>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">현재 저장된 기록: {loadRecords().length}건</p>
          <Button size="sm" variant="destructive" onClick={handleClearAll}>전체 기록 삭제</Button>
        </div>
      </CollapsibleSection>
    </div>
  );
}
