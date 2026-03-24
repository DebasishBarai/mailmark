import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Img,
} from "remotion";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  violet50: "#f5f3ff",
  violet100: "#ede9fe",
  violet300: "#c4b5fd",
  violet400: "#a78bfa",
  violet500: "#8b5cf6",
  violet600: "#7c3aed",
  violet700: "#6d28d9",
  violet800: "#5b21b6",
  violet900: "#4c1d95",
  violet950: "#1e1b4b",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray300: "#d1d5db",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray600: "#4b5563",
  gray700: "#374151",
  gray800: "#1f2937",
  gray900: "#111827",
  green400: "#4ade80",
  green500: "#22c55e",
  white: "#ffffff",
  black: "#000000",
};

const font =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Theme color palettes ─────────────────────────────────────────────────────
type ThemeColors = {
  name: string;
  sceneBg: string;
  shellBg: string;
  chromeBg: string;
  sidebarBg: string;
  mainBg: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  rowBg: string;
  isDark: boolean;
};

const themes: Record<string, ThemeColors> = {
  "clean-white": {
    name: "Clean White",
    sceneBg: "#ffffff",
    shellBg: "#ffffff",
    chromeBg: "#f1f5f9",
    sidebarBg: "#f8fafc",
    mainBg: "#ffffff",
    border: "rgba(0,0,0,0.08)",
    text: "#0f172a",
    textSub: "#475569",
    textMuted: "#94a3b8",
    accent: C.violet600,
    accentBg: C.violet50,
    rowBg: "rgba(0,0,0,0.02)",
    isDark: false,
  },
  dracula: {
    name: "Dracula",
    sceneBg: "#282a36",
    shellBg: "#282a36",
    chromeBg: "#21222c",
    sidebarBg: "#21222c",
    mainBg: "#282a36",
    border: "rgba(98,114,164,0.3)",
    text: "#f8f8f2",
    textSub: "#bd93f9",
    textMuted: "#6272a4",
    accent: "#ff79c6",
    accentBg: "rgba(255,121,198,0.15)",
    rowBg: "rgba(255,255,255,0.03)",
    isDark: true,
  },
  matrix: {
    name: "Matrix Mode",
    sceneBg: "#0a0a0a",
    shellBg: "#0a0a0a",
    chromeBg: "#050505",
    sidebarBg: "#050505",
    mainBg: "#0a0a0a",
    border: "rgba(0,255,65,0.15)",
    text: "#00ff41",
    textSub: "#00cc33",
    textMuted: "#006600",
    accent: "#00ff41",
    accentBg: "rgba(0,255,65,0.1)",
    rowBg: "rgba(0,255,65,0.03)",
    isDark: true,
  },
  cyberpunk: {
    name: "Cyberpunk",
    sceneBg: "#0d0221",
    shellBg: "#0d0221",
    chromeBg: "#1a0533",
    sidebarBg: "#1a0533",
    mainBg: "#0d0221",
    border: "rgba(255,0,255,0.2)",
    text: "#e0e0ff",
    textSub: "#ff00ff",
    textMuted: "#6b3fa0",
    accent: "#ff00ff",
    accentBg: "rgba(255,0,255,0.12)",
    rowBg: "rgba(255,0,255,0.04)",
    isDark: true,
  },
  nord: {
    name: "Nord",
    sceneBg: "#2e3440",
    shellBg: "#2e3440",
    chromeBg: "#3b4252",
    sidebarBg: "#3b4252",
    mainBg: "#2e3440",
    border: "rgba(216,222,233,0.1)",
    text: "#eceff4",
    textSub: "#88c0d0",
    textMuted: "#4c566a",
    accent: "#88c0d0",
    accentBg: "rgba(136,192,208,0.12)",
    rowBg: "rgba(255,255,255,0.02)",
    isDark: true,
  },
  "retro-90s": {
    name: "Retro 90s",
    sceneBg: "#c0c0c0",
    shellBg: "#c0c0c0",
    chromeBg: "#0000aa",
    sidebarBg: "#d4d0c8",
    mainBg: "#ffffff",
    border: "#808080",
    text: "#000000",
    textSub: "#0000aa",
    textMuted: "#808080",
    accent: "#0000aa",
    accentBg: "#d4d0c8",
    rowBg: "rgba(0,0,0,0.05)",
    isDark: false,
  },
  "high-contrast": {
    name: "High Contrast",
    sceneBg: "#000000",
    shellBg: "#000000",
    chromeBg: "#1a1a1a",
    sidebarBg: "#1a1a1a",
    mainBg: "#000000",
    border: "#ffffff",
    text: "#ffffff",
    textSub: "#ffff00",
    textMuted: "#cccccc",
    accent: "#ffff00",
    accentBg: "rgba(255,255,0,0.1)",
    rowBg: "rgba(255,255,255,0.05)",
    isDark: true,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sp(
  frame: number,
  delay: number,
  fps: number,
  damping = 14,
  stiffness = 110
) {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping, stiffness, mass: 0.8 },
  });
}
function fadeIn(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
function slideUp(
  frame: number,
  start: number,
  end: number,
  distance = 30
) {
  return interpolate(frame, [start, end], [distance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function MailmarkLogo({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id="pgrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <clipPath id="penvClip">
          <rect x="4" y="16" width="66" height="50" rx="8" />
        </clipPath>
      </defs>
      <rect
        x="4"
        y="16"
        width="66"
        height="50"
        rx="8"
        fill="none"
        stroke="url(#pgrad)"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <line
        x1="4"
        y1="16"
        x2="37"
        y2="44"
        stroke="url(#pgrad)"
        strokeWidth="7"
        strokeLinecap="round"
        clipPath="url(#penvClip)"
      />
      <line
        x1="70"
        y1="16"
        x2="37"
        y2="44"
        stroke="url(#pgrad)"
        strokeWidth="7"
        strokeLinecap="round"
        clipPath="url(#penvClip)"
      />
      <circle cx="67" cy="62" r="18" fill="url(#pgrad)" />
      <polyline
        points="58,62 65,69 77,53"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Mini Dashboard Shell ─────────────────────────────────────────────────────
function MiniShell({
  themeColors,
  scale = 1,
  opacity = 1,
  wallpaperUrl,
  densityScale = 1,
}: {
  themeColors: ThemeColors;
  scale?: number;
  opacity?: number;
  wallpaperUrl?: string;
  densityScale?: number;
}) {
  const t = themeColors;
  const py = 8 * densityScale;
  const gap = 4 * densityScale;
  const fontSize = 12 * densityScale;
  const navItems = ["Dashboard", "Domains", "Developer", "Billing"];
  const emails = [
    {
      from: "Sarah Chen",
      subject: "Q3 Report finalized",
      time: "10:32 AM",
      read: false,
    },
    {
      from: "Mike Johnson",
      subject: "Re: Meeting tomorrow",
      time: "9:15 AM",
      read: true,
    },
    {
      from: "Team Updates",
      subject: "Sprint review notes",
      time: "Yesterday",
      read: true,
    },
    {
      from: "AWS SES",
      subject: "Domain verification complete",
      time: "Yesterday",
      read: true,
    },
  ];

  return (
    <div
      style={{
        width: 580,
        height: 360,
        transform: `scale(${scale})`,
        opacity,
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: t.shellBg,
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        position: "relative",
        fontFamily: font,
      }}
    >
      {/* Wallpaper overlay */}
      {wallpaperUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
          }}
        >
          <Img
            src={wallpaperUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: t.isDark ? 0.35 : 0.45,
            }}
          />
        </div>
      )}

      {/* Browser chrome */}
      <div
        style={{
          height: 32,
          background: t.chromeBg,
          borderBottom: `1px solid ${t.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 6,
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#ff5f57",
          }}
        />
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#ffbd2e",
          }}
        />
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "#28c840",
          }}
        />
        <div
          style={{
            marginLeft: 12,
            background: t.isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.06)",
            borderRadius: 4,
            padding: "2px 10px",
            fontSize: 10,
            color: t.textMuted,
          }}
        >
          mailmark.dev/mailbox
        </div>
      </div>

      {/* App layout */}
      <div
        style={{ display: "flex", flex: 1, overflow: "hidden", zIndex: 1 }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: 150,
            background: wallpaperUrl
              ? t.isDark
                ? "rgba(0,0,0,0.6)"
                : "rgba(255,255,255,0.85)"
              : t.sidebarBg,
            borderRight: `1px solid ${t.border}`,
            padding: `${py * 1.5}px 8px`,
            display: "flex",
            flexDirection: "column",
            gap,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: `0 6px ${py}px`,
              marginBottom: 2,
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <MailmarkLogo size={20} />
            <span
              style={{ fontSize: 12, fontWeight: 700, color: t.text }}
            >
              Mailmark
            </span>
          </div>
          {navItems.map((item, i) => {
            const active = item === "Dashboard";
            return (
              <div
                key={item}
                style={{
                  padding: `${py * 0.6}px 8px`,
                  borderRadius: 6,
                  fontSize: fontSize * 0.9,
                  fontWeight: active ? 600 : 400,
                  color: active ? t.accent : t.textMuted,
                  background: active ? t.accentBg : "transparent",
                }}
              >
                {item}
              </div>
            );
          })}
        </div>

        {/* Main content - email list */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            background: wallpaperUrl
              ? t.isDark
                ? "rgba(0,0,0,0.5)"
                : "rgba(255,255,255,0.8)"
              : t.mainBg,
            padding: `${py}px`,
          }}
        >
          <div
            style={{
              fontSize: fontSize * 1.1,
              fontWeight: 700,
              color: t.text,
              padding: `${py * 0.5}px ${py}px`,
              marginBottom: py * 0.5,
            }}
          >
            Inbox
          </div>
          {emails.map((email, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: `${py}px ${py}px`,
                borderBottom: `1px solid ${t.border}`,
                gap: py,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: email.read ? "transparent" : t.accent,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize,
                    fontWeight: email.read ? 400 : 600,
                    color: t.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {email.from}
                </div>
                <div
                  style={{
                    fontSize: fontSize * 0.85,
                    color: t.textMuted,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: 1,
                  }}
                >
                  {email.subject}
                </div>
              </div>
              <div
                style={{
                  fontSize: fontSize * 0.75,
                  color: t.textMuted,
                  flexShrink: 0,
                }}
              >
                {email.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 1 - Intro (0-90)
// ════════════════════════════════════════════════════════════════════════════════
function SceneIntro({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";
  const s = sp(frame, 0, fps, 14, 90);
  const op = fadeIn(frame, 0, 20);
  const scale = interpolate(s, [0, 1], [0.85, 1]);
  const titleOp = fadeIn(frame, 20, 40);
  const titleY = slideUp(frame, 20, 40, 20);
  const subOp = fadeIn(frame, 35, 55);
  const subY = slideUp(frame, 35, 55, 14);

  const bg = isLight
    ? "radial-gradient(ellipse 90% 80% at 50% 50%, #ede9fe 0%, #f5f3ff 50%, #ffffff 100%)"
    : "radial-gradient(ellipse 90% 80% at 50% 50%, #1e1b4b 0%, #050510 100%)";
  const ringColor = isLight ? "rgba(139,92,246,0.1)" : "rgba(124,58,237,0.1)";
  const titleColor = isLight ? C.gray900 : C.white;
  const subColor = isLight ? C.gray500 : C.gray400;

  return (
    <AbsoluteFill
      style={{
        background: bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
      }}
    >
      {/* Glow rings */}
      {[400, 560, 720].map((size) => (
        <div
          key={size}
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            border: `1px solid ${ringColor}`,
            pointerEvents: "none",
            opacity: subOp,
          }}
        />
      ))}

      <div
        style={{
          opacity: op,
          transform: `scale(${scale})`,
          filter: "drop-shadow(0 8px 40px rgba(139,92,246,0.4))",
          marginBottom: 20,
        }}
      >
        <MailmarkLogo size={80} />
      </div>
      <div
        style={{
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          fontSize: 44,
          fontWeight: 900,
          color: titleColor,
          textAlign: "center",
          letterSpacing: "-1.5px",
          lineHeight: 1.2,
        }}
      >
        Make it <span style={{ color: C.violet400 }}>yours</span>
      </div>
      <div
        style={{
          opacity: subOp,
          transform: `translateY(${subY}px)`,
          fontSize: 18,
          color: subColor,
          marginTop: 12,
          textAlign: "center",
        }}
      >
        Personalize your Mailmark experience
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 2 - Theme Showcase (90-480)
// Cycles through themes with animated transitions
// ════════════════════════════════════════════════════════════════════════════════
function SceneThemes({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";

  const themeOrder: (keyof typeof themes)[] = [
    "clean-white",
    "dracula",
    "matrix",
    "cyberpunk",
    "nord",
    "retro-90s",
    "high-contrast",
  ];
  const framesPerTheme = 50;
  const transitionFrames = 15;

  // Title animation
  const titleOp = fadeIn(frame, 0, 18);
  const titleY = slideUp(frame, 0, 18, 20);

  // Determine current and next theme
  const themeFrame = Math.max(0, frame - 30); // 30 frames for title
  const rawIndex = Math.floor(themeFrame / framesPerTheme);
  const currentIndex = Math.min(rawIndex, themeOrder.length - 1);
  const nextIndex = Math.min(currentIndex + 1, themeOrder.length - 1);
  const progress = (themeFrame % framesPerTheme) / framesPerTheme;

  const currentTheme = themes[themeOrder[currentIndex]];
  const nextTheme = themes[themeOrder[nextIndex]];

  // Cross-fade between themes
  const inTransition =
    progress > 1 - transitionFrames / framesPerTheme &&
    currentIndex < themeOrder.length - 1;
  const transitionProgress = inTransition
    ? (progress - (1 - transitionFrames / framesPerTheme)) /
      (transitionFrames / framesPerTheme)
    : 0;

  // Shell entrance
  const shellS = sp(frame, 20, fps, 13, 95);
  const shellOp = fadeIn(frame, 20, 40);
  const shellScale = interpolate(shellS, [0, 1], [0.9, 1]);

  // Theme name label
  const labelTheme =
    inTransition && transitionProgress > 0.5 ? nextTheme : currentTheme;

  // Label badge animation
  const labelPulse = sp(
    frame,
    30 + currentIndex * framesPerTheme,
    fps,
    12,
    130
  );
  const labelScale = interpolate(labelPulse, [0, 1], [0.8, 1]);

  return (
    <AbsoluteFill
      style={{
        background: isLight
          ? "linear-gradient(160deg, #f0f4ff 0%, #ffffff 100%)"
          : `linear-gradient(160deg, ${C.violet950} 0%, ${C.gray900} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 40,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isLight ? C.violet600 : C.violet400,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          11 Themes
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: isLight ? C.gray900 : C.white,
            letterSpacing: "-0.5px",
          }}
        >
          Choose your style
        </div>
      </div>

      {/* Dashboard preview */}
      <div
        style={{
          marginTop: 20,
          position: "relative",
          transform: `scale(${shellScale})`,
          opacity: shellOp,
        }}
      >
        {/* Current theme shell */}
        <div style={{ opacity: inTransition ? 1 - transitionProgress : 1 }}>
          <MiniShell themeColors={currentTheme} />
        </div>

        {/* Next theme shell (cross-fade) */}
        {inTransition && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              opacity: transitionProgress,
            }}
          >
            <MiniShell themeColors={nextTheme} />
          </div>
        )}

        {/* Theme name badge */}
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: "50%",
            transform: `translateX(-50%) scale(${labelScale})`,
            background: labelTheme.accent,
            color: labelTheme.isDark ? C.white : C.black,
            fontSize: 14,
            fontWeight: 800,
            padding: "6px 20px",
            borderRadius: 99,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            whiteSpace: "nowrap",
          }}
        >
          {labelTheme.name}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 3 - Wallpapers (480-750)
// ════════════════════════════════════════════════════════════════════════════════
function SceneWallpapers({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";

  const wallpapers = [
    {
      name: "Earth",
      url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=70",
    },
    {
      name: "Mountains",
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=70",
    },
    {
      name: "Aurora",
      url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=70",
    },
    {
      name: "Ocean",
      url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70",
    },
  ];

  const framesPerWallpaper = 60;
  const wpIndex = Math.min(
    Math.floor(Math.max(0, frame - 40) / framesPerWallpaper),
    wallpapers.length - 1
  );

  const titleOp = fadeIn(frame, 0, 18);
  const titleY = slideUp(frame, 0, 18, 20);
  const shellS = sp(frame, 20, fps, 13, 95);
  const shellOp = fadeIn(frame, 20, 40);
  const shellScale = interpolate(shellS, [0, 1], [0.9, 1]);

  // Thumbnail strip
  const stripOp = fadeIn(frame, 30, 48);

  return (
    <AbsoluteFill
      style={{
        background: isLight
          ? "linear-gradient(160deg, #f0f4ff 0%, #ffffff 100%)"
          : `linear-gradient(160deg, #0d0d1a 0%, ${C.gray900} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 40,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isLight ? C.violet600 : C.violet400,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Background Wallpapers
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: isLight ? C.gray900 : C.white,
            letterSpacing: "-0.5px",
          }}
        >
          Set the mood
        </div>
      </div>

      {/* Dashboard with wallpaper */}
      <div
        style={{
          marginTop: 10,
          transform: `scale(${shellScale})`,
          opacity: shellOp,
        }}
      >
        <MiniShell
          themeColors={themes["clean-white"]}
          wallpaperUrl={wallpapers[wpIndex].url}
        />
      </div>

      {/* Wallpaper thumbnail strip */}
      <div
        style={{
          position: "absolute",
          bottom: 44,
          display: "flex",
          gap: 12,
          opacity: stripOp,
        }}
      >
        {wallpapers.map((wp, i) => {
          const active = i === wpIndex;
          return (
            <div
              key={wp.name}
              style={{
                width: 80,
                height: 50,
                borderRadius: 8,
                overflow: "hidden",
                border: active
                  ? `2px solid ${C.violet500}`
                  : "2px solid transparent",
                opacity: active ? 1 : 0.5,
                transition: "all 0.3s",
                position: "relative",
              }}
            >
              <Img
                src={wp.url}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  fontSize: 8,
                  fontWeight: 700,
                  color: C.white,
                  background: "rgba(0,0,0,0.6)",
                  padding: "2px 4px",
                  textAlign: "center",
                }}
              >
                {wp.name}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 4 - UI Density (750-990)
// ════════════════════════════════════════════════════════════════════════════════
function SceneDensity({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";

  const densities = [
    { name: "Compact", scale: 0.75 },
    { name: "Default", scale: 1 },
    { name: "Comfortable", scale: 1.25 },
  ];

  const framesPerDensity = 65;
  const dIndex = Math.min(
    Math.floor(Math.max(0, frame - 40) / framesPerDensity),
    densities.length - 1
  );

  const titleOp = fadeIn(frame, 0, 18);
  const titleY = slideUp(frame, 0, 18, 20);

  return (
    <AbsoluteFill
      style={{
        background: isLight
          ? "linear-gradient(160deg, #f0f4ff 0%, #ffffff 100%)"
          : `linear-gradient(160deg, ${C.violet950} 0%, ${C.gray900} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 40,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isLight ? C.violet600 : C.violet400,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          UI Density
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: isLight ? C.gray900 : C.white,
            letterSpacing: "-0.5px",
          }}
        >
          Your space, your way
        </div>
      </div>

      {/* Three density previews side by side */}
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "flex-end",
          marginTop: 20,
        }}
      >
        {densities.map((d, i) => {
          const delay = i * 20 + 30;
          const s = sp(frame, delay, fps, 13, 95);
          const op = fadeIn(frame, delay, delay + 18);
          const yOffset = interpolate(s, [0, 1], [40, 0]);
          const active = i === dIndex;

          return (
            <div
              key={d.name}
              style={{
                opacity: op,
                transform: `translateY(${yOffset}px) scale(0.48)`,
                transformOrigin: "bottom center",
                position: "relative",
              }}
            >
              <div
                style={{
                  border: active
                    ? `3px solid ${C.violet500}`
                    : "3px solid transparent",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <MiniShell
                  themeColors={themes["dracula"]}
                  densityScale={d.scale}
                />
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 14,
                  fontSize: 26,
                  fontWeight: active ? 800 : 500,
                  color: active ? (isLight ? C.violet600 : C.violet400) : C.gray500,
                }}
              >
                {d.name}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 5 - Signature Editor (990-1200)
// ════════════════════════════════════════════════════════════════════════════════
function SceneSignature({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";

  const titleOp = fadeIn(frame, 0, 18);
  const titleY = slideUp(frame, 0, 18, 20);

  // Modal animation
  const modalS = sp(frame, 30, fps, 14, 100);
  const modalOp = fadeIn(frame, 30, 48);
  const modalScale = interpolate(modalS, [0, 1], [0.85, 1]);

  // Template buttons appear
  const tmplOp = fadeIn(frame, 55, 70);

  // Preview appears
  const previewOp = fadeIn(frame, 80, 95);

  // Checkmark
  const checkOp = fadeIn(frame, 130, 145);
  const checkS = sp(frame, 130, fps, 12, 130);
  const checkScale = interpolate(checkS, [0, 1], [0.5, 1]);

  return (
    <AbsoluteFill
      style={{
        background: isLight
          ? "linear-gradient(160deg, #f0f4ff 0%, #ffffff 100%)"
          : `linear-gradient(160deg, #0d0d1a 0%, ${C.gray900} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 40,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isLight ? C.violet600 : C.violet400,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Signature Editor
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: isLight ? C.gray900 : C.white,
            letterSpacing: "-0.5px",
          }}
        >
          Professional signatures
        </div>
      </div>

      {/* Modal */}
      <div
        style={{
          opacity: modalOp,
          transform: `scale(${modalScale})`,
          width: 640,
          background: isLight ? C.white : C.gray800,
          borderRadius: 16,
          border: isLight ? "1px solid rgba(0,0,0,0.1)" : `1px solid rgba(255,255,255,0.08)`,
          boxShadow: isLight ? "0 25px 60px rgba(0,0,0,0.12)" : "0 25px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
          marginTop: 30,
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : `1px solid rgba(255,255,255,0.06)`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{ fontSize: 15, fontWeight: 700, color: isLight ? C.gray900 : C.white }}
          >
            Edit Signature
          </span>
          <span style={{ fontSize: 18, color: C.gray500 }}>×</span>
        </div>

        {/* Templates row */}
        <div
          style={{
            padding: "12px 20px",
            display: "flex",
            gap: 8,
            opacity: tmplOp,
          }}
        >
          {["Minimal", "Professional", "Corporate"].map((name, i) => (
            <div
              key={name}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background:
                  i === 1
                    ? C.violet600
                    : isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                color: i === 1 ? C.white : isLight ? C.gray600 : C.gray400,
                border:
                  i === 1
                    ? "none"
                    : isLight ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Formatting toolbar */}
        <div
          style={{
            padding: "6px 20px",
            display: "flex",
            gap: 4,
            borderBottom: isLight ? "1px solid rgba(0,0,0,0.08)" : `1px solid rgba(255,255,255,0.06)`,
            opacity: tmplOp,
          }}
        >
          {["B", "I", "🔗", "―"].map((icon) => (
            <div
              key={icon}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: isLight ? C.gray600 : C.gray400,
                fontWeight: icon === "B" ? 800 : 400,
                fontStyle: icon === "I" ? "italic" : "normal",
              }}
            >
              {icon}
            </div>
          ))}
        </div>

        {/* Editor + Preview */}
        <div
          style={{
            display: "flex",
            height: 160,
          }}
        >
          {/* Editor */}
          <div
            style={{
              flex: 1,
              padding: "14px 20px",
              borderRight: isLight ? "1px solid rgba(0,0,0,0.08)" : `1px solid rgba(255,255,255,0.06)`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: isLight ? C.gray700 : C.gray300,
                lineHeight: 1.7,
                fontFamily: "monospace",
              }}
            >
              **Sarah Chen**
              <br />
              Head of Product · Mailmark
              <br />
              sarah@mailmark.dev
              <br />
              <span style={{ color: C.gray500 }}>---</span>
              <br />
              <span style={{ color: isLight ? C.violet600 : C.violet400 }}>
                mailmark.dev
              </span>
            </div>
          </div>

          {/* Preview */}
          <div
            style={{
              flex: 1,
              padding: "14px 20px",
              opacity: previewOp,
              background: isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.02)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.gray500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Preview
            </div>
            <div style={{ fontSize: 12, color: isLight ? C.gray900 : C.white, lineHeight: 1.6 }}>
              <strong>Sarah Chen</strong>
              <br />
              <span style={{ color: isLight ? C.gray600 : C.gray300 }}>
                Head of Product · Mailmark
              </span>
              <br />
              <span style={{ color: isLight ? C.violet600 : C.violet400 }}>
                sarah@mailmark.dev
              </span>
              <br />
              <div
                style={{
                  height: 1,
                  background: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                  margin: "6px 0",
                  width: 80,
                }}
              />
              <span style={{ color: isLight ? C.violet600 : C.violet400, fontSize: 11 }}>
                mailmark.dev
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: isLight ? "1px solid rgba(0,0,0,0.08)" : `1px solid rgba(255,255,255,0.06)`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: 12,
              color: isLight ? C.gray600 : C.gray400,
              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
            }}
          >
            Cancel
          </div>
          <div
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              color: C.white,
              background: C.violet600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Save
            {frame >= 130 && (
              <span
                style={{
                  opacity: checkOp,
                  transform: `scale(${checkScale})`,
                  display: "inline-block",
                }}
              >
                ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 6 - CTA (1200-1350)
// ════════════════════════════════════════════════════════════════════════════════
function SceneCTA({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";
  const s = sp(frame, 0, fps, 14, 90);
  const op = fadeIn(frame, 0, 20);
  const scale = interpolate(s, [0, 1], [0.88, 1]);
  const subOp = fadeIn(frame, 18, 36);
  const subY = slideUp(frame, 18, 36, 14);
  const btnOp = fadeIn(frame, 30, 48);
  const urlOp = fadeIn(frame, 44, 60);
  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const bg = isLight
    ? "radial-gradient(ellipse 90% 80% at 50% 50%, #ede9fe 0%, #f5f3ff 50%, #ffffff 100%)"
    : "radial-gradient(ellipse 90% 80% at 50% 50%, #1e1b4b 0%, #050510 100%)";
  const glowColor = isLight
    ? "radial-gradient(ellipse, rgba(139,92,246,0.18), transparent 70%)"
    : "radial-gradient(ellipse, rgba(124,58,237,0.28), transparent 70%)";
  const ringColor = isLight ? "rgba(139,92,246,0.1)" : "rgba(124,58,237,0.1)";
  const titleColor = isLight ? C.gray900 : C.white;
  const accentColor = isLight ? C.violet600 : C.violet400;
  const subColor = isLight ? C.gray500 : C.gray400;

  return (
    <AbsoluteFill
      style={{
        background: bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 400,
          borderRadius: "50%",
          background: glowColor,
          pointerEvents: "none",
        }}
      />
      {[500, 680, 860].map((size) => (
        <div
          key={size}
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            border: `1px solid ${ringColor}`,
            pointerEvents: "none",
            opacity: subOp,
          }}
        />
      ))}
      <div
        style={{
          opacity: op,
          transform: `scale(${scale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            filter: "drop-shadow(0 8px 40px rgba(139,92,246,0.4))",
          }}
        >
          <MailmarkLogo size={72} />
        </div>
      </div>
      <div
        style={{
          opacity: op,
          transform: `scale(${scale})`,
          fontSize: 42,
          fontWeight: 900,
          color: titleColor,
          textAlign: "center",
          letterSpacing: "-1.5px",
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        Your inbox,{" "}
        <span style={{ color: accentColor }}>your style</span>
      </div>
      <div
        style={{
          opacity: subOp,
          transform: `translateY(${subY}px)`,
          fontSize: 16,
          color: subColor,
          marginBottom: 30,
        }}
      >
        11 themes · wallpapers · density control · signature editor
      </div>
      <div
        style={{
          opacity: btnOp,
          background: `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`,
          color: C.white,
          fontSize: 18,
          fontWeight: 800,
          padding: "16px 44px",
          borderRadius: 99,
          letterSpacing: "0.02em",
          boxShadow: "0 10px 40px rgba(124,58,237,0.5)",
          marginBottom: 24,
        }}
      >
        Try Mailmark Free
      </div>
      <div
        style={{
          opacity: urlOp,
          fontSize: 15,
          color: accentColor,
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        mailmark.dev
      </div>
    </AbsoluteFill>
  );
}

// ─── Scene transition ─────────────────────────────────────────────────────────
function SceneTransition({
  from,
  duration = 18,
}: {
  from: number;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const op = interpolate(
    frame,
    [from, from + duration / 2, from + duration],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  if (op <= 0) return null;
  return (
    <AbsoluteFill
      style={{ background: C.black, opacity: op, pointerEvents: "none" }}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Root composition  (total: 1350 frames = 45 seconds @ 30fps)
// ════════════════════════════════════════════════════════════════════════════════
export const PersonalizationVideo: React.FC<{ theme?: "light" | "dark" }> = ({ theme = "dark" }) => {
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      {/* Scene 1: Intro (0-90) */}
      <Sequence from={0} durationInFrames={90}>
        <SceneIntro theme={theme} />
      </Sequence>

      {/* Scene 2: Theme showcase (90-480) */}
      <Sequence from={90} durationInFrames={390}>
        <SceneThemes theme={theme} />
      </Sequence>

      {/* Scene 3: Wallpapers (480-750) */}
      <Sequence from={480} durationInFrames={270}>
        <SceneWallpapers theme={theme} />
      </Sequence>

      {/* Scene 4: UI Density (750-990) */}
      <Sequence from={750} durationInFrames={240}>
        <SceneDensity theme={theme} />
      </Sequence>

      {/* Scene 5: Signature Editor (990-1200) */}
      <Sequence from={990} durationInFrames={210}>
        <SceneSignature theme={theme} />
      </Sequence>

      {/* Scene 6: CTA (1200-1350) */}
      <Sequence from={1200} durationInFrames={150}>
        <SceneCTA theme={theme} />
      </Sequence>

      {/* Transitions */}
      <SceneTransition from={88} />
      <SceneTransition from={478} />
      <SceneTransition from={748} />
      <SceneTransition from={988} />
      <SceneTransition from={1198} />
    </AbsoluteFill>
  );
};
