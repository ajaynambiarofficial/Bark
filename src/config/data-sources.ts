/**
 * Central registry for data sources used by dashboard screens.
 *
 * Update this file when a dashboard's API or external data source moves.
 * VITE_API_URL can still override the internal API base at build time.
 */
const configuredApiBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
export const apiBaseUrl = (configuredApiBase || "/api").replace(/\/$/, "");

export const dataSources = {
  internalApi: {
    baseUrl: apiBaseUrl,
    dashboardSummary: `${apiBaseUrl}/dashboard/summary`,
    bookings: `${apiBaseUrl}/bookings`,
    calendarEvents: `${apiBaseUrl}/calendar/events`,
    escalations: `${apiBaseUrl}/escalations`,
    escalationOwners: `${apiBaseUrl}/escalations/owners`,
    customerSearch: `${apiBaseUrl}/customers/search`,
  },
  dashboardSheets: {
    bookingsForDay: {
      spreadsheetId: "1EyTmbBSkZMvL5JolKuo8xxOkguYGUKpTJTzlN68n5hM",
      sheetName: "Today Snapshot",
    },
    monthlyShows: {
      spreadsheetId: "1EyTmbBSkZMvL5JolKuo8xxOkguYGUKpTJTzlN68n5hM",
      sheetName: "MTD V2",
      target: 622,
    },
  },
  diagnostics: {
    spreadsheetId: "1F4PlmLixVC0hUf7eNbG1A-j99t7drl5xWG1EHyXp8pg",
    sheets: {
      laboratory: "310814413",
      diagnosticImaging: "530943433",
      procedures: "278116135",
      vaccination: "1932377939",
    },
  },
} as const;

export function googleSheetCsvUrl(spreadsheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

export function googleSheetQueryCsvUrl(spreadsheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}
