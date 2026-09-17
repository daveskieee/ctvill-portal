/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  const printWin = window.open('', '_blank', 'width=1000,height=750');
  if (!printWin) {
    alert('Please allow pop-ups to print or save report to PDF.');
    return;
  }

  const headersHtml = headers.map(h => `<th>${escapeHtml(String(h))}</th>`).join('');
  const rowsHtml = rows
    .map(
      row =>
        `<tr>${row
          .map(c => `<td>${escapeHtml(String(c ?? ''))}</td>`)
          .join('')}</tr>`
    )
    .join('');

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)} - CTVill Corporate Register</title>
        <style>
          @page { size: landscape; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 20px;
            background: #ffffff;
            margin: 0;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #f59e0b;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title-area h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
          }
          .title-area p {
            margin: 4px 0 0 0;
            font-size: 11px;
            color: #64748b;
            font-family: monospace;
          }
          .badge {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
            font-size: 10px;
            font-weight: bold;
            font-family: monospace;
            padding: 4px 8px;
            border-radius: 6px;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 10px;
          }
          th {
            background: #f8fafc;
            color: #334155;
            text-align: left;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            color: #1e293b;
            vertical-align: top;
          }
          tr:nth-child(even) td {
            background: #f8fafc;
          }
          .footer {
            margin-top: 24px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            font-size: 10px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
            font-family: monospace;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)} • Generated on ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })} (PHT)</p>
          </div>
          <div class="badge">CTVill Commercial Fit-Out PMS</div>
        </div>
        <table>
          <thead>
            <tr>${headersHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          <span>Confidential • CTVill Construction & Real Estate Operations</span>
          <span>Record Count: ${rows.length}</span>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWin.document.close();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
