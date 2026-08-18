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
  /* Never let the iframe scroll its own document. The parent auto-sizes the
     iframe to the content height and the app's reading pane provides the only
     scrollbar; without this a slightly-short measured height makes the iframe
     render a second, nested scrollbar next to the pane's. */
  html, body { margin: 0; padding: 0; overflow: hidden; }
  body {
    background: #ffffff;
    color: #1f2937;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  /* Padding lives on a wrapper we measure directly, so the measured height
     always includes it (padding on <body> can be dropped by scrollHeight). */
  #mm-email-content { padding: 4px; }
  img { max-width: 100%; height: auto; }
  a { color: #7c3aed; }
  table { max-width: 100%; }
  pre { white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body><div id="mm-email-content">${html}</div></body>
</html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let observer: ResizeObserver | null = null;

    const measure = () => {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      // Measure the content wrapper's rendered box (padding included) rather
      // than body.scrollHeight, which can round down and undershoot by a few
      // pixels; that undershoot is what made the iframe scroll itself.
      const wrapper = doc.getElementById("mm-email-content");
      const next = Math.max(
        wrapper ? Math.ceil(wrapper.getBoundingClientRect().height) : 0,
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight
      );
      // +1px guards against sub-pixel rounding forcing a nested scrollbar.
      if (next > 0) setHeight(next + 1);
    };

    const handleLoad = () => {
      measure();
      const doc = iframe.contentDocument;
      if (!doc) return;
      // Images arrive after initial layout and change the height.
      doc.querySelectorAll("img").forEach((img) => {
        if (!img.complete) img.addEventListener("load", measure, { once: true });
      });
      // Catch late reflows (web fonts, slow images). Observe the content
      // wrapper directly so padding-box growth is picked up too.
      if (typeof ResizeObserver !== "undefined") {
        observer?.disconnect();
        observer = new ResizeObserver(measure);
        const wrapper = doc.getElementById("mm-email-content");
        observer.observe(wrapper ?? doc.body);
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
      // Deprecated but still honored by every browser; belt-and-suspenders so
      // the iframe never shows its own scrollbar even if a measure lags.
      scrolling="no"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700"
      style={{ height, colorScheme: "light" }}
    />
  );
}
