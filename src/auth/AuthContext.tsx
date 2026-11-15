import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { getAuthAdapter } from "./authAdapter";
import type { Employee } from "../types/auth";

interface AuthContextValue {
  employee: Employee | null;
  isRestoring: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  updateEmployee(changes: Partial<Employee>): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const adapter = await getAuthAdapter();
        const restoredEmployee = await adapter.restoreSession();
        if (active) setEmployee(restoredEmployee);
      } catch {
        if (active) setEmployee(null);
      } finally {
        if (active) setIsRestoring(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const adapter = await getAuthAdapter();
    const signedInEmployee = await adapter.signIn(email, password);
    setEmployee(signedInEmployee);
  }, []);

  const signOut = useCallback(async () => {
    const adapter = await getAuthAdapter();
    await adapter.signOut();
    setEmployee(null);
  }, []);

  const updateEmployee = useCallback((changes: Partial<Employee>) => {
    setEmployee((current) => current ? { ...current, ...changes } : current);
  }, []);

  const value = useMemo(
    () => ({ employee, isRestoring, signIn, signOut, updateEmployee }),
    [employee, isRestoring, signIn, signOut, updateEmployee],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
