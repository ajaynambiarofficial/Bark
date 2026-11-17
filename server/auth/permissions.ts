export const PERMISSIONS = [
  "dashboard:view:self", "dashboard:view:team", "dashboard:view:global",
  "bookings:view", "bookings:create", "bookings:update", "bookings:status:update", "bookings:cancel", "bookings:manage:any",
  "escalations:view", "escalations:create", "escalations:comment", "escalations:assign", "escalations:tier:2", "escalations:tier:3", "escalations:close", "escalations:manage:any",
  "calendar:view", "calendar:manage",
  "clinics:view", "clinics:manage", "services:view", "services:manage",
  "admin:users", "admin:roles", "admin:workflows", "admin:settings", "admin:data", "admin:audit", "admin:emergency",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const BUILT_IN_ROLES = {
  "sales-agent": { name: "Sales Agent", clearance: 10 },
  "clinic-front-desk": { name: "Clinic Front Desk", clearance: 10 },
  doctor: { name: "Doctor", clearance: 20 },
  groomer: { name: "Groomer", clearance: 20 },
  "sales-team-lead": { name: "Sales Team Lead", clearance: 40 },
  "clinic-manager": { name: "Clinic Manager", clearance: 50 },
  "sales-manager": { name: "Sales Manager", clearance: 60 },
  "zonal-head": { name: "Zonal Head", clearance: 65 },
  "central-management": { name: "Central Management", clearance: 70 },
  "system-administrator": { name: "System Administrator", clearance: 90 },
  god: { name: "GOD / Super Admin", clearance: 100 },
} as const;

const common = ["dashboard:view:self", "bookings:view", "bookings:status:update", "bookings:cancel", "escalations:view", "escalations:comment", "calendar:view", "clinics:view", "services:view"];

export const BUILT_IN_ROLE_PERMISSIONS: Record<keyof typeof BUILT_IN_ROLES, readonly string[]> = {
  "sales-agent": [...common, "bookings:create", "escalations:create"],
  "clinic-front-desk": [...common, "bookings:create", "bookings:update", "escalations:create"],
  doctor: common,
  groomer: [...common, "escalations:create"],
  "sales-team-lead": [...common, "dashboard:view:team", "bookings:create", "bookings:update", "escalations:create", "escalations:assign", "escalations:tier:2", "escalations:close", "calendar:manage"],
  "clinic-manager": [...common, "dashboard:view:team", "bookings:create", "bookings:update", "bookings:manage:any", "escalations:create", "escalations:assign", "escalations:tier:2", "escalations:tier:3", "escalations:close", "calendar:manage"],
  "sales-manager": [...common, "dashboard:view:team", "bookings:create", "bookings:update", "bookings:manage:any", "escalations:create", "escalations:assign", "escalations:tier:2", "escalations:tier:3", "escalations:close", "calendar:manage"],
  "zonal-head": [...common, "dashboard:view:team", "bookings:create", "bookings:update", "escalations:create", "escalations:assign", "escalations:tier:2", "escalations:tier:3", "escalations:close", "calendar:manage"],
  "central-management": [...common, "dashboard:view:global", "bookings:manage:any", "escalations:manage:any", "calendar:manage"],
  "system-administrator": [...common, "dashboard:view:global", "admin:users", "admin:roles", "admin:workflows", "admin:settings", "admin:data", "admin:audit", "admin:emergency"],
  god: [...PERMISSIONS],
};
