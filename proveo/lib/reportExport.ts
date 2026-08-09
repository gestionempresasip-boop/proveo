// Exportación de informes a Excel (.xlsx) y PDF — usa las librerías que ya
// estaban instaladas en el proyecto (xlsx, jspdf, jspdf-autotable) pero sin
// usar todavía. Todo corre en el navegador, no hace falta backend.

export type ReportSection = {
  heading: string
  headers: string[]
  rows: (string | number)[][]
}

// ── Excel ────────────────────────────────────────────────────────────────
// Una hoja por sección, con los números como números reales (no texto),
// para que en Excel se puedan sumar/graficar directamente.
export async function exportReportExcel(sections: ReportSection[], filename: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  for (const section of sections) {
    const aoa = [section.headers, ...section.rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Ancho de columna aproximado según el contenido más largo de cada una
    ws['!cols'] = section.headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...section.rows.map(r => String(r[i] ?? '').length)
      )
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) }
    })
    // Nombre de hoja: máx 31 caracteres, sin caracteres que Excel prohíbe
    const sheetName = section.heading.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Datos'
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  XLSX.writeFile(wb, filename)
}

// ── PDF ──────────────────────────────────────────────────────────────────
export async function exportReportPDF(
  title: string,
  subtitle: string,
  sections: ReportSection[],
  filename: string
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  doc.setFontSize(16)
  doc.setTextColor(27, 67, 50) // #1B4332
  doc.text(title, margin, 40)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(subtitle, margin, 58)

  let cursorY = 75

  sections.forEach((section, i) => {
    if (i > 0) {
      const lastY = (doc as any).lastAutoTable?.finalY ?? cursorY
      cursorY = lastY + 28
      if (cursorY > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage()
        cursorY = 40
      }
    }

    doc.setFontSize(12)
    doc.setTextColor(27, 67, 50)
    doc.text(section.heading, margin, cursorY)

    autoTable(doc, {
      startY: cursorY + 8,
      margin: { left: margin, right: margin },
      head: [section.headers],
      body: section.rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [27, 67, 50], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 248] },
      theme: 'striped',
    })
  })

  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Generado el ${new Date().toLocaleDateString('es-ES')} · Página ${p} de ${pageCount}`,
      pageWidth - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' }
    )
  }

  doc.save(filename)
}
