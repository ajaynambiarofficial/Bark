import type { AuthAdapter, Employee } from "../types/auth";
import { dataSources } from "../config/data-sources";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${dataSources.internalApi.baseUrl}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? "The server could not complete this request.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiAuthAdapter: AuthAdapter = {
  async restoreSession() {
    try {
      const result = await request<{ data: { employee: Employee } }>("/auth/session");
      return result.data.employee;
    } catch {
      return null;
    }
  },
  async signIn(email, password, rememberMe = false) {
    const result = await request<{ data: { employee: Employee } }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, rememberMe }) });
    return result.data.employee;
  },
  async signInWithGoogle(credential) {
    const result = await request<{ data: { employee: Employee } }>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) });
    return result.data.employee;
  },
  async signOut() {
    await request<void>("/auth/logout", { method: "POST", body: "{}" });
  },
};
