import type { PropsWithChildren } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import type { AppModuleKey } from "../../shared/app-modules";
import { useModuleVisibility } from "./ModuleVisibilityContext";

export function ModuleRoute({ moduleKey, children }: PropsWithChildren<{ moduleKey: AppModuleKey }>) {
  const { employee } = useAuth();
  const { isEnabled, isLoading, firstEnabledPath } = useModuleVisibility();
  if (isLoading && employee?.role !== "god" && employee?.role !== "system-administrator") return <LoadingScreen />;
  if (!isEnabled(moduleKey)) return <Navigate to={firstEnabledPath ?? "/modules-disabled"} replace />;
  return children;
}

export function ModulesDisabledPage() {
  return <section className="mx-auto max-w-xl rounded-xl border border-default bg-surface p-6 text-center"><h1 className="text-xl font-semibold text-primary">No sections are available</h1><p className="mt-2 text-sm text-secondary">An administrator has temporarily disabled all app sections. Contact your manager or administrator for access.</p></section>;
}
