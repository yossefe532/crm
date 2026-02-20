"use client"

import { Button } from "./Button"
import * as XLSX from "xlsx"
// import jsPDF from "jspdf"
// import autoTable from "jspdf-autotable"

interface Props {
  data: any[]
  filename: string
  headers: string[]
  keys: string[]
  label?: string
}

export const ExportButton = ({ data, filename, headers, keys, label = "تصدير" }: Props) => {
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      data.map((item) => {
        const row: any = {}
        keys.forEach((key, index) => {
          row[headers[index]] = item[key]
        })
        return row
      })
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }

  // const handleExportPDF = () => {
  //   const doc = new jsPDF()
    
  //   // Add font support for Arabic if needed (requires adding font file, skipping for basic implementation)
  //   // For now, English headers or transliteration might be safer, but let's try basic text
    
  //   doc.text(filename, 14, 15)
    
  //   const tableData = data.map((item) => keys.map((key) => item[key]))

  //   // @ts-ignore
  //   autoTable(doc, {
  //     head: [headers],
  //     body: tableData,
  //     startY: 20,
  //     styles: { font: "helvetica", halign: "right" }, // Basic font
  //     headStyles: { fillColor: [41, 128, 185] },
  //   })

  //   doc.save(`${filename}.pdf`)
  // }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExportExcel} size="sm">
        تصدير Excel
      </Button>
    </div>
  )
}
