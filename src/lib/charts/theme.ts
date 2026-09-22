/* ==========================================================================
   theme.ts  -  chart colours straight from the design tokens
   A canvas cannot resolve `var(--blue)`, so the charts read the computed
   custom properties at runtime. That keeps a chart in step with the rest of
   the app (including the dark theme) instead of hard-coding a second palette.
   ========================================================================== */

export const CHART_FALLBACK = {
  blue400: "#2490FF",
  blue700: "#0059C8",
  moss: "#0E9F5E",
  clay: "#C0272D",
  gold: "#CB914D",
  ink3: "#7A8698",
  rule: "#E5E8EE",
  panel: "#FFFFFF",
} as const;

/** Resolve a CSS custom property, falling back while server rendering. */
export function cssToken(name: string, fallback: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function chartPalette() {
  return {
    blue: cssToken("--blue-400", CHART_FALLBACK.blue400),
    blueDeep: cssToken("--blue-700", CHART_FALLBACK.blue700),
    moss: cssToken("--moss", CHART_FALLBACK.moss),
    clay: cssToken("--clay", CHART_FALLBACK.clay),
    gold: cssToken("--gold", CHART_FALLBACK.gold),
    ink3: cssToken("--ink-3", CHART_FALLBACK.ink3),
    rule: cssToken("--rule", CHART_FALLBACK.rule),
    panel: cssToken("--panel", CHART_FALLBACK.panel),
  };
}

export type ChartPalette = ReturnType<typeof chartPalette>;
