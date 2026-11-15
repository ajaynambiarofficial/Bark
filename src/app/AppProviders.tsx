import type { PropsWithChildren } from "react";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../theme/ThemeContext";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
