import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FeatureData {
  feature: string;
  positive_pct: number;
  negative_pct: number;
  avg_confidence: number;
}

export interface ReportData {
  features: FeatureData[];
  alerts: any[];
}

function fmt(n: number) {
  return `${Math.round(n)}%`;
}

function fmtFeature(f: string) {
  return f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function generateReport(product: string, data: ReportData): void {
  const doc = new jsPDF();
  const generated = new Date().toLocaleString();

  // ── Cover / Header ──────────────────────────────────────────────────────
  // Accent bar
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, 210, 8, 'F');

  doc.setTextColor(30, 30, 40);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Xenon AI', 14, 22);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 120);
  doc.text('Review Intelligence Report', 14, 30);

  doc.setFontSize(11);
  doc.setTextColor(30, 30, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(`Product: ${product}`, 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 150);
  doc.text(`Generated: ${generated}`, 14, 49);

  // Divider
  doc.setDrawColor(220, 220, 235);
  doc.line(14, 54, 196, 54);

  // ── Summary KPIs ─────────────────────────────────────────────────────────
  const avgPos = data.features.length
    ? Math.round(data.features.reduce((s, f) => s + f.positive_pct, 0) / data.features.length)
    : 0;
  const avgNeg = data.features.length
    ? Math.round(data.features.reduce((s, f) => s + f.negative_pct, 0) / data.features.length)
    : 0;
  const criticalAlerts = data.alerts.filter(a => a.severity === 'critical').length;
  const highAlerts = data.alerts.filter(a => a.severity === 'high').length;

  const kpis = [
    { label: 'Features Tracked', value: String(data.features.length) },
    { label: 'Avg Positive Sentiment', value: `${avgPos}%` },
    { label: 'Avg Negative Sentiment', value: `${avgNeg}%` },
    { label: 'Active Alerts', value: String(data.alerts.length) },
    { label: 'Critical / High', value: `${criticalAlerts} / ${highAlerts}` },
  ];

  let kpiX = 14;
  const kpiY = 62;
  const kpiW = 36;
  for (const kpi of kpis) {
    doc.setFillColor(245, 245, 252);
    doc.roundedRect(kpiX, kpiY, kpiW, 18, 2, 2, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(kpi.value, kpiX + kpiW / 2, kpiY + 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 120);
    doc.text(kpi.label, kpiX + kpiW / 2, kpiY + 16, { align: 'center' });
    kpiX += kpiW + 2;
  }

  // ── Feature Sentiment Table ───────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 40);
  doc.text('Feature Sentiment Breakdown', 14, 94);

  autoTable(doc, {
    startY: 98,
    head: [['Feature', 'Positive', 'Negative', 'Neutral', 'Confidence']],
    body: data.features.map(f => [
      fmtFeature(f.feature),
      fmt(f.positive_pct),
      fmt(f.negative_pct),
      fmt(Math.max(0, 100 - f.positive_pct - f.negative_pct)),
      (f.avg_confidence * 100).toFixed(0) + '%',
    ]),
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 50] },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    columnStyles: {
      1: { textColor: [22, 163, 74],  fontStyle: 'bold' }, // positive — green
      2: { textColor: [220, 38, 38],  fontStyle: 'bold' }, // negative — red
      3: { textColor: [100, 100, 120] },
      4: { textColor: [79, 70, 229] },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Active Alerts ─────────────────────────────────────────────────────────
  if (data.alerts.length > 0) {
    doc.addPage();

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 8, 'F');

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 40);
    doc.text('Active Alerts', 14, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 120);
    doc.text(`${data.alerts.length} unresolved alert(s) for ${product}`, 14, 29);

    doc.setDrawColor(220, 220, 235);
    doc.line(14, 33, 196, 33);

    autoTable(doc, {
      startY: 38,
      head: [['Feature', 'Severity', 'Was', 'Now', 'Δ', 'Recommendation']],
      body: data.alerts.map(a => {
        const cur = a.current_pct ?? a.currentPct ?? 0;
        const prev = a.previous_pct ?? a.previousPct ?? 0;
        const delta = (cur - prev).toFixed(1);
        return [
          fmtFeature(a.feature),
          (a.severity ?? '').toUpperCase(),
          `${prev.toFixed(1)}%`,
          `${cur.toFixed(1)}%`,
          `+${delta}%`,
          a.message ? a.message.replace(/^SYSTEMIC ISSUE: |^PRAISE SPIKE: /i, '').slice(0, 55) + '…' : '—',
        ];
      }),
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 50] },
      alternateRowStyles: { fillColor: [255, 250, 250] },
      columnStyles: {
        1: { fontStyle: 'bold' },
        3: { textColor: [220, 38, 38], fontStyle: 'bold' },
        4: { textColor: [220, 38, 38] },
      },
      margin: { left: 14, right: 14 },
    });
  } else {
    // No alerts — print "Systems Nominal" on same page if space allows
    const y = (doc as any).lastAutoTable?.finalY ?? 140;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text('✓ No active alerts — all systems nominal.', 14, y + 16);
  }

  // ── Footer on all pages ───────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 180);
    doc.text(
      `Xenon AI — Confidential  |  Page ${i} of ${pageCount}  |  ${generated}`,
      105, 291, { align: 'center' }
    );
  }

  doc.save(`${product.replace(/\s+/g, '_')}_Xenon_Report.pdf`);
}
