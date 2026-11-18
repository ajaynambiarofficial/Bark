export type DiagnosticCategory = "Laboratory" | "Diagnostic Imaging" | "Procedures" | "Vaccination";

export interface DiagnosticServiceItem {
  id: string;
  category: DiagnosticCategory;
  name: string;
  sku: string;
  price: number | null;
  description: string;
  details: { label: string; value: string }[];
  vendor: string;
  productUrl: string;
}

export interface DiagnosticsResult {
  items: DiagnosticServiceItem[];
  failedSheets: DiagnosticCategory[];
}

import { dataSources, googleSheetCsvUrl } from "../../config/data-sources";

const { spreadsheetId, sheets } = dataSources.diagnostics;
const sources: { category: DiagnosticCategory; gid: string }[] = [
  { category: "Laboratory", gid: sheets.laboratory },
  { category: "Diagnostic Imaging", gid: sheets.diagnosticImaging },
  { category: "Procedures", gid: sheets.procedures },
  { category: "Vaccination", gid: sheets.vaccination },
];

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]!;
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

function price(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function details(...values: [string, string | undefined][]) {
  return values.filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())).map(([label, value]) => ({ label, value: value.trim() }));
}

function toItem(category: DiagnosticCategory, row: string[], rowIndex: number): DiagnosticServiceItem | null {
  if (category === "Laboratory") {
    const name = row[1]?.trim();
    if (!name || name.toLowerCase() === "test name") return null;
    return {
      id: `lab-${row[2]?.trim() || rowIndex}`,
      category,
      name,
      sku: row[2]?.trim() ?? "",
      price: price(row[9]) ?? price(row[6]),
      description: "",
      details: details(["Processing", row[3]], ["Sample", row[4]], ["Volume", row[5]], ["VAT", row[7]]),
      vendor: row[10]?.trim() ?? "",
      productUrl: row[14]?.trim() ?? "",
    };
  }
  if (category === "Diagnostic Imaging") {
    const name = row[2]?.trim();
    if (!name || name.toLowerCase() === "service") return null;
    return {
      id: `imaging-${row[1]?.trim() || rowIndex}`,
      category,
      name,
      sku: row[1]?.trim() ?? "",
      price: price(row[6]),
      description: row[10]?.trim() ?? "",
      details: details(["Device", row[5]], ["Tax", row[7]]),
      vendor: row[3]?.trim() ?? "",
      productUrl: row[13]?.trim() ?? "",
    };
  }
  if (category === "Procedures") {
    const name = row[2]?.trim();
    if (!name || name.toLowerCase() === "service") return null;
    return {
      id: `procedure-${row[1]?.trim() || rowIndex}`,
      category,
      name,
      sku: row[1]?.trim() ?? "",
      price: price(row[5]) ?? price(row[7]),
      description: row[9]?.trim() ?? "",
      details: details(["Type", row[4]], ["Tax", row[6]]),
      vendor: row[3]?.trim() ?? "",
      productUrl: row[12]?.trim() ?? "",
    };
  }

  const name = row[2]?.trim();
  if (!name || name.toLowerCase() === "service") return null;
  return {
    id: `vaccine-${row[1]?.trim() || rowIndex}`,
    category,
    name,
    sku: row[1]?.trim() ?? "",
    price: price(row[9]),
    description: row[13]?.trim() ?? "",
    details: details(["Route", row[5]], ["Dose", row[6]], ["Presentation", row[7]], ["Validity", row[8]], ["Tax", row[10]]),
    vendor: row[3]?.trim() ?? "",
    productUrl: row[16]?.trim() ?? "",
  };
}

async function fetchSheet(category: DiagnosticCategory, gid: string, signal?: AbortSignal): Promise<DiagnosticServiceItem[]> {
  const url = googleSheetCsvUrl(spreadsheetId, gid);
  const response = await fetch(url, { ...(signal ? { signal } : {}), headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`Could not load ${category} data.`);
  const rows = parseCsv(await response.text());
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.trim()));
  return rows.slice(headerIndex + 1).map((row, index) => toItem(category, row, index + headerIndex + 2)).filter((item): item is DiagnosticServiceItem => item !== null);
}

export async function loadDiagnosticServices(signal?: AbortSignal): Promise<DiagnosticsResult> {
  const results = await Promise.all(sources.map(async (source) => {
    try {
      return { category: source.category, items: await fetchSheet(source.category, source.gid, signal) };
    } catch (error) {
      if (signal?.aborted) throw error;
      return { category: source.category, items: [] as DiagnosticServiceItem[] };
    }
  }));
  const failedSheets = results.filter((result) => result.items.length === 0).map((result) => result.category);
  return { items: results.flatMap((result) => result.items), failedSheets };
}
