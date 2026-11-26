export const APP_MODULES = [
  { key: "team.home", group: "Team", label: "Home", description: "The team home dashboard.", path: "/welcome" },
  { key: "team.bookings", group: "Team", label: "Bookings", description: "Team booking queue and clinic bookings.", path: "/bookings" },
  { key: "team.calendar", group: "Team", label: "Calendar", description: "Shared team calendar.", path: "/calendar" },
  { key: "team.escalations", group: "Team", label: "Escalations", description: "Escalations, feature requests, and bug reports.", path: "/escalations" },
  { key: "team.guide", group: "Team", label: "Guide", description: "Team guide and operating instructions.", path: "/guide" },
  { key: "team.notice-board", group: "Team", label: "Notice Board", description: "Company notices and acknowledgements.", path: "/notice-board" },
  { key: "team.team-email", group: "Team", label: "Team Email", description: "Draft and send email updates to the team.", path: "/team-email" },
  { key: "pawcare.booking", group: "Pawcare", label: "Booking", description: "Pawcare customer booking flow.", path: "/pawcare/booking" },
  { key: "pawcare.appointments", group: "Pawcare", label: "Appointments", description: "Pawcare appointment management.", path: "/pawcare/appointments" },
  { key: "pawcare.quotes", group: "Pawcare", label: "Quote generator", description: "Create and manage service estimates.", path: "/pawcare/quotes" },
  { key: "pawcare.chat", group: "Pawcare", label: "Clinic Chat", description: "Clinic team conversations.", path: "/pawcare/chat" },
  { key: "pawcare.pharmacy", group: "Pawcare", label: "Pharmacy", description: "Pharmacy operations.", path: "/pawcare/pharmacy" },
  { key: "pawcare.diagnostics", group: "Pawcare", label: "Diagnostics", description: "Diagnostic services and results.", path: "/pawcare/diagnostics" },
] as const;

export type AppModuleKey = (typeof APP_MODULES)[number]["key"];
export type AppModuleGroup = (typeof APP_MODULES)[number]["group"];

export function isAppModuleKey(key: string): key is AppModuleKey {
  return APP_MODULES.some((module) => module.key === key);
}
