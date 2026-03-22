"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTheme, THEMES, type ThemeId } from "./ThemeProvider";

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

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 400;
    setPos({
      top: openUp ? rect.top : rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 272), // 272 = dropdown width 264 + 8px margin
      openUp,
    });
  }, []);

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
        aria-label="Change theme"
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
            className="fixed w-64 overflow-hidden rounded-xl border shadow-xl"
            style={{
              zIndex: 9999,
              top: pos.openUp ? "auto" : `${pos.top}px`,
              bottom: pos.openUp ? `${window.innerHeight - pos.top + 8}px` : "auto",
              left: `${pos.left}px`,
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
            }}
          >
            <div className="max-h-[70vh] overflow-y-auto p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                Theme
              </p>
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
                          onClick={() => {
                            setTheme(t.id);
                            setOpen(false);
                          }}
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
                            style={{
                              backgroundColor: colors.bg,
                              borderColor: colors.fg + "33",
                            }}
                          >
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: colors.accent }}
                            />
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
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
