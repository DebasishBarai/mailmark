"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

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

export const DENSITIES = [
  { id: "compact", name: "Compact", icon: "compact" },
  { id: "default", name: "Default", icon: "default" },
  { id: "comfortable", name: "Comfortable", icon: "comfortable" },
] as const;

export type DensityId = (typeof DENSITIES)[number]["id"];

export const WALLPAPERS = [
  { id: "none", name: "None", url: "", thumb: "" },
  { id: "earth", name: "Earth", url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120&q=60" },
  { id: "mountains", name: "Mountains", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&q=60" },
  { id: "ocean", name: "Ocean", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=120&q=60" },
  { id: "forest", name: "Forest", url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=120&q=60" },
  { id: "aurora", name: "Aurora", url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=120&q=60" },
  { id: "desert", name: "Desert", url: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=120&q=60" },
  { id: "sunset", name: "Sunset", url: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=120&q=60" },
  { id: "rocks", name: "Rocks", url: "https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=120&q=60" },
  { id: "snow", name: "Snow", url: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=120&q=60" },
  { id: "flowers", name: "Flowers", url: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=120&q=60" },
  { id: "city", name: "City Night", url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80", thumb: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=120&q=60" },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];

type SaveToDbFn = (prefs: { prefTheme?: string; prefDensity?: string; prefWallpaper?: string }) => void;

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  isDark: boolean;
  density: DensityId;
  setDensity: (id: DensityId) => void;
  wallpaper: WallpaperId;
  setWallpaper: (id: WallpaperId) => void;
  _applyFromDb: (prefs: { prefTheme?: string; prefDensity?: string; prefWallpaper?: string }) => void;
  _setSaveToDb: (fn: SaveToDbFn) => void;
}>({
  theme: "clean-white",
  setTheme: () => {},
  isDark: false,
  density: "default",
  setDensity: () => {},
  wallpaper: "none",
  setWallpaper: () => {},
  _applyFromDb: () => {},
  _setSaveToDb: () => {},
});

export function useTheme() {
  const { _applyFromDb, _setSaveToDb, ...rest } = useContext(ThemeContext);
  return rest;
}

// Internal hook used only by PreferenceSync
export function useThemeInternal() {
  return useContext(ThemeContext);
}

function applyTheme(id: ThemeId) {
  const config = THEMES.find((t) => t.id === id);
  if (!config) return;
  document.documentElement.setAttribute("data-theme", id);
  document.documentElement.classList.toggle("dark", config.dark);
}

function applyDensity(id: DensityId) {
  document.documentElement.setAttribute("data-density", id);
}

function applyWallpaper(id: WallpaperId) {
  document.documentElement.setAttribute("data-wallpaper", id);
  const wp = WALLPAPERS.find((w) => w.id === id);
  if (wp && wp.url) {
    document.documentElement.style.setProperty("--wallpaper-url", `url(${wp.url})`);
  } else {
    document.documentElement.style.removeProperty("--wallpaper-url");
  }
}

export function isValidTheme(id: string): id is ThemeId {
  return THEMES.some((t) => t.id === id);
}
export function isValidDensity(id: string): id is DensityId {
  return DENSITIES.some((d) => d.id === id);
}
export function isValidWallpaper(id: string): id is WallpaperId {
  return WALLPAPERS.some((w) => w.id === id);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("clean-white");
  const [density, setDensityState] = useState<DensityId>("default");
  const [wallpaper, setWallpaperState] = useState<WallpaperId>("none");
  const saveToDbRef = useRef<SaveToDbFn | null>(null);

  // On mount: apply from localStorage immediately (no flash)
  useEffect(() => {
    const storedTheme = localStorage.getItem("mailmark-theme");
    const storedDensity = localStorage.getItem("mailmark-density");
    const storedWallpaper = localStorage.getItem("mailmark-wallpaper");

    const t = storedTheme && isValidTheme(storedTheme) ? storedTheme : (
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "enterprise-dark" as ThemeId : "clean-white" as ThemeId
    );
    const d = storedDensity && isValidDensity(storedDensity) ? storedDensity : "default" as DensityId;
    const w = storedWallpaper && isValidWallpaper(storedWallpaper) ? storedWallpaper : "none" as WallpaperId;

    setThemeState(t);
    setDensityState(d);
    setWallpaperState(w);
    applyTheme(t);
    applyDensity(d);
    applyWallpaper(w);
  }, []);

  // Called by PreferenceSync when DB user data loads
  const _applyFromDb = useCallback((prefs: { prefTheme?: string; prefDensity?: string; prefWallpaper?: string }) => {
    if (prefs.prefTheme && isValidTheme(prefs.prefTheme)) {
      setThemeState(prefs.prefTheme);
      applyTheme(prefs.prefTheme);
      localStorage.setItem("mailmark-theme", prefs.prefTheme);
    }
    if (prefs.prefDensity && isValidDensity(prefs.prefDensity)) {
      setDensityState(prefs.prefDensity);
      applyDensity(prefs.prefDensity);
      localStorage.setItem("mailmark-density", prefs.prefDensity);
    }
    if (prefs.prefWallpaper && isValidWallpaper(prefs.prefWallpaper)) {
      setWallpaperState(prefs.prefWallpaper);
      applyWallpaper(prefs.prefWallpaper);
      localStorage.setItem("mailmark-wallpaper", prefs.prefWallpaper);
    }
  }, []);

  const _setSaveToDb = useCallback((fn: SaveToDbFn) => {
    saveToDbRef.current = fn;
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    localStorage.setItem("mailmark-theme", id);
    applyTheme(id);
    saveToDbRef.current?.({ prefTheme: id });
  }, []);

  const setDensity = useCallback((id: DensityId) => {
    setDensityState(id);
    localStorage.setItem("mailmark-density", id);
    applyDensity(id);
    saveToDbRef.current?.({ prefDensity: id });
  }, []);

  const setWallpaper = useCallback((id: WallpaperId) => {
    setWallpaperState(id);
    localStorage.setItem("mailmark-wallpaper", id);
    applyWallpaper(id);
    saveToDbRef.current?.({ prefWallpaper: id });
  }, []);

  const isDark = THEMES.find((t) => t.id === theme)?.dark ?? false;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, density, setDensity, wallpaper, setWallpaper, _applyFromDb, _setSaveToDb }}>
      {children}
    </ThemeContext.Provider>
  );
}
