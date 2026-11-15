import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ColorTheme = "bark" | "ocean" | "violet" | "amber";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  colorTheme: ColorTheme;
  setPreference(preference: ThemePreference): void;
  setColorTheme(colorTheme: ColorTheme): void;
}

const STORAGE_KEY = "bark.appearance";
const COLOR_THEME_KEY = "bark.color-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(stored) ? stored : "system";
}

function readColorTheme(): ColorTheme {
  const stored = window.localStorage.getItem(COLOR_THEME_KEY);
  return stored === "ocean" || stored === "violet" || stored === "amber" ? stored : "bark";
}

function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const media = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(readColorTheme);
  const [prefersDark, setPrefersDark] = useState(media.matches);
  const resolvedTheme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [media]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.palette = colorTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const appBackground = window.getComputedStyle(document.documentElement).getPropertyValue("--app-background").trim();
    if (appBackground) themeMeta?.setAttribute("content", appBackground);
  }, [resolvedTheme, colorTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    window.localStorage.setItem(STORAGE_KEY, nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  const setColorTheme = useCallback((nextTheme: ColorTheme) => {
    window.localStorage.setItem(COLOR_THEME_KEY, nextTheme);
    setColorThemeState(nextTheme);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, colorTheme, setPreference, setColorTheme }),
    [preference, resolvedTheme, colorTheme, setPreference, setColorTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
