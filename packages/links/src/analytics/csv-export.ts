export type CsvRow = Record<string, string>

function escapeField(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `"'${value.replace(/"/g, '""')}"`
  }
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function generateCsv(columns: string[], rows: CsvRow[]): string {
  const header = columns.map(escapeField).join(',')
  const dataLines = rows.map((row) =>
    columns.map((col) => escapeField(row[col] ?? '')).join(',')
  )
  return [header, ...dataLines, ''].join('\r\n')
}
