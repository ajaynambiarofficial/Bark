import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../drizzle/0000_watery_james_howlett.sql", import.meta.url), "utf8");

describe("database guardrails", () => {
  it("makes audit history immutable", () => {
    expect(migration).toContain("audit_events_immutable");
    expect(migration).toContain("BEFORE UPDATE OR DELETE");
    expect(migration).toContain("audit_events is append-only");
  });

  it("prevents overlapping active staff bookings", () => {
    expect(migration).toContain("bookings_staff_no_overlap");
    expect(migration).toContain("EXCLUDE USING gist");
    expect(migration).toContain("tstzrange");
  });
});
