import React, { useState } from 'react';
import type { RecommendationAudit, CoverageRecommendationPlan } from '@/utils/recommendations';
import { formatQuantityWithUnit } from '@/utils/itemUnits';

interface Props {
  audit?: RecommendationAudit;
  currentStockConverted: number;
  leadDays: number;
  plan: CoverageRecommendationPlan;
  roundedRecommendation: number;
  roundingPolicy: string;
  roundingReason: string;
  orderUnit: string;
  stockUnit: string;
  hasInput: boolean;
}

function fmt(value: number | undefined, unit = ''): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return formatQuantityWithUnit(value, unit);
}

function sourceLabel(source: 'automation' | 'today'): string {
  return source === 'automation' ? '자동화 finalOrder' : '오늘 기록 order';
}

export function RecommendationAuditDetails({
  audit,
  currentStockConverted,
  leadDays,
  plan,
  roundedRecommendation,
  roundingPolicy,
  roundingReason,
  orderUnit,
  stockUnit,
  hasInput,
}: Props) {
  const [open, setOpen] = useState(false);
  const usedRecords = audit?.usedRecords || [];
  const excludedRecords = audit?.excludedRecords || [];

  return (
    <div className="mt-2 text-xs">
      <button
        type="button"
        className="text-primary underline-offset-2 hover:underline"
        onClick={() => setOpen(prev => !prev)}
      >
        {open ? '계산 근거 닫기' : '계산 근거 보기'}
      </button>

      {open && (
        <div className="mt-2 rounded border bg-muted/20 p-2 space-y-2">
          <div className="grid gap-1 sm:grid-cols-2">
            <div>학습 사용 기록 수: <b>{usedRecords.length}</b></div>
            <div>학습 제외 기록 수: <b>{excludedRecords.length}</b></div>
            <div>estimatedDailyUsage: <b>{fmt(audit?.estimatedDailyUsage, orderUnit)}/일</b></div>
            <div>평균발주량: <b>{fmt(audit?.averageOrderCandidate, orderUnit)}</b></div>
            <div>중앙값 발주량: <b>{fmt(audit?.medianOrderCandidate, orderUnit)}</b></div>
            <div>최소재고량: <b>{fmt(audit?.minThresholdCandidate, stockUnit)}</b></div>
            <div>현재재고 환산값: <b>{hasInput ? fmt(currentStockConverted, orderUnit) : '-'}</b></div>
            <div>leadDays: <b>{leadDays}</b></div>
            <div>입고 전 예상 소진량: <b>{hasInput ? fmt(plan.estimatedPreInboundConsumption, orderUnit) : '-'}</b></div>
            <div>carryOver 재고: <b>{hasInput ? fmt(plan.carryOverStock, orderUnit) : '-'}</b></div>
            <div>carryOverRatio: <b>{hasInput ? `${Math.round(plan.carryOverRatio * 100)}%` : '-'}</b></div>
            <div>입고 후 커버 필요량: <b>{hasInput ? fmt(plan.postInboundCoverNeed, orderUnit) : '-'}</b></div>
            <div>기본 수요 계산값: <b>{hasInput ? fmt(plan.recommendationByDemand, orderUnit) : '-'}</b></div>
            <div>평균 하한 후보: <b>{hasInput ? fmt(plan.averageFloorCandidate, orderUnit) : '-'}</b></div>
            <div>중앙값 하한 후보: <b>{hasInput ? fmt(plan.medianFloorCandidate, orderUnit) : '-'}</b></div>
            <div>최소 안전 후보: <b>{hasInput ? fmt(plan.categoryMinimumCandidate, orderUnit) : '-'}</b></div>
            <div>하한 적용 상태: <b>{hasInput ? plan.floorStatus : '-'}</b></div>
            <div>하한 적용 강도: <b>{hasInput ? `${Math.round(plan.floorWeight * 100)}%` : '-'}</b></div>
            <div>보정 후 raw: <b>{hasInput ? fmt(plan.recommendationRawBeforeRounding, orderUnit) : '-'}</b></div>
            <div>최종 추천값: <b>{hasInput ? fmt(roundedRecommendation, orderUnit) : '-'}</b></div>
            <div>발주 단위: <b>{orderUnit || '-'}</b></div>
            <div>반올림/올림 방식: <b>{hasInput ? roundingPolicy : '-'}</b></div>
            <div className="sm:col-span-2">반올림/올림 이유: <b>{hasInput ? roundingReason : '-'}</b></div>
          </div>

          <div>
            <div className="font-medium mb-1">적용된 보정</div>
            {hasInput && plan.appliedAdjustments.length ? (
              <ul className="space-y-1">
                {plan.appliedAdjustments.map((adjustment, index) => (
                  <li key={`${adjustment.label}-${index}`}>
                    <b>{adjustment.label}</b>: {adjustment.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">
                {hasInput ? '추가 보정 없이 기본 수요 계산값을 사용했습니다.' : '현재재고 입력 후 계산 근거를 확인할 수 있습니다.'}
              </div>
            )}
          </div>

          <div>
            <div className="font-medium mb-1">학습에 사용된 기록</div>
            {usedRecords.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse">
                  <thead>
                    <tr className="bg-background">
                      <th className="border px-1 py-1">날짜</th>
                      <th className="border px-1 py-1">출처</th>
                      <th className="border px-1 py-1">커버일</th>
                      <th className="border px-1 py-1">커버일수</th>
                      <th className="border px-1 py-1">값</th>
                      <th className="border px-1 py-1">건별 추정 일평균</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usedRecords.map((record, index) => (
                      <tr key={`${record.source}-${record.date}-${index}`}>
                        <td className="border px-1 py-1">{record.date}</td>
                        <td className="border px-1 py-1">{sourceLabel(record.source)}</td>
                        <td className="border px-1 py-1">{record.coverDays.join(',') || '-'}</td>
                        <td className="border px-1 py-1 text-center">{record.coverDaysCount}</td>
                        <td className="border px-1 py-1 text-right">{fmt(record.value, orderUnit)}</td>
                        <td className="border px-1 py-1 text-right">{fmt(record.estimatedDailyUsage, orderUnit)}/일</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-muted-foreground">사용된 학습 기록이 없습니다.</div>
            )}
          </div>

          <div>
            <div className="font-medium mb-1">학습에서 제외된 기록</div>
            {excludedRecords.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse">
                  <thead>
                    <tr className="bg-background">
                      <th className="border px-1 py-1">날짜</th>
                      <th className="border px-1 py-1">출처</th>
                      <th className="border px-1 py-1">커버일</th>
                      <th className="border px-1 py-1">커버일수</th>
                      <th className="border px-1 py-1">값</th>
                      <th className="border px-1 py-1">제외 이유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excludedRecords.map((record, index) => (
                      <tr key={`${record.source}-${record.date}-excluded-${index}`}>
                        <td className="border px-1 py-1">{record.date}</td>
                        <td className="border px-1 py-1">{sourceLabel(record.source)}</td>
                        <td className="border px-1 py-1">{record.coverDays.join(',') || '-'}</td>
                        <td className="border px-1 py-1 text-center">{record.coverDaysCount}</td>
                        <td className="border px-1 py-1 text-right">{record.value === undefined ? '-' : fmt(record.value, orderUnit)}</td>
                        <td className="border px-1 py-1">{record.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-muted-foreground">제외된 학습 기록이 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
