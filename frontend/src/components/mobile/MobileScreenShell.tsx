import React from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// MobileScreenShell — the one way a mobile screen sizes itself and coordinates
// with the bottom tab bar.
//
// Every mobile screen used to reinvent this independently: some sized the
// root with `min-h-screen` and pinned a `position: fixed` header/nav to the
// viewport edges (relying on padding to avoid overlap), others used `h-dvh`
// with everything in normal flex flow. Three separate bugs traced back to
// this divergence (icon-chip contrast, tab-bar/panel gap during scroll, the
// tab-bar leveling regression) before the underlying cause was found: with
// no screen "owning" document scroll, the document itself was still
// scrollable, and only screens with a `position: fixed` element glued to the
// true viewport edge happened to visually mask that rubber-band bounce.
// `html`/`body`/`#root` are now locked to never scroll (see index.css) —
// this shell is the only scroll boundary every mobile screen should use.
//
// `header`, `footer`, and `tabBar` are normal flex children (shrink-0),
// never `position: fixed`. `children` is the one scrollable region.
// ──────────────────────────────────────────────────────────────────────────────

export interface MobileScreenShellProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  /** Shrink-0 panel between the scroll region and the tab bar, e.g. MobilePOS's checkout panel. */
  footer?: React.ReactNode;
  /** Fused as the literal last flex child — never render this in a separate `position: fixed` sibling. */
  tabBar?: React.ReactNode;
  contentClassName?: string;
  className?: string;
}

export function MobileScreenShell({
  header,
  children,
  footer,
  tabBar,
  contentClassName = '',
  className = '',
}: MobileScreenShellProps) {
  return (
    <div className={`h-dvh flex flex-col overflow-hidden ${className}`}>
      {header}
      <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${contentClassName}`}>
        {children}
      </div>
      {footer}
      {tabBar}
    </div>
  );
}
