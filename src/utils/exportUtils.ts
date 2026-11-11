/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openEnterprisePrintWindow, escapePrintHtml } from './printEngine';

/**
 * Exports data to a CSV file and triggers a browser download.
 * Handles commas, quotes, and newlines safely with standard RFC 4180 escaping.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows: string[] = [];
  csvRows.push(headers.map(escapeCell).join(','));

  for (const row of rows) {
    csvRows.push(row.map(escapeCell).join(','));
  }

  const csvString = csvRows.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a clean printable window formatted with CTVill corporate branding
 * and triggers window.print() for instant printing or Save to PDF.
 */
export function printRegisterTable(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const headersHtml = headers.map(h => `<th>${escapePrintHtml(h)}</th>`).join('');
  const rowsHtml = rows
    .map(
      row =>
        `<tr>${row
          .map(c => `<td>${escapePrintHtml(c ?? '')}</td>`)
          .join('')}</tr>`
    )
    .join('');

  const bodyHtml = `<table class="ent-table">
    <thead>
      <tr>${headersHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="${headers.length}" class="center">No records found.</td></tr>`}
    </tbody>
  </table>`;

  openEnterprisePrintWindow({
    title,
    subtitle,
    docRef: `REG-${Date.now().toString().slice(-6)}`,
    orientation: headers.length >= 6 ? 'landscape' : 'portrait',
    kpiSummary: [
      { label: 'Total Records Printed', value: `${rows.length} Entries` },
      { label: 'Register Classification', value: title },
      { label: 'Verification Status', value: 'Official ERP Ledger' },
    ],
    bodyHtml,
  });
}
