"use client";

import * as React from "react";
import { Icon } from "@/lib/discovery/components/Icon";
import { DEVICES, type DeviceName } from "./devices";

/**
 * Instagram's chrome, not Stashh UI: its colours and metrics are copied from the
 * app, so they are deliberately not Discovery tokens. The header is iOS's 44pt bar.
 */
const IG = {
  header: 44,
  background: "#FFFFFF",
  text: "#000000",
  secondary: "#737373",
  hairline: "#DBDBDB",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  title: "Stashh",
  domain: "stashh.me",
} as const;

/** iOS status bar and home indicator metrics, in points. */
const ISLAND = { top: 11, width: 126, height: 37 } as const;
const HOME_INDICATOR = { width: 134, height: 5, bottom: 8 } as const;
/** Room kept around the phone when it is scaled down to fit the window. */
const FIT_MARGIN = 16;
/** The stylesheet that carries the home-bar inset into the frame. */
const INSET_STYLE_ID = "iab-preview-inset";

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** The phone at real size, shrunk only when the window is smaller than the screen. */
function useFitScale(width: number, height: number): number {
  const getSnapshot = React.useCallback(
    () => Math.min(1, (window.innerWidth - 2 * FIT_MARGIN) / width, (window.innerHeight - 2 * FIT_MARGIN) / height),
    [width, height],
  );
  return React.useSyncExternalStore(subscribeResize, getSnapshot, () => 1);
}

/**
 * Stashh as a DM link opens it: inside Instagram's iOS in-app browser. The frame
 * is exactly the webview — the screen minus the status bar and Instagram's header —
 * and the server reads it as Instagram on an iPhone (`lib/platform/dev-preview.ts`).
 */
export function InstagramBrowser({ device: name, bottomInset }: { device: DeviceName; bottomInset?: number }) {
  const device = DEVICES[name];
  const inset = bottomInset ?? device.homeBar;
  const scale = useFitScale(device.width, device.height);

  // A framed document cannot read this page's env(); hand it the home-bar inset
  // the webview reports. A stylesheet in its head, not an inline style on <html>,
  // so the frame's own hydration is untouched. Applied on mount too, in case it
  // loaded before this page hydrated.
  const applyInset = React.useCallback(
    (frame: HTMLIFrameElement | null) => {
      const doc = frame?.contentDocument;
      if (!doc?.head) return;
      const style = doc.getElementById(INSET_STYLE_ID) ?? doc.head.appendChild(Object.assign(doc.createElement("style"), { id: INSET_STYLE_ID }));
      style.textContent = `:root { --safe-area-bottom: ${inset}px; }`;
    },
    [inset],
  );

  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", background: "var(--bone-300)" }}>
      <div style={{ width: device.width * scale, height: device.height * scale }}>
        <div
          style={{
            position: "relative",
            width: device.width,
            height: device.height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: device.corner,
            background: IG.background,
            boxShadow: "var(--sh-float)",
            fontFamily: IG.font,
            color: IG.text,
          }}
        >
          <StatusBar height={device.statusBar} island={device.island} />
          <Header />
          <iframe
            ref={applyInset}
            onLoad={(event) => applyInset(event.currentTarget)}
            title={IG.title}
            src="/app"
            style={{ flex: 1, width: "100%", border: 0, display: "block" }}
          />
          {device.homeBar ? <HomeIndicator /> : null}
        </div>
      </div>
    </div>
  );
}

function StatusBar({ height, island }: { height: number; island: boolean }) {
  // Island phones centre the time and icons on the island; older ones fill a 20pt bar.
  const row = island ? { top: ISLAND.top, height: ISLAND.height, inline: 34, font: 17, icon: 17 } : { top: 0, height, inline: 8, font: 12, icon: 12 };
  return (
    <div aria-hidden="true" style={{ position: "relative", flex: "0 0 auto", height }}>
      <div
        style={{
          position: "absolute",
          top: row.top,
          left: row.inline,
          right: row.inline,
          height: row.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: row.font,
          fontWeight: 600,
        }}
      >
        <span>9:41</span>
        <span style={{ display: "flex", gap: 5 }}>
          <Icon name="signal" size={row.icon} />
          <Icon name="wifi" size={row.icon} />
          <Icon name="battery-full" size={row.icon + 6} />
        </span>
      </div>
      {island ? (
        <div
          style={{
            position: "absolute",
            top: ISLAND.top,
            left: "50%",
            width: ISLAND.width,
            height: ISLAND.height,
            transform: "translateX(-50%)",
            borderRadius: ISLAND.height,
            background: IG.text,
          }}
        />
      ) : null}
    </div>
  );
}

/** Close on the left, the page title over its domain, the overflow menu on the right. */
function Header() {
  return (
    <div
      aria-hidden="true"
      style={{
        flex: "0 0 auto",
        height: IG.header,
        display: "grid",
        gridTemplateColumns: `${IG.header}px 1fr ${IG.header}px`,
        alignItems: "center",
        justifyItems: "center",
        padding: "0 4px",
        borderBottom: `0.5px solid ${IG.hairline}`,
      }}
    >
      <Icon name="x" size={24} />
      <div style={{ minWidth: 0, textAlign: "center", lineHeight: 1.2 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{IG.title}</div>
        <div style={{ fontSize: 12, color: IG.secondary }}>{IG.domain}</div>
      </div>
      <Icon name="ellipsis" size={24} />
    </div>
  );
}

function HomeIndicator() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        bottom: HOME_INDICATOR.bottom,
        left: "50%",
        width: HOME_INDICATOR.width,
        height: HOME_INDICATOR.height,
        transform: "translateX(-50%)",
        borderRadius: HOME_INDICATOR.height,
        background: IG.text,
        pointerEvents: "none",
      }}
    />
  );
}
