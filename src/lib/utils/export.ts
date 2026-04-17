import jsPDF from 'jspdf';
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

export function generateReport(product: string, data: ReportData): void {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`Review Intelligence Report — ${product}`, 14, 20);
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
  
  // Feature sentiment table
  autoTable(doc, {
    startY: 40,
    head: [['Feature', 'Positive %', 'Negative %', 'Confidence']],
    body: data.features.map(f => [
      f.feature, `${f.positive_pct}%`, `${f.negative_pct}%`, f.avg_confidence.toFixed(2)
    ])
  });
  
  // Active alerts section
  doc.addPage();
  doc.text('Active Alerts', 14, 20);
  autoTable(doc, {
    startY: 30,
    head: [['Feature', 'Severity', 'Current %', 'Previous %', 'Recommendation']],
    body: data.alerts.map(a => [
      a.feature, (a.severity || "").toUpperCase(), `${a.current_pct || a.currentPct}%`, 
      `${a.previous_pct || a.previousPct}%`, a.message ? a.message.slice(0, 60) + '...' : ''
    ])
  });
  
  doc.save(`${product.replace(/\s+/g, '_')}_Report.pdf`);
}
