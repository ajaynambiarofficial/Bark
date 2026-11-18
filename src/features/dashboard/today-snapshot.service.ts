import { dataSources, googleSheetQueryCsvUrl } from "../../config/data-sources";

export interface TodaySnapshotData {
  date: string;
  updatedAt: string;
  total: number;
  clinic: number;
  ucj: number;
  clinicStaff: { email: string; count: number }[];
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]!;
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function numberAt(rows: string[][], rowIndex: number, columnIndex: number): number {
  const value = Number(rows[rowIndex]?.[columnIndex] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export async function loadTodaySnapshot(signal?: AbortSignal): Promise<TodaySnapshotData> {
  const source = dataSources.dashboardSheets.bookingsForDay;
  const response = await fetch(googleSheetQueryCsvUrl(source.spreadsheetId, source.sheetName), {
    ...(signal ? { signal } : {}),
    headers: { Accept: "text/csv" },
  });
  if (!response.ok) throw new Error("Could not load the Bookings for the Day sheet.");
  const rows = parseCsv(await response.text());
  const clinicStaff = rows.slice(7)
    .map((row) => ({ email: row[0]?.trim() ?? "", count: Number(row[1] ?? 0) }))
    .filter((staff) => staff.email && staff.email !== "No bookings yet" && Number.isFinite(staff.count));
  return {
    date: rows[1]?.[1]?.trim() || "Today",
    updatedAt: rows[1]?.[4]?.trim() || "Unknown",
    total: numberAt(rows, 3, 0),
    clinic: numberAt(rows, 5, 0),
    ucj: numberAt(rows, 5, 4),
    clinicStaff,
  };
}
