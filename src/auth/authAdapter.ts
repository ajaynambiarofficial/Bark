import type { AuthAdapter } from "../types/auth";

let adapterPromise: Promise<AuthAdapter> | null = null;

export function getAuthAdapter(): Promise<AuthAdapter> {
  if (!adapterPromise) {
    adapterPromise = import.meta.env.VITE_USE_MOCK_AUTH === "true"
      ? import("./mockAuthAdapter").then(({ mockAuthAdapter }) => mockAuthAdapter)
      : import("./apiAuthAdapter").then(({ apiAuthAdapter }) => apiAuthAdapter);
  }
  return adapterPromise;
}
