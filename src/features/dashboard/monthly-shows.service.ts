import { dataSources, googleSheetQueryCsvUrl } from "../../config/data-sources";

export interface MonthlyShowsData {
  actual: number;
  target: number;
  updatedAt: string;
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

export async function loadMonthlyShows(email: string, signal?: AbortSignal): Promise<MonthlyShowsData> {
  const source = dataSources.dashboardSheets.monthlyShows;
  const response = await fetch(googleSheetQueryCsvUrl(source.spreadsheetId, source.sheetName), {
    ...(signal ? { signal } : {}),
    headers: { Accept: "text/csv" },
  });
  if (!response.ok) throw new Error("Could not load the monthly shows sheet.");
  const rows = parseCsv(await response.text());
  const normalizedEmail = email.trim().toLowerCase();
  const agentRow = rows.slice(1).find((row) => row[0]?.trim().toLowerCase() === normalizedEmail);
  const actual = Number(agentRow?.[16] ?? 0);
  if (!agentRow || !Number.isFinite(actual)) throw new Error("The logged-in agent was not found in the monthly shows sheet.");
  const metadata = rows[0]?.[0] ?? "";
  const updatedAt = metadata.match(/Last updated:\s*([^,]+)/i)?.[1]?.trim() ?? "Unknown";
  return { actual, target: source.target, updatedAt };
}
