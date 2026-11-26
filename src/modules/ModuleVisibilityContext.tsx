import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { useAuth } from "../auth/AuthContext";
import { canSendTeamEmail } from "../auth/teamEmailAccess";
import { APP_MODULES } from "../../shared/app-modules";
import type { AppModuleKey } from "../../shared/app-modules";

interface ModuleRow { key: AppModuleKey; enabled: boolean }
interface ModuleVisibilityValue {
  isLoading: boolean;
  isEnabled(key: AppModuleKey): boolean;
  refresh(): Promise<void>;
  firstEnabledPath: string | null;
}

const ModuleVisibilityContext = createContext<ModuleVisibilityValue | null>(null);
const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";
const mockMode = import.meta.env.VITE_USE_MOCK_AUTH === "true";

export function ModuleVisibilityProvider({ children }: PropsWithChildren) {
  const { employee } = useAuth();
  const [disabledKeys, setDisabledKeys] = useState<Set<AppModuleKey>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const hasLoaded = useRef(false);

  const refresh = useCallback(async () => {
    if (!employee || mockMode) {
      setDisabledKeys(new Set());
      setIsLoading(false);
      hasLoaded.current = false;
      return;
    }
    if (!hasLoaded.current) setIsLoading(true);
    try {
      const response = await fetch(`${apiBase}/modules`, { credentials: "include" });
      const payload = await response.json() as { data?: ModuleRow[] };
      if (!response.ok || !payload.data) throw new Error("Module visibility could not be loaded.");
      setDisabledKeys(new Set(payload.data.filter((module) => !module.enabled).map((module) => module.key)));
    } catch {
      // Fail open so a configuration API issue never strands staff outside the app.
      setDisabledKeys(new Set());
    } finally {
      hasLoaded.current = true;
      setIsLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    void refresh();
    if (!employee || mockMode) return;
    const timer = window.setInterval(() => void refresh(), 30_000);
    const refreshOnFocus = () => void refresh();
    const refreshOnAdminChange = () => void refresh();
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("bark:module-visibility-changed", refreshOnAdminChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("bark:module-visibility-changed", refreshOnAdminChange);
    };
  }, [employee, refresh]);

  const isAdmin = employee?.role === "god" || employee?.role === "system-administrator";
  const isEnabled = useCallback((key: AppModuleKey) => isAdmin || !disabledKeys.has(key), [disabledKeys, isAdmin]);
  const firstEnabledPath = APP_MODULES.find((module) => isEnabled(module.key) && (module.key !== "team.team-email" || (employee ? canSendTeamEmail(employee.role) : false)))?.path ?? null;
  const value = useMemo(() => ({ isLoading, isEnabled, refresh, firstEnabledPath }), [isLoading, isEnabled, refresh, firstEnabledPath]);

  return <ModuleVisibilityContext value={value}>{children}</ModuleVisibilityContext>;
}

export function useModuleVisibility() {
  const context = use(ModuleVisibilityContext);
  if (!context) throw new Error("useModuleVisibility must be used within ModuleVisibilityProvider");
  return context;
}
