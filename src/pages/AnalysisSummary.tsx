import React, { useState, useMemo } from 'react';
import { useRecords, useSettings } from '@/utils/storage';
import { computeAnalysis, filterRecordsByWeeks } from '@/utils/analysis';
import { DAY_NAMES_KR } from '@/config/ordering';
import { CollapsibleSection } from '@/components/CollapsibleSection';

export function AnalysisSummary() {
  const settings = useSettings();
  const allRecords = useRecords();
  const [weeks, setWeeks] = useState<2 | 4>(settings.trackingWeeks);
  const [filterVendor, setFilterVendor] = useState<string>('all');

  const filtered = useMemo(() => {
    let recs = filterRecordsByWeeks(allRecords, weeks);
    if (filterVendor !== 'all') recs = recs.filter(r => r.vendor === filterVendor);
    return recs;
  }, [allRecords, weeks, filterVendor]);

  const analysis = useMemo(() => computeAnalysis(filtered, settings), [filtered, settings]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">기간:</span>
          <select className="h-7 border rounded px-2 text-xs bg-background" value={weeks} onChange={e => setWeeks(Number(e.target.value) as 2 | 4)}>
            <option value={2}>최근 2주</option>
            <option value={4}>최근 4주</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">거래처:</span>
          <select className="h-7 border rounded px-2 text-xs bg-background" value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
            <option value="all">전체</option>
            <option value="farmers">파머스</option>
            <option value="marketbom">마켓봄</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground ml-auto">분석 대상: {filtered.length}건</span>
      </div>

      {/* Candidate Cards */}
      {analysis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="border rounded p-3">
            <h3 className="text-xs font-bold mb-2 text-primary">기본 발주량 후보</h3>
            <div className="space-y-1">
              {analysis.filter(a => a.defaultOrderCandidate > 0).slice(0, 10).map(a => (
                <div key={a.itemId} className="flex justify-between text-xs">
                  <span>{a.itemName}</span>
                  <span className="font-mono font-medium">{a.defaultOrderCandidate}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border rounded p-3">
            <h3 className="text-xs font-bold mb-2 text-primary">최소 기준 후보</h3>
            <div className="space-y-1">
              {analysis.filter(a => a.minThresholdCandidate > 0).slice(0, 10).map(a => (
                <div key={a.itemId} className="flex justify-between text-xs">
                  <span>{a.itemName}</span>
                  <span className="font-mono font-medium">{a.minThresholdCandidate}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail Table */}
      <CollapsibleSection title="상세 분석 테이블">
        {analysis.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-4">데이터가 부족합니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border px-1 py-1 text-left">품목</th>
                  <th className="border px-1 py-1">발주횟수</th>
                  <th className="border px-1 py-1">평균발주</th>
                  <th className="border px-1 py-1">최빈발주</th>
                  <th className="border px-1 py-1">평균재고</th>
                  <th className="border px-1 py-1">최소재고</th>
                  <th className="border px-1 py-1">최대재고</th>
                  <th className="border px-1 py-1">중위재고</th>
                  <th className="border px-1 py-1">평균입고</th>
                  <th className="border px-1 py-1">기본발주후보</th>
                  <th className="border px-1 py-1">최소기준후보</th>
                </tr>
              </thead>
              <tbody>
                {analysis.map(a => (
                  <tr key={a.itemId} className="hover:bg-accent/30">
                    <td className="border px-1 py-0.5 font-medium">{a.itemName}</td>
                    <td className="border px-1 py-0.5 text-center">{a.orderCount}</td>
                    <td className="border px-1 py-0.5 text-center font-mono">{a.avgOrder}</td>
                    <td className="border px-1 py-0.5 text-center font-mono">{a.modeOrder}</td>
                    <td className="border px-1 py-0.5 text-center font-mono">{a.avgStock}</td>
                    <td className="border px-1 py-0.5 text-center font-mono">{a.minStock}</td>
                    <td className="border px-1 py-0.5 text-center font-mono">{a.maxStock}</td>
                    <td className="border px-1 py-0.5 text-center font-mono">{a.medianStock}</td>
                    <td className="border px-1 py-0.5 text-center font-mono">{a.avgInbound}</td>
                    <td className="border px-1 py-0.5 text-center font-mono font-bold text-primary">{a.defaultOrderCandidate}</td>
                    <td className="border px-1 py-0.5 text-center font-mono font-bold text-primary">{a.minThresholdCandidate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* By Order Day */}
      <CollapsibleSection title="요일별 분석" defaultOpen={false}>
        {analysis.filter(a => Object.keys(a.modeOrderByDay).length > 0).map(a => (
          <div key={a.itemId} className="mb-2">
            <div className="text-xs font-medium mb-1">{a.itemName}</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(a.modeOrderByDay).map(([day, val]) => (
                <span key={day} className="text-xs border rounded px-2 py-0.5">
                  {DAY_NAMES_KR[Number(day)]}요일: 최빈={val} / 평균={a.avgOrderByDay[Number(day)]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CollapsibleSection>
    </div>
  );
}
