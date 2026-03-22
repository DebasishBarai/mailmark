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

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  isDark: boolean;
  density: DensityId;
  setDensity: (id: DensityId) => void;
  wallpaper: WallpaperId;
  setWallpaper: (id: WallpaperId) => void;
}>({
  theme: "clean-white",
  setTheme: () => {},
  isDark: false,
  density: "default",
  setDensity: () => {},
  wallpaper: "none",
  setWallpaper: () => {},
});

export function useTheme() {
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

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("clean-white");
  const [density, setDensityState] = useState<DensityId>("default");
  const [wallpaper, setWallpaperState] = useState<WallpaperId>("none");

  useEffect(() => {
    // Theme
    const storedTheme = localStorage.getItem("mailmark-theme") as ThemeId | null;
    if (storedTheme && THEMES.some((t) => t.id === storedTheme)) {
      setThemeState(storedTheme);
      applyTheme(storedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "enterprise-dark" : "clean-white";
      setThemeState(initial as ThemeId);
      applyTheme(initial as ThemeId);
    }

    // Density
    const storedDensity = localStorage.getItem("mailmark-density") as DensityId | null;
    if (storedDensity && DENSITIES.some((d) => d.id === storedDensity)) {
      setDensityState(storedDensity);
      applyDensity(storedDensity);
    } else {
      applyDensity("default");
    }

    // Wallpaper
    const storedWallpaper = localStorage.getItem("mailmark-wallpaper") as WallpaperId | null;
    if (storedWallpaper && WALLPAPERS.some((w) => w.id === storedWallpaper)) {
      setWallpaperState(storedWallpaper);
      applyWallpaper(storedWallpaper);
    } else {
      applyWallpaper("none");
    }
  }, []);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    localStorage.setItem("mailmark-theme", id);
    applyTheme(id);
  }

  function setDensity(id: DensityId) {
    setDensityState(id);
    localStorage.setItem("mailmark-density", id);
    applyDensity(id);
  }

  function setWallpaper(id: WallpaperId) {
    setWallpaperState(id);
    localStorage.setItem("mailmark-wallpaper", id);
    applyWallpaper(id);
  }

  const isDark = THEMES.find((t) => t.id === theme)?.dark ?? false;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, density, setDensity, wallpaper, setWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
}
