import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
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
  green100: "#dcfce7",
  amber400: "#fbbf24",
  blue400: "#60a5fa",
  white: "#ffffff",
  black: "#000000",
};

// ─── Theme-aware surface tokens ───────────────────────────────────────────────
type TC = {
  sceneBg: string;
  shellBg: string;
  chromeBg: string;
  sidebarBg: string;
  mainBg: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  inputBg: string;
  rowBg: string;
  tagBg: string;
};

function tc(theme: "light" | "dark"): TC {
  if (theme === "light") {
    return {
      sceneBg: "linear-gradient(160deg, #f0f4ff 0%, #ffffff 100%)",
      shellBg: "#ffffff",
      chromeBg: "#f1f5f9",
      sidebarBg: "#f8fafc",
      mainBg: "#ffffff",
      border: "rgba(0,0,0,0.08)",
      text: "#0f172a",
      textSub: "#475569",
      textMuted: "#94a3b8",
      inputBg: "#f1f5f9",
      rowBg: "rgba(0,0,0,0.02)",
      tagBg: "rgba(139,92,246,0.1)",
    };
  }
  return {
    sceneBg: "linear-gradient(160deg, #0d0d1a 0%, #111827 100%)",
    shellBg: C.gray900,
    chromeBg: C.gray800,
    sidebarBg: C.gray800,
    mainBg: C.gray900,
    border: "rgba(255,255,255,0.06)",
    text: C.white,
    textSub: C.gray300,
    textMuted: C.gray500,
    inputBg: C.gray800,
    rowBg: "rgba(255,255,255,0.03)",
    tagBg: "rgba(139,92,246,0.15)",
  };
}

const font = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sp(frame: number, delay: number, fps: number, damping = 14, stiffness = 110) {
  return spring({ frame: frame - delay, fps, config: { damping, stiffness, mass: 0.8 } });
}
function fadeIn(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
function slideUp(frame: number, start: number, end: number, distance = 30) {
  return interpolate(frame, [start, end], [distance, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
function typeText(text: string, frame: number, startFrame: number, fps: number, charsPerSec = 18) {
  const chars = Math.min(text.length, Math.floor(Math.max(0, frame - startFrame) * charsPerSec / fps));
  return text.slice(0, chars);
}

// ─── Delivery tick ────────────────────────────────────────────────────────────
function DeliveryTick({ status }: { status: "sent" | "delivered" | "read" }) {
  const color = status === "read" ? C.blue400 : "#6b7280";
  if (status === "sent") {
    return (
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
        <polyline points="1,5 4,8 9,2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
      <polyline points="1,5 4,8 9,2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,5 8,8 13,2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function MailmarkLogo({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <clipPath id="envClip">
          <rect x="4" y="16" width="66" height="50" rx="8" />
        </clipPath>
      </defs>
      <rect x="4" y="16" width="66" height="50" rx="8" fill="none" stroke="url(#grad)" strokeWidth="7" strokeLinejoin="round" />
      <line x1="4" y1="16" x2="37" y2="44" stroke="url(#grad)" strokeWidth="7" strokeLinecap="round" clipPath="url(#envClip)" />
      <line x1="70" y1="16" x2="37" y2="44" stroke="url(#grad)" strokeWidth="7" strokeLinecap="round" clipPath="url(#envClip)" />
      <circle cx="67" cy="62" r="18" fill="url(#grad)" />
      <polyline points="58,62 65,69 77,53" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Dashboard Shell ──────────────────────────────────────────────────────────
function DashboardShell({
  activeNav, children, opacity = 1, sidebarExtra, theme, urlPath = "dashboard",
}: {
  activeNav: string;
  children: React.ReactNode;
  opacity?: number;
  sidebarExtra?: React.ReactNode;
  theme: "light" | "dark";
  urlPath?: string;
}) {
  const t = tc(theme);
  const navItems = ["Dashboard", "Domains", "Developer", "Billing"];
  return (
    <div style={{
      width: "100%", height: "100%",
      background: t.shellBg,
      borderRadius: 0, overflow: "hidden",
      display: "flex", flexDirection: "column",
      opacity, fontFamily: font,
    }}>
      {/* Browser chrome */}
      <div style={{
        height: 44, background: t.chromeBg,
        borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", padding: "0 16px", gap: 8, flexShrink: 0,
      }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
        <div style={{
          marginLeft: 16, background: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          borderRadius: 6, padding: "3px 14px", fontSize: 12, color: t.textMuted, letterSpacing: "0.02em",
        }}>
          mailmark.dev/{urlPath}
        </div>
      </div>
      {/* App layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{
          width: 200, background: t.sidebarBg,
          borderRight: `1px solid ${t.border}`,
          padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 16px", marginBottom: 4, borderBottom: `1px solid ${t.border}` }}>
            <MailmarkLogo size={28} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Mailmark</span>
          </div>
          {navItems.map((item) => {
            const active = item === activeNav;
            return (
              <div key={item} style={{
                padding: "8px 10px", borderRadius: 8, fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? C.violet600 : t.textMuted,
                background: active ? (theme === "dark" ? "rgba(139,92,246,0.15)" : C.violet50) : "transparent",
                borderLeft: active ? `2px solid ${C.violet500}` : "2px solid transparent",
              }}>
                {item}
              </div>
            );
          })}
          {sidebarExtra}
        </div>
        {/* Main content */}
        <div style={{ flex: 1, overflow: "hidden", background: t.mainBg, position: "relative" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Check badge ──────────────────────────────────────────────────────────────
function CheckBadge({ verified, size = 14 }: { verified: boolean; size?: number }) {
  if (verified) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: C.green100, color: "#15803d",
        fontSize: size, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      }}>✓ Verified</span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(251,191,36,0.15)", color: C.amber400,
      fontSize: size, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
    }}>Pending</span>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 1 - Intro (0-75)
// ════════════════════════════════════════════════════════════════════════════════
function SceneIntro({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoSp = sp(frame, 0, fps, 12, 100);
  const logoOpacity = fadeIn(frame, 0, 12);
  const titleOpacity = fadeIn(frame, 18, 38);
  const titleY = slideUp(frame, 18, 40);
  const tagOpacity = fadeIn(frame, 38, 58);
  const tagY = slideUp(frame, 38, 58, 16);
  const glowOp = interpolate(frame, [0, 40, 75], [0, 0.4, 0.25], { extrapolateRight: "clamp" });

  const isLight = theme === "light";
  const bg = isLight
    ? "radial-gradient(ellipse 80% 80% at 50% 50%, #ede9fe 0%, #f5f3ff 60%, #ffffff 100%)"
    : "radial-gradient(ellipse 80% 80% at 50% 50%, #1e1b4b 0%, #000 100%)";
  const glowColor = isLight
    ? "radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)"
    : "radial-gradient(circle, #7c3aed, transparent 70%)";
  const titleColor = isLight ? C.gray900 : C.white;
  const tagColor = C.violet600;

  return (
    <AbsoluteFill style={{
      background: bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font,
    }}>
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: glowColor, opacity: glowOp, pointerEvents: "none" }} />
      <div style={{ opacity: logoOpacity, transform: `scale(${logoSp})`, marginBottom: 28, filter: "drop-shadow(0 8px 40px rgba(139,92,246,0.4))" }}>
        <MailmarkLogo size={110} />
      </div>
      <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)`, fontSize: 58, fontWeight: 900, letterSpacing: "-2px", color: titleColor, marginBottom: 12 }}>
        Mailmark
      </div>
      <div style={{ opacity: tagOpacity, transform: `translateY(${tagY}px)`, fontSize: 17, fontWeight: 500, color: tagColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Email Hosting + Campaigns
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 2 - Hero (75-195)
// ════════════════════════════════════════════════════════════════════════════════
function SceneHero({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";
  const bg = isLight
    ? `linear-gradient(135deg, #f5f3ff 0%, #ede9fe 30%, #ffffff 100%)`
    : `linear-gradient(135deg, ${C.violet950} 0%, #0f172a 60%, ${C.gray900} 100%)`;
  const gridLine = isLight ? "rgba(124,58,237,0.04)" : "rgba(124,58,237,0.05)";
  const mainTextColor = isLight ? C.gray900 : C.white;
  const subTextColor = isLight ? C.gray600 : C.gray400;
  const featTextColor = isLight ? C.gray600 : C.gray400;
  const featCheckBg = "rgba(139,92,246,0.12)";
  const lines = [
    { text: "Your domain.", color: mainTextColor },
    { text: "Your mailboxes.", color: mainTextColor },
    { text: "Your campaigns.", color: C.violet600 },
  ];
  return (
    <AbsoluteFill style={{
      background: bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: font, padding: "0 80px",
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 79px, ${gridLine} 80px)`, pointerEvents: "none" }} />
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        {lines.map((line, i) => {
          const s = sp(frame, i * 22, fps, 14, 90);
          const op = fadeIn(frame, i * 22, i * 22 + 20);
          return (
            <div key={line.text} style={{ opacity: op, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`, fontSize: 68, fontWeight: 900, lineHeight: 1.15, letterSpacing: "-2px", color: line.color }}>
              {line.text}
            </div>
          );
        })}
      </div>
      <div style={{ opacity: fadeIn(frame, 68, 88), fontSize: 18, color: subTextColor, textAlign: "center", maxWidth: 600, lineHeight: 1.7, marginBottom: 36 }}>
        Add your domain, create mailboxes like support@yourco.com, and manage everything from one beautiful dashboard.
      </div>
      <div style={{ opacity: fadeIn(frame, 88, 108), display: "flex", alignItems: "center", gap: 24 }}>
        {["Custom domain email", "Email campaigns", "REST API + SDK"].map((feat) => (
          <div key={feat} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: featTextColor }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: featCheckBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.violet600 }}>✓</div>
            {feat}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 3 - Adding a Domain (195-525)
// ════════════════════════════════════════════════════════════════════════════════
function SceneAddDomain({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = tc(theme);

  const shellOp = fadeIn(frame, 0, 20);
  const titleOp = fadeIn(frame, 5, 25);
  const inputOp = fadeIn(frame, 18, 35);
  const domainText = typeText("acme.com", frame, 22, fps, 14);
  const buttonOp = fadeIn(frame, 55, 70);
  const buttonScale = frame > 68 && frame < 80 ? interpolate(frame, [68, 74, 80], [1, 0.94, 1], { extrapolateRight: "clamp" }) : 1;
  const tableOp = fadeIn(frame, 82, 100);

  const dnsRows = [
    { type: "CNAME", name: "token1._domainkey", value: "token1.dkim.amazonses.com", purpose: "DKIM 1", verifyAt: 135 },
    { type: "CNAME", name: "token2._domainkey", value: "token2.dkim.amazonses.com", purpose: "DKIM 2", verifyAt: 160 },
    { type: "CNAME", name: "token3._domainkey", value: "token3.dkim.amazonses.com", purpose: "DKIM 3", verifyAt: 185 },
    { type: "MX",    name: "@",                 value: "inbound-smtp.ap-south-1.amazonaws.com", purpose: "Receiving", verifyAt: 205 },
    { type: "TXT",   name: "@",                 value: "v=spf1 include:amazonses.com ~all", purpose: "SPF", verifyAt: 220 },
    { type: "TXT",   name: "_dmarc",            value: "v=DMARC1; p=quarantine;", purpose: "DMARC", verifyAt: 238 },
  ];

  const successOp = fadeIn(frame, 248, 268);
  const successScale = interpolate(sp(frame, 248, fps, 12, 130), [0, 1], [0.85, 1]);

  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <DashboardShell activeNav="Domains" opacity={shellOp} theme={theme} urlPath="domains/add">
        <div style={{ padding: "28px 32px", height: "100%", display: "flex", flexDirection: "column", gap: 20, overflowY: "hidden" }}>
          <div style={{ opacity: titleOp }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 4 }}>Add Domain</div>
            <div style={{ fontSize: 13, color: t.textMuted }}>Connect your domain to start sending and receiving email.</div>
          </div>
          {/* Input row */}
          <div style={{ opacity: inputOp, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1, maxWidth: 380, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 15, color: t.text, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: t.textMuted }}>https://</span>
              <span>{domainText}</span>
              {frame >= 22 && frame < 60 && <span style={{ width: 2, height: 18, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0 }} />}
            </div>
            <div style={{ opacity: buttonOp, transform: `scale(${buttonScale})`, background: `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, color: C.white, fontSize: 14, fontWeight: 700, padding: "10px 22px", borderRadius: 10, boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}>
              Add Domain
            </div>
          </div>
          {/* DNS table */}
          <div style={{ opacity: tableOp, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              DNS Records: add these to your registrar
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dnsRows.map((row, i) => {
                const rowOp = fadeIn(frame, 88 + i * 8, 96 + i * 8);
                const rowY = slideUp(frame, 88 + i * 8, 100 + i * 8, 16);
                const verified = frame >= row.verifyAt;
                const verifyFade = fadeIn(frame, row.verifyAt, row.verifyAt + 12);
                return (
                  <div key={row.purpose} style={{ opacity: rowOp, transform: `translateY(${rowY}px)`, background: verified ? "rgba(34,197,94,0.06)" : t.rowBg, border: verified ? "1px solid rgba(34,197,94,0.2)" : `1px solid ${t.border}`, borderRadius: 8, padding: "8px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.violet500, background: t.tagBg, padding: "2px 7px", borderRadius: 5, minWidth: 42, textAlign: "center" }}>{row.type}</span>
                    <span style={{ fontSize: 11, color: t.textSub, fontFamily: "monospace", minWidth: 160, flex: "none" }}>{row.name}</span>
                    <span style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
                    <span style={{ fontSize: 11, color: t.textMuted, minWidth: 55 }}>{row.purpose}</span>
                    <div style={{ opacity: verifyFade, minWidth: 80, display: "flex", justifyContent: "flex-end" }}>
                      <CheckBadge verified={verified} size={11} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Success banner */}
          {frame >= 248 && (
            <div style={{ opacity: successOp, transform: `scale(${successScale})`, background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.green500, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.white, flexShrink: 0 }}>✓</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.green500 }}>acme.com is verified and ready!</div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>All DNS records verified. You can now create mailboxes and send email.</div>
              </div>
            </div>
          )}
        </div>
      </DashboardShell>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 4 - Creating Mailboxes (525-765)
// ════════════════════════════════════════════════════════════════════════════════
function SceneCreateMailboxes({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = tc(theme);

  const shellOp = fadeIn(frame, 0, 18);
  const labelOp = fadeIn(frame, 5, 22);
  const emptyOp = frame < 120 ? fadeIn(frame, 18, 35) : interpolate(frame, [118, 130], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const modalOp = frame >= 65 && frame < 130 ? interpolate(frame, [65, 80, 118, 130], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const modalY = frame >= 65 ? interpolate(sp(frame, 65, fps, 14, 120), [0, 1], [60, 0]) : 60;
  const modalInput = typeText("sales", frame, 85, fps, 12);

  const mailboxes = [
    { address: "sales", full: "sales@acme.com", color: "#7c3aed", initial: "S", showAt: 132 },
    { address: "support", full: "support@acme.com", color: "#0891b2", initial: "S", showAt: 162 },
    { address: "hello", full: "hello@acme.com", color: "#059669", initial: "H", showAt: 192 },
  ];

  const domainTreeOp = fadeIn(frame, 10, 28);
  const sidebarExtra = (
    <div style={{ opacity: domainTreeOp, marginTop: 4 }}>
      <div style={{ padding: "6px 10px 2px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: t.textMuted }}>▾</span>
        <span style={{ fontSize: 12, color: C.violet500, fontWeight: 600 }}>acme.com</span>
      </div>
      {mailboxes.map((mb) => {
        const shown = frame >= mb.showAt;
        const mbOp = shown ? fadeIn(frame, mb.showAt, mb.showAt + 12) : 0;
        return (
          <div key={mb.address} style={{ opacity: mbOp, padding: "5px 10px 5px 24px", fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: mb.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: C.white, flexShrink: 0 }}>{mb.initial}</div>
            {mb.address}
          </div>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <DashboardShell activeNav="Domains" opacity={shellOp} sidebarExtra={sidebarExtra} theme={theme} urlPath="domains/acme.com/mailboxes">
        <div style={{ padding: "28px 32px", height: "100%", display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>Mailboxes</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>acme.com</div>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, color: C.white, fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 9, transform: `scale(${frame >= 60 && frame < 70 ? interpolate(frame, [60, 65, 70], [1, 0.92, 1], { extrapolateRight: "clamp" }) : 1})`, boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}>
              + Add Mailbox
            </div>
          </div>
          {frame < 130 && (
            <div style={{ opacity: emptyOp, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, border: `1px dashed ${t.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 36 }}>📬</div>
              <div style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>No mailboxes yet</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>Create your first mailbox for acme.com</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mailboxes.map((mb) => {
              if (frame < mb.showAt) return null;
              const mbOp = fadeIn(frame, mb.showAt, mb.showAt + 15);
              const mbY = slideUp(frame, mb.showAt, mb.showAt + 18, 20);
              const mbScale = interpolate(sp(frame, mb.showAt, fps, 13, 120), [0, 1], [0.9, 1]);
              return (
                <div key={mb.address} style={{ opacity: mbOp, transform: `translateY(${mbY}px) scale(${mbScale})`, background: t.rowBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: mb.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: C.white, flexShrink: 0 }}>{mb.initial}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{mb.full}</div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>Inbox · Sent · Outbox · Drafts</div>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, background: t.rowBg, padding: "3px 10px", borderRadius: 6 }}>Open →</div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Modal */}
        {frame >= 65 && frame < 130 && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: modalOp }}>
            <div style={{ transform: `translateY(${modalY}px)`, background: theme === "dark" ? C.gray800 : C.white, borderRadius: 14, width: 380, padding: "26px 28px", border: `1px solid ${t.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.text, marginBottom: 6 }}>Create Mailbox</div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Add a new address on acme.com</div>
              <div style={{ fontSize: 12, color: t.textSub, marginBottom: 6, fontWeight: 600 }}>Email address</div>
              <div style={{ display: "flex" }}>
                <div style={{ flex: 1, background: t.inputBg, border: `1.5px solid ${C.violet500}`, borderRight: "none", borderRadius: "8px 0 0 8px", padding: "9px 12px", fontSize: 14, color: t.text, display: "flex", alignItems: "center", gap: 3 }}>
                  {modalInput}
                  <span style={{ width: 2, height: 16, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0 }} />
                </div>
                <div style={{ background: t.inputBg, border: `1.5px solid ${t.border}`, borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "9px 12px", fontSize: 14, color: t.textMuted }}>@acme.com</div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <div style={{ flex: 1, background: t.rowBg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 600, color: t.textSub, textAlign: "center" }}>Cancel</div>
                <div style={{ flex: 1, background: `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, borderRadius: 8, padding: "9px", fontSize: 13, fontWeight: 700, color: C.white, textAlign: "center" }}>Create</div>
              </div>
            </div>
          </div>
        )}
      </DashboardShell>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 5 - Sending an Email (765-1065)
// ════════════════════════════════════════════════════════════════════════════════
function SceneSendEmail({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = tc(theme);

  const shellOp = fadeIn(frame, 0, 18);
  const labelOp = fadeIn(frame, 5, 22);
  const inboxOp = fadeIn(frame, 18, 35);

  const composeOp = frame >= 62 ? interpolate(frame, [62, 78], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const composeX = frame >= 62 ? interpolate(sp(frame, 62, fps, 14, 110), [0, 1], [420, 0]) : 420;

  const toText = typeText("jane.doe@example.com", frame, 82, fps, 16);
  const subjectText = typeText("Q4 Partnership Proposal", frame, 112, fps, 16);
  const bodyText = typeText("Hi Jane,\n\nHope you're doing well. I'd love to connect about...", frame, 136, fps, 28);

  const sendClick = frame >= 158 && frame < 168;
  const sendScale = sendClick ? interpolate(frame, [158, 163, 168], [1, 0.91, 1], { extrapolateRight: "clamp" }) : 1;

  const toastOp = frame >= 168 ? interpolate(frame, [168, 180, 240, 252], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const toastY = frame >= 168 ? interpolate(sp(frame, 168, fps, 14, 130), [0, 1], [-30, 0]) : -30;

  const inboxEmails = [
    { from: "John Smith", subject: "Re: Partnership proposal", time: "2m", unread: true },
    { from: "Emily Davis", subject: "Campaign results Q4", time: "1h", unread: true },
    { from: "Alex Turner", subject: "Invoice #1042", time: "3h", unread: false },
    { from: "Sarah Chen", subject: "Team sync tomorrow?", time: "5h", unread: false },
  ];

  const sentEmails = [
    { to: "jane.doe@example.com", subject: "Q4 Partnership Proposal", time: "now", tick: "sent" as const, showAt: 172 },
    { to: "bob@partner.io", subject: "Intro + next steps", time: "1h", tick: "delivered" as const, showAt: 175 },
    { to: "team@acme.com", subject: "Weekly standup notes", time: "3h", tick: "read" as const, showAt: 178 },
  ];

  const showSent = frame >= 172;
  const activeFolderIdx = showSent ? 1 : 0;

  const sidebarExtra = (
    <div style={{ marginTop: 4 }}>
      <div style={{ padding: "6px 10px 2px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: t.textMuted }}>▾</span>
        <span style={{ fontSize: 12, color: C.violet500, fontWeight: 600 }}>acme.com</span>
      </div>
      {[{ label: "sales", color: "#7c3aed", active: true }, { label: "support", color: "#0891b2", active: false }, { label: "hello", color: "#059669", active: false }].map((mb) => (
        <div key={mb.label} style={{ padding: "5px 10px 5px 24px", fontSize: 11, color: mb.active ? C.violet500 : t.textMuted, background: mb.active ? (theme === "dark" ? "rgba(139,92,246,0.1)" : C.violet50) : "transparent", borderLeft: mb.active ? `2px solid ${C.violet500}` : "2px solid transparent", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: mb.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: C.white, flexShrink: 0 }}>{mb.label[0].toUpperCase()}</div>
          {mb.label}
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <DashboardShell activeNav="Domains" opacity={shellOp} sidebarExtra={sidebarExtra} theme={theme} urlPath="mailbox/sales">
        <div style={{ display: "flex", height: "100%", position: "relative" }}>
          {/* Folder list */}
          <div style={{ width: 200, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6 }}>sales@acme.com</div>
              <div style={{ background: `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, color: C.white, fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, textAlign: "center", transform: `scale(${frame >= 62 && frame < 72 ? interpolate(frame, [62, 67, 72], [1, 0.92, 1], { extrapolateRight: "clamp" }) : 1})`, boxShadow: "0 4px 12px rgba(124,58,237,0.4)" }}>
                ✏ New
              </div>
            </div>
            {["Inbox", "Sent", "Outbox", "Drafts", "Trash"].map((folder, i) => (
              <div key={folder} style={{ padding: "8px 14px", fontSize: 13, color: i === activeFolderIdx ? C.violet600 : t.textMuted, background: i === activeFolderIdx ? (theme === "dark" ? "rgba(139,92,246,0.1)" : C.violet50) : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {folder}
                {i === 0 && <span style={{ background: C.violet600, color: C.white, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>12</span>}
              </div>
            ))}
          </div>
          {/* Email list */}
          <div style={{ flex: 1, opacity: inboxOp, overflow: "hidden" }}>
            {!showSent ? (
              <>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.text }}>Inbox</div>
                {inboxEmails.map((email, i) => {
                  const eOp = fadeIn(frame, 22 + i * 8, 34 + i * 8);
                  return (
                    <div key={email.subject} style={{ opacity: eOp, padding: "12px 16px", borderBottom: `1px solid ${t.border}`, background: email.unread ? (theme === "dark" ? "rgba(139,92,246,0.06)" : C.violet50 + "80") : "transparent", display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: email.unread ? 700 : 400, color: email.unread ? t.text : t.textSub }}>{email.from}</span>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{email.time}</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.textSub }}>{email.subject}</div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.text }}>Sent</div>
                {sentEmails.map((email, i) => {
                  const eOp = fadeIn(frame, email.showAt, email.showAt + 12);
                  return (
                    <div key={email.subject} style={{ opacity: eOp, padding: "12px 16px", borderBottom: `1px solid ${t.border}`, background: i === 0 ? (theme === "dark" ? "rgba(139,92,246,0.06)" : C.violet50 + "80") : "transparent", display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? t.text : t.textSub }}>To: {email.to}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: t.textMuted }}>{email.time}</span>
                          <DeliveryTick status={email.tick} />
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: t.textSub }}>{email.subject}</div>
                    </div>
                  );
                })}
                <div style={{ padding: "10px 16px", display: "flex", gap: 14, opacity: fadeIn(frame, 188, 205) }}>
                  {(["sent", "delivered", "read"] as const).map((s) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t.textMuted }}>
                      <DeliveryTick status={s} /> {s.charAt(0).toUpperCase() + s.slice(1)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Compose panel */}
          {frame >= 62 && frame < 172 && (
            <div style={{ position: "absolute", top: 0, right: 0, width: 420, height: "100%", background: theme === "dark" ? C.gray800 : C.white, borderLeft: `1px solid ${t.border}`, opacity: composeOp, transform: `translateX(${composeX}px)`, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>New Message</div>
                <div style={{ fontSize: 18, color: t.textMuted }}>×</div>
              </div>
              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: t.textMuted, minWidth: 48 }}>To</span>
                <span style={{ fontSize: 13, color: t.text }}>
                  {toText}
                  {frame >= 82 && frame < 112 && <span style={{ width: 2, height: 14, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0, marginLeft: 1 }} />}
                </span>
              </div>
              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: t.textMuted, minWidth: 48 }}>Subject</span>
                <span style={{ fontSize: 13, color: t.text }}>
                  {subjectText}
                  {frame >= 112 && frame < 136 && <span style={{ width: 2, height: 14, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0, marginLeft: 1 }} />}
                </span>
              </div>
              <div style={{ flex: 1, padding: "14px 18px" }}>
                <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {bodyText}
                  {frame >= 136 && frame < 158 && <span style={{ width: 2, height: 14, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0, marginLeft: 1 }} />}
                </div>
              </div>
              <div style={{ padding: "12px 18px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>📎</span>
                  <span style={{ fontSize: 12, color: t.textMuted }}>🖼</span>
                </div>
                <div style={{ transform: `scale(${sendScale})`, background: frame >= 158 ? `linear-gradient(135deg, ${C.green500}, #16a34a)` : `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, color: C.white, fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 8, boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}>
                  {frame >= 160 ? "✓ Sent!" : "Send"}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Toast */}
        {frame >= 168 && frame < 250 && (
          <div style={{ position: "absolute", top: 16, right: 16, opacity: toastOp, transform: `translateY(${toastY}px)`, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: C.green500, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 13 }}>✓</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green500 }}>Email sent successfully</div>
              <div style={{ fontSize: 11, color: t.textMuted }}>Delivered to jane.doe@example.com</div>
            </div>
          </div>
        )}
      </DashboardShell>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 6 - Send as Campaign (1065-1365)
// ════════════════════════════════════════════════════════════════════════════════
function SceneSendAsCampaign({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = tc(theme);

  const shellOp = fadeIn(frame, 0, 18);

  // Compose panel slides in from right at frame 8
  const composeOp = fadeIn(frame, 8, 22);
  const composeX = interpolate(sp(frame, 8, fps, 14, 110), [0, 1], [440, 0]);

  // Typing phases
  const subjectText = typeText("Q4 Product Update | {{first_name}}", frame, 28, fps, 16);
  const bodyText = typeText("Hi {{first_name}},\n\nHope you're doing well. Here's what's new at acme.com...", frame, 72, fps, 26);

  // "Send as Campaign" toggle appears at 128, toggled on at 142
  const toggleOp = fadeIn(frame, 128, 142);
  const toggleOn = frame >= 148;
  const toggleBounce = frame >= 142 && frame < 154 ? interpolate(frame, [142, 148, 154], [1, 0.88, 1], { extrapolateRight: "clamp" }) : 1;

  // Info banner after toggle
  const bannerOp = fadeIn(frame, 152, 166);

  // Send button
  const sendScale = frame >= 174 && frame < 184 ? interpolate(frame, [174, 179, 184], [1, 0.90, 1], { extrapolateRight: "clamp" }) : 1;

  // Progress (frames 184-224)
  const progressPct = interpolate(frame, [184, 224], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const progressCount = Math.round(interpolate(frame, [184, 224], [0, 847], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  // Switch to sent view
  const showSent = frame >= 230;
  const sentEmails = [
    { to: "john.smith@acme.com", subject: "Q4 Product Update for John", tick: "read" as const, showAt: 235 },
    { to: "emily.davis@corp.io", subject: "Q4 Product Update for Emily", tick: "delivered" as const, showAt: 244 },
    { to: "alex.t@startup.co", subject: "Q4 Product Update for Alex", tick: "delivered" as const, showAt: 253 },
    { to: "+ 844 more recipients…", subject: "", tick: "sent" as const, showAt: 262 },
  ];

  const inboxEmails = [
    { from: "John Smith", subject: "Re: Partnership proposal", time: "2m", unread: true },
    { from: "Emily Davis", subject: "Campaign results Q4", time: "1h", unread: true },
    { from: "Alex Turner", subject: "Invoice #1042", time: "3h", unread: false },
  ];

  const sidebarExtra = (
    <div style={{ marginTop: 4 }}>
      <div style={{ padding: "6px 10px 2px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, color: t.textMuted }}>▾</span>
        <span style={{ fontSize: 12, color: C.violet500, fontWeight: 600 }}>acme.com</span>
      </div>
      {[{ label: "sales", color: "#7c3aed", active: true }, { label: "support", color: "#0891b2", active: false }].map((mb) => (
        <div key={mb.label} style={{ padding: "5px 10px 5px 24px", fontSize: 11, color: mb.active ? C.violet500 : t.textMuted, background: mb.active ? (theme === "dark" ? "rgba(139,92,246,0.1)" : C.violet50) : "transparent", borderLeft: mb.active ? `2px solid ${C.violet500}` : "2px solid transparent", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: mb.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: C.white, flexShrink: 0 }}>{mb.label[0].toUpperCase()}</div>
          {mb.label}
        </div>
      ))}
    </div>
  );

  const activeFolderIdx = showSent ? 1 : 0;

  return (
    <AbsoluteFill style={{ fontFamily: font }}>
      <DashboardShell activeNav="Domains" opacity={shellOp} sidebarExtra={sidebarExtra} theme={theme} urlPath="mailbox/sales">
        <div style={{ display: "flex", height: "100%", position: "relative" }}>
          {/* Folder sidebar */}
          <div style={{ width: 200, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 6 }}>sales@acme.com</div>
              <div style={{ background: `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, color: C.white, fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, textAlign: "center", transform: `scale(${frame >= 4 && frame < 14 ? interpolate(frame, [4, 9, 14], [1, 0.92, 1], { extrapolateRight: "clamp" }) : 1})`, boxShadow: "0 4px 12px rgba(124,58,237,0.4)" }}>
                ✏ New
              </div>
            </div>
            {["Inbox", "Sent", "Outbox", "Drafts", "Trash"].map((folder, i) => (
              <div key={folder} style={{ padding: "8px 14px", fontSize: 13, color: i === activeFolderIdx ? C.violet600 : t.textMuted, background: i === activeFolderIdx ? (theme === "dark" ? "rgba(139,92,246,0.1)" : C.violet50) : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {folder}
                {i === 0 && <span style={{ background: C.violet600, color: C.white, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>5</span>}
              </div>
            ))}
          </div>

          {/* Email list */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {!showSent ? (
              <>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.text }}>Inbox</div>
                {inboxEmails.map((email, i) => (
                  <div key={email.subject} style={{ opacity: fadeIn(frame, 8 + i * 6, 20 + i * 6), padding: "12px 16px", borderBottom: `1px solid ${t.border}`, background: email.unread ? (theme === "dark" ? "rgba(139,92,246,0.06)" : C.violet50 + "80") : "transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: email.unread ? 700 : 400, color: email.unread ? t.text : t.textSub }}>{email.from}</span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{email.time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>{email.subject}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, fontSize: 14, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 10 }}>
                  Sent
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.violet500, background: t.tagBg, padding: "2px 9px", borderRadius: 99 }}>Campaign · 847 recipients</span>
                </div>
                {sentEmails.map((email, i) => {
                  const isSummary = email.to.startsWith("+");
                  return (
                    <div key={email.to} style={{ opacity: fadeIn(frame, email.showAt, email.showAt + 10), padding: "12px 16px", borderBottom: `1px solid ${t.border}`, background: i === 0 ? (theme === "dark" ? "rgba(139,92,246,0.06)" : C.violet50 + "80") : "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: isSummary ? 400 : 600, color: isSummary ? t.textMuted : t.text, fontStyle: isSummary ? "italic" : "normal" }}>
                          {isSummary ? email.to : `To: ${email.to}`}
                        </span>
                        {!isSummary && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: t.textMuted }}>now</span>
                            <DeliveryTick status={email.tick} />
                          </div>
                        )}
                      </div>
                      {!isSummary && <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>{email.subject}</div>}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Compose panel */}
          {frame >= 8 && frame < 230 && (
            <div style={{ position: "absolute", top: 0, right: 0, width: 460, height: "100%", background: theme === "dark" ? C.gray800 : C.white, borderLeft: `1px solid ${t.border}`, opacity: composeOp, transform: `translateX(${composeX}px)`, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>New Message</div>
                <div style={{ fontSize: 18, color: t.textMuted }}>×</div>
              </div>

              {/* To - contacts chip */}
              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: t.textMuted, minWidth: 52 }}>To</span>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                  {frame >= 20 ? (
                    <span style={{ opacity: fadeIn(frame, 20, 30), background: t.tagBg, border: `1px solid rgba(139,92,246,0.3)`, borderRadius: 99, padding: "2px 10px", fontSize: 12, color: C.violet600 }}>
                      marketing-list · 847 contacts
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: t.text }}>
                      {typeText("marketing-list", frame, 10, fps, 14)}
                      <span style={{ width: 2, height: 14, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0, marginLeft: 1 }} />
                    </span>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div style={{ padding: "10px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: t.textMuted, minWidth: 52 }}>Subject</span>
                <span style={{ fontSize: 13, color: t.text }}>
                  {subjectText}
                  {frame >= 28 && frame < 72 && <span style={{ width: 2, height: 14, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0, marginLeft: 1 }} />}
                </span>
              </div>

              {/* Body */}
              <div style={{ flex: 1, padding: "14px 18px", overflow: "hidden" }}>
                <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {bodyText}
                  {frame >= 72 && frame < 128 && <span style={{ width: 2, height: 14, background: C.violet400, display: "inline-block", opacity: Math.floor(frame / 8) % 2 === 0 ? 1 : 0, marginLeft: 1 }} />}
                </div>
                {frame >= 100 && (
                  <div style={{ opacity: fadeIn(frame, 100, 116), marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.violet500, background: t.tagBg, padding: "4px 10px", borderRadius: 6 }}>
                    <span>✦</span> {`{{first_name}}`} personalised per recipient
                  </div>
                )}
              </div>

              {/* Send as Campaign toggle */}
              <div style={{ padding: "10px 18px", borderTop: `1px solid ${t.border}`, opacity: toggleOp }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: toggleOn ? (theme === "dark" ? "rgba(139,92,246,0.12)" : "#f5f3ff") : t.rowBg, border: toggleOn ? `1px solid rgba(139,92,246,0.4)` : `1px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", transform: `scale(${toggleBounce})` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: toggleOn ? C.violet600 : t.text }}>Send as Campaign</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Each recipient gets a personal copy. Replies go only to you.</div>
                  </div>
                  <div style={{ width: 40, height: 22, borderRadius: 99, background: toggleOn ? C.violet600 : (theme === "dark" ? "rgba(255,255,255,0.15)" : C.gray300), position: "relative", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 3, left: toggleOn ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: C.white, boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }} />
                  </div>
                </div>
              </div>

              {/* 847 recipients banner */}
              {frame >= 152 && (
                <div style={{ opacity: bannerOp, margin: "0 18px 8px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>✦</span>
                  <span style={{ fontSize: 12, color: C.violet600, fontWeight: 500 }}>847 recipients · each gets a personal copy · replies only to you</span>
                </div>
              )}

              {/* Footer / Send button */}
              <div style={{ padding: "12px 18px", borderTop: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>📎</span>
                  <span style={{ fontSize: 12, color: t.textMuted }}>🖼</span>
                </div>
                <div style={{ transform: `scale(${sendScale})`, background: toggleOn ? `linear-gradient(135deg, ${C.violet600}, ${C.violet700})` : `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, color: C.white, fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 8, boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}>
                  {frame >= 180 ? "✓ Sending…" : (toggleOn ? "Send Campaign →" : "Send")}
                </div>
              </div>
            </div>
          )}

          {/* Sending progress panel */}
          {frame >= 184 && frame < 230 && (
            <div style={{ position: "absolute", top: 0, right: 0, width: 460, height: "100%", background: theme === "dark" ? C.gray800 : C.white, borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <div style={{ fontSize: 36 }}>✉️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Sending campaign…</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.violet500, letterSpacing: "-0.5px" }}>{progressCount.toLocaleString()} <span style={{ fontSize: 14, color: t.textMuted, fontWeight: 500 }}>/ 847 sent</span></div>
              <div style={{ width: 300, height: 7, background: t.rowBg, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.violet500}, ${C.violet600})`, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 12, color: t.textMuted }}>Each recipient receives a personal copy</div>
            </div>
          )}
        </div>

        {/* Success toast */}
        {frame >= 228 && frame < 300 && (
          <div style={{ position: "absolute", top: 16, right: 16, opacity: fadeIn(frame, 228, 240), transform: `translateY(${interpolate(sp(frame, 228, fps, 14, 130), [0, 1], [-28, 0])}px)`, background: theme === "dark" ? "rgba(139,92,246,0.15)" : "#f5f3ff", border: "1px solid rgba(139,92,246,0.35)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.violet600, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 13, flexShrink: 0 }}>✓</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.violet600 }}>Campaign sent to 847 recipients</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Each received a personal, individual email</div>
            </div>
          </div>
        )}
      </DashboardShell>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 7 - Pricing (1365-1530)
// ════════════════════════════════════════════════════════════════════════════════
function ScenePricing({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isLight = theme === "light";
  const bg = isLight
    ? "linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)"
    : `linear-gradient(180deg, #0a0614 0%, ${C.gray900} 100%)`;
  const titleColor = isLight ? C.gray900 : C.white;
  const subtitleColor = isLight ? C.gray500 : C.gray400;
  const cardBg = isLight ? "#ffffff" : "rgba(255,255,255,0.04)";
  const cardBorder = isLight ? "1px solid rgba(139,92,246,0.15)" : "1px solid rgba(255,255,255,0.1)";
  const cardShadow = isLight ? "0 4px 24px rgba(0,0,0,0.07)" : "none";
  const planNameColor = isLight ? C.gray700 : C.gray300;
  const priceColor = isLight ? C.gray900 : C.white;
  const periodColor = isLight ? C.gray400 : C.gray500;
  const dividerColor = isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)";
  const featColor = isLight ? C.gray600 : C.gray400;
  const checkBg = isLight ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.25)";
  const checkColor = isLight ? C.violet600 : C.white;
  const badgeBg = isLight ? C.violet700 : C.violet900;

  const plans = [
    { name: "Starter", price: "$10", period: "/mo", features: ["1,000 emails/mo", "1 domain", "3 mailboxes", "Full email UI", "Basic support"], highlight: false, badge: null },
    { name: "Pro", price: "$50", period: "/mo", features: ["25,000 emails/mo", "5 domains", "Unlimited mailboxes", "Email campaigns", "Priority support"], highlight: true, badge: "Most Popular" },
    { name: "Business", price: "$100", period: "/mo", features: ["100,000 emails/mo", "Unlimited domains", "Unlimited mailboxes", "Campaign analytics", "Dedicated support"], highlight: false, badge: null },
  ];
  return (
    <AbsoluteFill style={{ background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font, padding: "0 60px" }}>
      <div style={{ opacity: fadeIn(frame, 0, 20), fontSize: 36, fontWeight: 900, color: titleColor, marginBottom: 6, letterSpacing: "-1px", textAlign: "center" }}>Simple, transparent pricing</div>
      <div style={{ opacity: fadeIn(frame, 14, 30), fontSize: 15, color: subtitleColor, marginBottom: 44, textAlign: "center" }}>Every plan includes a 7-day free trial. No credit card required.</div>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        {plans.map((plan, i) => {
          const delay = i * 18;
          const s = sp(frame, delay + 8, fps, 13, 95);
          const op = fadeIn(frame, delay + 8, delay + 26);
          return (
            <div key={plan.name} style={{ opacity: op, transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`, background: plan.highlight ? `linear-gradient(145deg, ${C.violet700}, ${C.violet600})` : cardBg, border: plan.highlight ? `2px solid ${C.violet500}` : cardBorder, borderRadius: 18, padding: "30px 26px", width: 230, display: "flex", flexDirection: "column", gap: 14, position: "relative", boxShadow: plan.highlight ? "0 20px 50px rgba(124,58,237,0.4)" : cardShadow }}>
              {plan.badge && (
                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: badgeBg, color: C.white, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 14px", borderRadius: 99, border: `1px solid ${C.violet500}`, whiteSpace: "nowrap" }}>{plan.badge}</div>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: plan.highlight ? "rgba(255,255,255,0.85)" : planNameColor }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                <span style={{ fontSize: 44, fontWeight: 900, color: plan.highlight ? C.white : priceColor, letterSpacing: "-2px" }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: plan.highlight ? "rgba(255,255,255,0.55)" : periodColor }}>{plan.period}</span>
              </div>
              <div style={{ height: 1, background: plan.highlight ? "rgba(255,255,255,0.18)" : dividerColor }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {plan.features.map((feat) => (
                  <div key={feat} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: plan.highlight ? "rgba(255,255,255,0.18)" : checkBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: plan.highlight ? C.white : checkColor, flexShrink: 0 }}>✓</div>
                    <span style={{ fontSize: 13, color: plan.highlight ? "rgba(255,255,255,0.88)" : featColor }}>{feat}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 4, padding: "10px", borderRadius: 10, textAlign: "center", background: plan.highlight ? "rgba(255,255,255,0.15)" : "rgba(139,92,246,0.12)", color: plan.highlight ? C.white : C.violet600, fontSize: 13, fontWeight: 700, border: plan.highlight ? "1px solid rgba(255,255,255,0.2)" : `1px solid rgba(139,92,246,0.25)` }}>
                Start Free Trial
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCENE 8 - CTA (1530-1620)
// ════════════════════════════════════════════════════════════════════════════════
function SceneCTA({ theme }: { theme: "light" | "dark" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = sp(frame, 0, fps, 14, 90);
  const op = fadeIn(frame, 0, 20);
  const scale = interpolate(s, [0, 1], [0.88, 1]);
  const subOp = fadeIn(frame, 18, 36);
  const subY = slideUp(frame, 18, 36, 14);
  const btnOp = fadeIn(frame, 30, 48);
  const urlOp = fadeIn(frame, 44, 60);
  const fadeOut = interpolate(frame, [68, 90], [1, 0], { extrapolateRight: "clamp" });
  const isLight = theme === "light";

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
  const urlColor = isLight ? C.violet600 : C.violet400;

  return (
    <AbsoluteFill style={{ background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: font, opacity: fadeOut }}>
      <div style={{ position: "absolute", width: 700, height: 400, borderRadius: "50%", background: glowColor, pointerEvents: "none" }} />
      {[500, 680, 860].map((size) => (
        <div key={size} style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `1px solid ${ringColor}`, pointerEvents: "none", opacity: subOp }} />
      ))}
      <div style={{ opacity: op, transform: `scale(${scale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{ filter: "drop-shadow(0 8px 40px rgba(139,92,246,0.4))" }}><MailmarkLogo size={72} /></div>
        <div style={{ fontSize: 26, fontWeight: 800, color: titleColor, letterSpacing: "-0.5px" }}>Mailmark</div>
      </div>
      <div style={{ opacity: op, transform: `scale(${scale})`, fontSize: 46, fontWeight: 900, color: titleColor, textAlign: "center", letterSpacing: "-1.5px", lineHeight: 1.2, marginBottom: 12 }}>
        Start your <span style={{ color: accentColor }}>7-day</span><br />free trial today
      </div>
      <div style={{ opacity: subOp, transform: `translateY(${subY}px)`, fontSize: 16, color: subColor, marginBottom: 30 }}>No credit card required · Cancel anytime</div>
      <div style={{ opacity: btnOp, background: `linear-gradient(135deg, ${C.violet600}, ${C.violet700})`, color: C.white, fontSize: 18, fontWeight: 800, padding: "16px 44px", borderRadius: 99, letterSpacing: "0.02em", boxShadow: "0 10px 40px rgba(124,58,237,0.5)", marginBottom: 24 }}>
        Start 7-Day Free Trial
      </div>
      <div style={{ opacity: urlOp, fontSize: 15, color: urlColor, letterSpacing: "0.06em", fontWeight: 600 }}>mailmark.dev</div>
    </AbsoluteFill>
  );
}

// ─── Scene transition ─────────────────────────────────────────────────────────
function SceneTransition({ from, duration = 18 }: { from: number; duration?: number }) {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [from, from + duration / 2, from + duration], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (op <= 0) return null;
  return <AbsoluteFill style={{ background: C.black, opacity: op, pointerEvents: "none" }} />;
}

// ════════════════════════════════════════════════════════════════════════════════
// Root composition  (total: 1620 frames = 54 seconds @ 30fps)
// ════════════════════════════════════════════════════════════════════════════════
export const MailmarkVideo: React.FC<{ theme?: "light" | "dark" }> = ({ theme = "dark" }) => {
  return (
    <AbsoluteFill style={{ background: "transparent" }}>
      <Sequence from={0} durationInFrames={75}><SceneIntro theme={theme} /></Sequence>
      <Sequence from={75} durationInFrames={120}><SceneHero theme={theme} /></Sequence>
      <Sequence from={195} durationInFrames={330}><SceneAddDomain theme={theme} /></Sequence>
      <Sequence from={525} durationInFrames={240}><SceneCreateMailboxes theme={theme} /></Sequence>
      <Sequence from={765} durationInFrames={300}><SceneSendEmail theme={theme} /></Sequence>
      <Sequence from={1065} durationInFrames={300}><SceneSendAsCampaign theme={theme} /></Sequence>
      <Sequence from={1365} durationInFrames={165}><ScenePricing theme={theme} /></Sequence>
      <Sequence from={1530} durationInFrames={90}><SceneCTA theme={theme} /></Sequence>

      <SceneTransition from={73} />
      <SceneTransition from={193} />
      <SceneTransition from={523} />
      <SceneTransition from={763} />
      <SceneTransition from={1063} />
      <SceneTransition from={1363} />
      <SceneTransition from={1528} />
    </AbsoluteFill>
  );
};
