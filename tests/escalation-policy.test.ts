import { describe, expect, it } from "vitest";
import { canTransitionEscalation, requiredPermissionForTier } from "../server/domain/escalation-policy.js";

describe("escalation policy", () => {
  it("allows configured progress and reopen transitions", () => {
    expect(canTransitionEscalation("New", "Assigned")).toBe(true);
    expect(canTransitionEscalation("Closed", "Reopened")).toBe(true);
    expect(canTransitionEscalation("New", "Closed")).toBe(false);
  });

  it("requires explicit permission for higher tiers", () => {
    expect(requiredPermissionForTier(1)).toBeNull();
    expect(requiredPermissionForTier(2)).toBe("escalations:tier:2");
    expect(requiredPermissionForTier(3)).toBe("escalations:tier:3");
  });
});
