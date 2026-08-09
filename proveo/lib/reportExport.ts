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

// ── PDF ejecutivo de una página ─────────────────────────────────────────
// A diferencia de exportReportPDF (una tabla de datos en crudo), este es
// un resumen ya redactado: KPIs, alertas en texto y dos rankings cortos —
// pensado para enviar a gerencia sin que nadie tenga que maquetarlo.
export type ExecutiveSummaryData = {
  subtitle: string
  kpis: { label: string; value: string; trend: number | null }[]
  alerts: string[]
  topRestaurantes: { name: string; euros: number; pedidos: number }[]
  topProductos: { name: string; euros: number; qty: number; unit: string }[]
}

export async function exportExecutiveSummaryPDF(data: ExecutiveSummaryData, filename: string) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 45

  doc.setFontSize(18)
  doc.setTextColor(27, 67, 50)
  doc.text('Informe ejecutivo', margin, y)
  y += 18
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(data.subtitle, margin, y)
  y += 30

  // KPIs en 2x2, como pequeñas tarjetas de texto
  const kpiColW = (pageWidth - margin * 2) / 2
  data.kpis.forEach((k, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = margin + col * kpiColW
    const ky = y + row * 55
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(k.label, x, ky)
    doc.setFontSize(16)
    doc.setTextColor(20)
    doc.text(k.value, x, ky + 18)
    if (k.trend != null) {
      doc.setFontSize(9)
      doc.setTextColor(k.trend >= 0 ? 22 : 200, k.trend >= 0 ? 130 : 40, k.trend >= 0 ? 60 : 40)
      doc.text(`${k.trend >= 0 ? '▲' : '▼'} ${Math.abs(k.trend).toFixed(0)}% vs período anterior`, x, ky + 32)
    }
  })
  y += Math.ceil(data.kpis.length / 2) * 55 + 15

  // Alertas
  doc.setFontSize(12)
  doc.setTextColor(27, 67, 50)
  doc.text('Cosas a tener en cuenta', margin, y)
  y += 16
  doc.setFontSize(9)
  doc.setTextColor(60)
  if (data.alerts.length === 0) {
    doc.text('Sin novedades destacables en este período.', margin, y)
    y += 16
  } else {
    data.alerts.forEach(a => {
      const wrapped = doc.splitTextToSize(`•  ${a}`, pageWidth - margin * 2)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 13 + 4
    })
  }
  y += 10

  // Top restaurantes
  doc.setFontSize(12)
  doc.setTextColor(27, 67, 50)
  doc.text('Restaurantes por gasto', margin, y)
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [['Restaurante', 'Pedidos', 'Gasto total']],
    body: data.topRestaurantes.map(r => [r.name, String(r.pedidos), `${r.euros.toFixed(2)}€`]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [27, 67, 50], textColor: 255, fontStyle: 'bold' },
    theme: 'striped',
  })
  y = (doc as any).lastAutoTable.finalY + 25

  if (y > doc.internal.pageSize.getHeight() - 150) { doc.addPage(); y = 45 }

  // Top productos
  doc.setFontSize(12)
  doc.setTextColor(27, 67, 50)
  doc.text('Productos más consumidos', margin, y)
  autoTable(doc, {
    startY: y + 8,
    margin: { left: margin, right: margin },
    head: [['Producto', 'Cantidad', 'Gasto total']],
    body: data.topProductos.map(p => [p.name, `${p.qty % 1 === 0 ? p.qty : p.qty.toFixed(1)} ${p.unit}`, `${p.euros.toFixed(2)}€`]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [168, 121, 58], textColor: 255, fontStyle: 'bold' },
    theme: 'striped',
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
