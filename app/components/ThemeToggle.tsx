"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useTheme,
  THEMES,
  DENSITIES,
  WALLPAPERS,
  type ThemeId,
  type DensityId,
} from "./ThemeProvider";

const THEME_PREVIEW_COLORS: Record<ThemeId, { bg: string; fg: string; accent: string }> = {
  "clean-white": { bg: "#ffffff", fg: "#111827", accent: "#7c3aed" },
  "enterprise-dark": { bg: "#0f172a", fg: "#e2e8f0", accent: "#3b82f6" },
  "notion": { bg: "#fafaf9", fg: "#37352f", accent: "#2f80ed" },
  "matrix": { bg: "#000000", fg: "#00ff9c", accent: "#00ff9c" },
  "dracula": { bg: "#282a36", fg: "#f8f8f2", accent: "#bd93f9" },
  "nord": { bg: "#2e3440", fg: "#eceff4", accent: "#88c0d0" },
  "solarized-dark": { bg: "#002b36", fg: "#839496", accent: "#268bd2" },
  "cyberpunk": { bg: "#0d0d0d", fg: "#e5e5e5", accent: "#ff0080" },
  "pastel-soft": { bg: "#fff7f7", fg: "#4b5563", accent: "#f472b6" },
  "retro-90s": { bg: "#c0c0c0", fg: "#000000", accent: "#0000ff" },
  "high-contrast": { bg: "#000000", fg: "#ffffff", accent: "#ffd700" },
};

type Tab = "theme" | "density" | "wallpaper";

export default function ThemeToggle() {
  const { theme, setTheme, density, setDensity, wallpaper, setWallpaper } = useTheme();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("theme");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 500;
    setPos({
      top: openUp ? rect.top : rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 308),
      openUp,
    });
  }, []);

  // Scroll to active theme when opening
  useEffect(() => {
    if (!open || tab !== "theme") return;
    requestAnimationFrame(() => {
      const active = scrollRef.current?.querySelector("[data-active-theme]");
      if (active) active.scrollIntoView({ block: "center", behavior: "instant" });
    });
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleClick(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const groups = Array.from(new Set(THEMES.map((t) => t.group)));

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        aria-label="Appearance settings"
        className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          color: "var(--foreground)",
        }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-[300px] overflow-hidden rounded-xl border shadow-xl"
            style={{
              zIndex: 9999,
              top: pos.openUp ? "auto" : `${pos.top}px`,
              bottom: pos.openUp ? `${window.innerHeight - pos.top + 8}px` : "auto",
              left: `${pos.left}px`,
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
            }}
          >
            {/* Tabs */}
            <div
              className="flex border-b"
              style={{ borderColor: "var(--border)" }}
            >
              {([
                { id: "theme" as Tab, label: "Theme", icon: <ThemeIcon /> },
                { id: "density" as Tab, label: "Density", icon: <DensityIcon /> },
                { id: "wallpaper" as Tab, label: "Wallpaper", icon: <WallpaperIcon /> },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors"
                  style={{
                    color: tab === t.id ? "var(--accent)" : "var(--muted)",
                    borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-3" style={{ scrollbarWidth: "none" }}>
              {/* Theme tab */}
              {tab === "theme" && (
                <>
                  {groups.map((group) => (
                    <div key={group} className="mb-2">
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                        {group}
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {THEMES.filter((t) => t.group === group).map((t) => {
                          const colors = THEME_PREVIEW_COLORS[t.id];
                          const isActive = theme === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setTheme(t.id)}
                              {...(isActive ? { "data-active-theme": "" } : {})}
                              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors"
                              style={{
                                backgroundColor: isActive ? "var(--surface)" : "transparent",
                                color: "var(--foreground)",
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <div
                                className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border"
                                style={{ backgroundColor: colors.bg, borderColor: colors.fg + "33" }}
                              >
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
                              </div>
                              <span className="flex-1 truncate font-medium">{t.name}</span>
                              {isActive && (
                                <svg className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Density tab */}
              {tab === "density" && (
                <div className="space-y-2">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    UI Density
                  </p>
                  {DENSITIES.map((d) => {
                    const isActive = density === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setDensity(d.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                        style={{
                          backgroundColor: isActive ? "var(--surface)" : "transparent",
                          color: "var(--foreground)",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <DensityPreview mode={d.id} isActive={isActive} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{d.name}</p>
                          <p className="text-xs" style={{ color: "var(--muted)" }}>
                            {d.id === "compact" && "Tighter spacing, smaller text"}
                            {d.id === "default" && "Balanced spacing and text"}
                            {d.id === "comfortable" && "More breathing room"}
                          </p>
                        </div>
                        {isActive && (
                          <svg className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    );
                  })}

                  {/* Live density preview */}
                  <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                      Preview
                    </p>
                    <div className="space-y-0">
                      {["Inbox — Meeting tomorrow", "Sent — Re: Project update", "Draft — Newsletter v2"].map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between border-b transition-all"
                          style={{
                            borderColor: "var(--border)",
                            padding: `var(--density-row-py) var(--density-px)`,
                            fontSize: "var(--density-text-sm)",
                          }}
                        >
                          <span style={{ color: "var(--foreground)" }}>{item}</span>
                          <span style={{ color: "var(--muted)", fontSize: "var(--density-text-sm)" }}>2m</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Wallpaper tab */}
              {tab === "wallpaper" && (
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    Background Wallpaper
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {WALLPAPERS.map((w) => {
                      const isActive = wallpaper === w.id;
                      return (
                        <button
                          key={w.id}
                          onClick={() => setWallpaper(w.id)}
                          className="flex flex-col items-center gap-1.5 rounded-lg p-1.5 transition-colors"
                          style={{
                            border: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                            backgroundColor: isActive ? "var(--surface)" : "transparent",
                          }}
                        >
                          {w.id === "none" ? (
                            <div
                              className="flex h-14 w-full items-center justify-center rounded-md"
                              style={{
                                backgroundColor: "var(--surface)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <svg className="h-5 w-5" style={{ color: "var(--muted)" }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </div>
                          ) : (
                            <img
                              src={w.thumb}
                              alt={w.name}
                              className="h-14 w-full rounded-md object-cover"
                              loading="lazy"
                            />
                          )}
                          <span className="text-[10px] font-medium" style={{ color: isActive ? "var(--accent)" : "var(--muted)" }}>
                            {w.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[10px]" style={{ color: "var(--muted)" }}>
                    Wallpaper shows as a subtle overlay on the main content area.
                  </p>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function ThemeIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197" />
    </svg>
  );
}

function DensityIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function WallpaperIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M2.25 18V6a2.25 2.25 0 0 1 2.25-2.25h15A2.25 2.25 0 0 1 21.75 6v12A2.25 2.25 0 0 1 19.5 20.25h-15A2.25 2.25 0 0 1 2.25 18Z" />
    </svg>
  );
}

function DensityPreview({ mode, isActive }: { mode: DensityId; isActive: boolean }) {
  const gaps = { compact: 1, default: 2, comfortable: 3 };
  const gap = gaps[mode];
  return (
    <div
      className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md"
      style={{
        backgroundColor: isActive ? "var(--accent)" : "var(--surface-hover)",
        gap: `${gap}px`,
      }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            width: "16px",
            height: mode === "compact" ? "2px" : mode === "comfortable" ? "4px" : "3px",
            backgroundColor: isActive ? "var(--accent-text)" : "var(--muted)",
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

