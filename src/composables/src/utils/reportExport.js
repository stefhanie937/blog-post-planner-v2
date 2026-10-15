// CSV + PDF export for the admin reports.
// A "column" is { key, label, get(row) -> string, csv?(row) -> string }.

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCsv(columns, rows) {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const lines = rows.map((row) =>
    columns.map((c) => csvCell((c.csv ?? c.get)(row))).join(',')
  )
  // The leading BOM makes Excel read the file as UTF-8.
  return '\ufeff' + [header, ...lines].join('\r\n')
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadFile(filename, content, mime) {
  downloadBlob(filename, new Blob([content], { type: mime }))
}

// jsPDF's built-in fonts only cover Latin text, so anything else (emoji,
// non-Latin scripts) is dropped instead of printing as garbage.
function pdfText(value, max = 400) {
  const text = String(value ?? '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\n]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export async function exportPdf({ title, meta = [], columns, rows, filename }) {
  // Loaded on demand so the PDF libraries don't weigh down the rest of the app.
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ])

  const doc = new JsPDF({
    orientation: columns.length > 5 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4'
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40

  // Title band (brand navy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const metaLines = doc.splitTextToSize(pdfText(meta.join('   |   '), 1200), pageWidth - margin * 2)
  const bandHeight = 58 + metaLines.length * 12

  doc.setFillColor(35, 43, 77)
  doc.rect(0, 0, pageWidth, bandHeight, 'F')
  doc.setFillColor(226, 152, 149)
  doc.rect(0, bandHeight, pageWidth, 3, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(pdfText(title, 120), margin, 36)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(215, 220, 238)
  doc.text(metaLines, margin, 54)

  autoTable(doc, {
    startY: bandHeight + 18,
    margin: { top: 40, left: margin, right: margin, bottom: 44 },
    head: [columns.map((c) => pdfText(c.label, 60))],
    body: rows.map((row) => columns.map((c) => pdfText((c.pdf ?? c.get)(row)))),
    theme: 'striped',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 5,
      textColor: [35, 43, 77],
      overflow: 'linebreak',
      valign: 'top'
    },
    headStyles: { fillColor: [78, 99, 176], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 251] }
  })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 128, 160)
    doc.text('Post Planner admin report', margin, pageHeight - 22)
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 22, { align: 'right' })
  }

  doc.save(filename)
}
