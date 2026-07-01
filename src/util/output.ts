export function renderTable(rows: Record<string, unknown>[], columns: string[]): string {
  if (rows.length === 0) return "(none)";
  const widths = columns.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells.map((cell, i) => cell.padEnd(widths[i])).join("  ").trimEnd();
  const header = line(columns);
  const body = rows.map((r) => line(columns.map((c) => String(r[c] ?? ""))));
  return [header, ...body].join("\n");
}

export function printResult(
  data: unknown,
  opts: { json?: boolean },
  columns?: string[],
): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (Array.isArray(data) && columns) {
    console.log(renderTable(data as Record<string, unknown>[], columns));
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}
