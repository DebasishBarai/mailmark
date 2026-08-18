"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a received email's HTML inside a sandboxed iframe on a fixed white
 * background, isolated from the app's light/dark theme.
 *
 * Third-party marketing emails ship their own colors and backgrounds, authored
 * for a white email-client reading pane. When that HTML is injected directly
 * into an app-themed container, its colors clash with whichever theme is active
 * (e.g. light-on-light becomes unreadable). Isolating it in an iframe on a
 * neutral white background makes every email render the way its author intended,
 * consistently in both app themes, the same way Gmail/Outlook display email.
 *
 * The iframe is sandboxed WITHOUT `allow-scripts`, so no script in the email
 * body executes. `allow-same-origin` is granted only so the parent can read the
 * rendered height to auto-size the frame; combined without `allow-scripts` it
 * cannot be used to reach back into the app.
 */
export default function EmailBodyFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const srcDoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    background: #ffffff;
    color: #1f2937;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    padding: 4px;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  img { max-width: 100%; height: auto; }
  a { color: #7c3aed; }
  table { max-width: 100%; }
  pre { white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>${html}</body>
</html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let observer: ResizeObserver | null = null;

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      // Reset so the body reports its natural height, not the frame's.
      const next = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight
      );
      if (next > 0) setHeight(next);
    };

    const handleLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (!doc) return;
      // Images arrive after initial layout and change the height.
      doc.querySelectorAll("img").forEach((img) => {
        if (!img.complete) img.addEventListener("load", measure, { once: true });
      });
      // Catch late reflows (web fonts, slow images).
      if (typeof ResizeObserver !== "undefined" && doc.body) {
        observer?.disconnect();
        observer = new ResizeObserver(measure);
        observer.observe(doc.body);
      }
    };

    iframe.addEventListener("load", handleLoad);
    // srcDoc may already be applied before this effect runs.
    if (iframe.contentDocument?.readyState === "complete") handleLoad();

    return () => {
      iframe.removeEventListener("load", handleLoad);
      observer?.disconnect();
    };
  }, [srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="Email content"
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
      style={{ height, colorScheme: "light" }}
    />
  );
}
