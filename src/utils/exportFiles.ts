import { DailyRecord, AppSettings, CsvRow } from '@/types';
import { recordsToCsvRows } from './csv';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(records: DailyRecord[], settings: AppSettings) {
  const rows = recordsToCsvRows(records);
  if (rows.length === 0) return { count: 0 };

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '재고기록');
  XLSX.writeFile(wb, `inventory-data-${new Date().toISOString().split('T')[0]}.xlsx`);
  return { count: rows.length };
}

export function exportAnalysisToExcel(analysisData: any[]) {
  if (analysisData.length === 0) return { count: 0 };

  const rows = analysisData.map(a => ({
    '품목': a.itemName,
    '카테고리': a.category,
    '발주횟수': a.orderCount,
    '평균발주': a.avgOrder,
    '최빈발주': a.modeOrder,
    '평균재고': a.avgStock,
    '최소재고': a.minStock,
    '최대재고': a.maxStock,
    '중위재고': a.medianStock,
    '평균입고': a.avgInbound,
    '기본발주후보': a.defaultOrderCandidate,
    '최소기준후보': a.minThresholdCandidate,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '분석요약');
  XLSX.writeFile(wb, `inventory-analysis-${new Date().toISOString().split('T')[0]}.xlsx`);
  return { count: rows.length };
}

export function exportToPdf(records: DailyRecord[], settings: AppSettings) {
  const rows = recordsToCsvRows(records);
  if (rows.length === 0) return { count: 0 };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Use built-in Helvetica (no Korean font embedding needed for data)
  doc.setFontSize(14);
  doc.text('Inventory Records', 14, 15);
  doc.setFontSize(8);
  doc.text(`Export: ${new Date().toISOString().split('T')[0]}  |  ${rows.length} rows`, 14, 21);

  const headers = ['date', 'vendor', 'order_day', 'category', 'item_name', 'used_amount', 'unused_amount', 'inbound_amount', 'order_amount', 'total_stock_converted', 'memo'];
  const headerLabels = ['날짜', '거래처', '발주요일', '카테고리', '품목', '사용량', '미사용량', '입고량', '발주량', '총재고', '메모'];

  const tableData = rows.map(r =>
    headers.map(h => String((r as unknown as Record<string, string>)[h] ?? ''))
  );

  autoTable(doc, {
    head: [headerLabels],
    body: tableData,
    startY: 25,
    styles: { fontSize: 6, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 8, right: 8 },
  });

  doc.save(`inventory-data-${new Date().toISOString().split('T')[0]}.pdf`);
  return { count: rows.length };
}

export function exportAnalysisToPdf(analysisData: any[]) {
  if (analysisData.length === 0) return { count: 0 };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(14);
  doc.text('Inventory Analysis Summary', 14, 15);
  doc.setFontSize(8);
  doc.text(`Export: ${new Date().toISOString().split('T')[0]}`, 14, 21);

  const headerLabels = ['품목', '카테고리', '발주횟수', '평균발주', '최빈발주', '평균재고', '최소재고', '최대재고', '중위재고', '평균입고', '기본발주후보', '최소기준후보'];

  const tableData = analysisData.map(a => [
    a.itemName, a.category, a.orderCount, a.avgOrder, a.modeOrder,
    a.avgStock, a.minStock, a.maxStock, a.medianStock, a.avgInbound,
    a.defaultOrderCandidate, a.minThresholdCandidate,
  ].map(String));

  autoTable(doc, {
    head: [headerLabels],
    body: tableData,
    startY: 25,
    styles: { fontSize: 6, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 8, right: 8 },
  });

  doc.save(`inventory-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
  return { count: analysisData.length };
}
