import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../server/auth/password.js";

describe("password hashing", () => {
  it("uses salted scrypt hashes and rejects an incorrect password", async () => {
    const first = await hashPassword("a sufficiently long password");
    const second = await hashPassword("a sufficiently long password");
    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("a sufficiently long password", first)).resolves.toBe(true);
    await expect(verifyPassword("not the password", first)).resolves.toBe(false);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    await expect(verifyPassword("anything", "not-a-supported-hash")).resolves.toBe(false);
  });
});
