/**
 * Escape a single cell for CSV output to mitigate CSV/Formula injection (OWASP guideline).
 */
export function escapeCsvCell(value: string): string {
  let cleanValue = value || "";
  if (/^[\u0000-\u0020]*[=+\-@]/.test(cleanValue) || /^[\t\r\n]/.test(cleanValue)) {
    cleanValue = `'${cleanValue}`;
  }
  // Quote and escape double quotes
  return `"${cleanValue.replace(/"/g, '""')}"`;
}
