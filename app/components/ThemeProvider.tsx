"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const THEMES = [
  { id: "clean-white", name: "Clean White", dark: false, group: "Professional" },
  { id: "enterprise-dark", name: "Enterprise Dark", dark: true, group: "Professional" },
  { id: "notion", name: "Notion Style", dark: false, group: "Professional" },
  { id: "matrix", name: "Matrix Mode", dark: true, group: "Developer" },
  { id: "dracula", name: "Dracula", dark: true, group: "Developer" },
  { id: "nord", name: "Nord", dark: true, group: "Developer" },
  { id: "solarized-dark", name: "Solarized Dark", dark: true, group: "Developer" },
  { id: "cyberpunk", name: "Cyberpunk", dark: true, group: "Fun" },
  { id: "pastel-soft", name: "Pastel Soft", dark: false, group: "Fun" },
  { id: "retro-90s", name: "Retro 90s", dark: false, group: "Fun" },
  { id: "high-contrast", name: "High Contrast", dark: true, group: "Accessibility" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  isDark: boolean;
}>({ theme: "clean-white", setTheme: () => {}, isDark: false });

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(id: ThemeId) {
  const config = THEMES.find((t) => t.id === id);
  if (!config) return;
  document.documentElement.setAttribute("data-theme", id);
  document.documentElement.classList.toggle("dark", config.dark);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("clean-white");

  useEffect(() => {
    const stored = localStorage.getItem("mailmark-theme") as ThemeId | null;
    if (stored && THEMES.some((t) => t.id === stored)) {
      setThemeState(stored);
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "enterprise-dark" : "clean-white";
      setThemeState(initial as ThemeId);
      applyTheme(initial as ThemeId);
    }
  }, []);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    localStorage.setItem("mailmark-theme", id);
    applyTheme(id);
  }

  const isDark = THEMES.find((t) => t.id === theme)?.dark ?? false;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}
