/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PRIMARY_LDM_LOGO, LDM_COMPANY_LOCATION } from './ldmAssets';

export { LDM_COMPANY_LOCATION };

export interface EnterprisePrintOptions {
  title: string;
  subtitle?: string;
  docRef?: string;
  orientation?: 'portrait' | 'landscape';
  projectMeta?: {
    name: string;
    location?: string;
    period?: string;
    client?: string;
  };
  kpiSummary?: Array<{ label: string; value: string }>;
  bodyHtml: string;
  signatures?: Array<{ role: string; name: string; title: string }>;
}

export function escapePrintHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function openEnterprisePrintWindow(options: EnterprisePrintOptions): void {
  const {
    title,
    subtitle = 'Official Residential & Commercial Turnkey Construction Record',
    docRef = `LDM-${Date.now().toString().slice(-6)}`,
    orientation = 'portrait',
    projectMeta,
    kpiSummary,
    bodyHtml,
    signatures = [
      { role: 'Prepared By', name: 'Site Operations / Timekeeper', title: 'Field Operations & Recording Officer' },
      { role: 'Checked & Verified By', name: 'Engr. Marco Santos', title: 'Senior Project Manager / Civil Engineer' },
      { role: 'Approved By', name: 'Clarisse Mendoza, CPA', title: 'Finance Controller & Executive Sign-Off' },
    ],
  } = options;

  const now = new Date();
  const printedTimestamp = `${now.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })} • ${now.toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const metaHtml = projectMeta
    ? `<div class="meta-box">
        <div class="meta-item">
          <span class="meta-lbl">PROJECT SITE</span>
          <span class="meta-val">${escapePrintHtml(projectMeta.name)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">SITE LOCATION</span>
          <span class="meta-val">${escapePrintHtml(projectMeta.location || LDM_COMPANY_LOCATION)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">PERIOD / CYCLE</span>
          <span class="meta-val">${escapePrintHtml(projectMeta.period || now.toISOString().split('T')[0])}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">CLIENT / OWNER</span>
          <span class="meta-val">${escapePrintHtml(projectMeta.client || 'LDM Construction Client')}</span>
        </div>
      </div>`
    : '';

  const kpiHtml =
    kpiSummary && kpiSummary.length > 0
      ? `<div class="kpi-grid" style="grid-template-columns: repeat(${Math.min(kpiSummary.length, 5)}, 1fr);">
          ${kpiSummary
            .map(
              (k) => `<div class="kpi-card">
              <div class="kpi-lbl">${escapePrintHtml(k.label)}</div>
              <div class="kpi-val">${escapePrintHtml(k.value)}</div>
            </div>`
            )
            .join('')}
        </div>`
      : '';

  const sigHtml =
    signatures && signatures.length > 0
      ? `<div class="sig-grid" style="grid-template-columns: repeat(${signatures.length}, 1fr);">
          ${signatures
            .map(
              (s) => `<div class="sig-block">
              <div class="sig-role">${escapePrintHtml(s.role)}:</div>
              <div class="sig-space"></div>
              <div class="sig-line">${escapePrintHtml(s.name)}</div>
              <div class="sig-title">${escapePrintHtml(s.title)}</div>
              <div class="sig-date">Date Signed: ____ / ____ / 2026</div>
            </div>`
            )
            .join('')}
        </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapePrintHtml(title)} — ${escapePrintHtml(docRef)}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      margin: 0;
      padding: 0;
    }
    .page-wrap {
      padding: 4px;
      background: #ffffff !important;
      color: #0f172a !important;
    }
    .print-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 14px;
    }
    .print-btn {
      background: #0f172a;
      color: #ffffff;
      border: none;
      border-radius: 5px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      .print-toolbar {
        display: none !important;
      }
      .page-wrap {
        padding: 0;
      }
    }
    .letterhead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .company-brand {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.05em;
      color: #0f172a;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 9.5px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.04em;
      margin-top: 1px;
      text-transform: uppercase;
    }
    .doc-title {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 6px;
      letter-spacing: -0.01em;
    }
    .doc-subtitle {
      font-size: 10.5px;
      color: #334155;
      margin-top: 1px;
    }
    .doc-ref-box {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 11px;
      min-width: 195px;
    }
    .doc-ref-id {
      font-weight: 800;
      font-size: 11px;
      color: #0f172a;
    }
    .meta-box {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .meta-lbl {
      display: block;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .meta-val {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 1px;
    }
    .kpi-grid {
      display: grid;
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 10px;
    }
    .kpi-lbl {
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
    }
    .kpi-val {
      font-size: 13px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #0f172a;
      margin-top: 2px;
    }
    table.ent-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 10.5px;
    }
    table.ent-table th,
    table.ent-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: middle;
      color: #0f172a;
    }
    table.ent-table th {
      background: #f1f5f9 !important;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
      text-align: left;
    }
    table.ent-table tr:nth-child(even) td {
      background: #fcfcfd;
    }
    table.ent-table tr.total-row td {
      background: #f1f5f9 !important;
      font-weight: 800;
      border-top: 2px solid #0f172a;
    }
    .num {
      text-align: right !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .center {
      text-align: center !important;
    }
    .section-hdr {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 5px 9px;
      margin: 12px 0 6px 0;
      color: #0f172a;
    }
    .progress-bar-wrap {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: #0f172a;
    }
    .payslip-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .payslip-voucher {
      border: 1.5px solid #0f172a;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .voucher-hdr {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .claim-stub {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1.5px dashed #475569;
      font-size: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      gap: 24px;
      margin-top: 22px;
      padding-top: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-block {
      font-size: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-role {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #475569;
    }
    .sig-space {
      height: 28px;
    }
    .sig-line {
      border-top: 1.5px solid #0f172a;
      padding-top: 4px;
      font-weight: 800;
      font-size: 10.5px;
      color: #0f172a;
    }
    .sig-title {
      font-size: 9.5px;
      color: #334155;
    }
    .sig-date {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    <div class="print-toolbar">
      <div>
        <strong>${escapePrintHtml(title)}</strong> • Formal A4 ${orientation.toUpperCase()} Print Preview
      </div>
      <div style="display:flex;gap:8px;">
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <button class="print-btn" style="background:#475569;" onclick="window.close()">Close</button>
      </div>
    </div>

    <div class="letterhead">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img
          src="${PRIMARY_LDM_LOGO}"
          alt="LDM Construction"
          style="height: 48px; width: auto; max-width: 150px; object-fit: contain;"
          onerror="this.style.display='none'"
        />
        <div>
          <div class="company-brand">LDM CONSTRUCTION</div>
          <div class="company-sub">ENGINEERS &bull; ARCHITECTS &bull; BUILDERS | Design &amp; Build ERP</div>
          <div class="company-sub">${LDM_COMPANY_LOCATION} &bull; ldmengineeringdesign@gmail.com &bull; (+63) 945 681 0515</div>
          <div class="doc-title">${escapePrintHtml(title)}</div>
          <div class="doc-subtitle">${escapePrintHtml(subtitle)}</div>
        </div>
      </div>
      <div class="doc-ref-box">
        <div class="doc-ref-id">REF NO: ${escapePrintHtml(docRef)}</div>
        <div>PRINTED: ${escapePrintHtml(printedTimestamp)}</div>
        <div>FORM STANDARD: A4 ${orientation.toUpperCase()}</div>
      </div>
    </div>

    ${metaHtml}
    ${kpiHtml}
    ${bodyHtml}
    ${sigHtml}
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 180);
    });
  </script>
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=1024,height=800');
  if (!printWin) {
    window.print();
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}

