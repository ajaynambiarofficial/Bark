import type { PropsWithChildren } from "react";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../theme/ThemeContext";
import { ModuleVisibilityProvider } from "../modules/ModuleVisibilityContext";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <AuthProvider><ModuleVisibilityProvider>{children}</ModuleVisibilityProvider></AuthProvider>
    </ThemeProvider>
  );
}
