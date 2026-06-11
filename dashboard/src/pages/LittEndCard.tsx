/**
 * LittEndCard.tsx
 * ----------------------------------------------------------------------------
 * Litt — demo-video splash / end card. A fixed 1920×1080 composition that
 * auto-scales to fit whatever container you drop it in (letterboxed on the
 * card's own dark background).
 *
 * REQUIREMENTS
 *  1. Fonts — IBM Plex Sans + IBM Plex Mono must be available. By default this
 *     component injects the Google Fonts <link> once; pass injectFonts={false}
 *     if your app already loads them.
 *  2. Image assets — the off-white logo + tech icons are referenced by URL.
 *     Drop these files somewhere static and pass the paths (or override the
 *     defaults below):
 *        /assets/litt_logo_cream_lg.png   (cream wordmark, transparent)
 *        /assets/tech/adk.png
 *        /assets/tech/gemini.png          (Gemini sparkle)
 *        /assets/tech/cloudrun.png
 *        /assets/tech/firestore.png
 *        /assets/tech/cloudtrace.png
 *     In a Vite/CRA app you can also `import logo from './litt-logo.png'` and
 *     pass it as logoSrc={logo}.
 *
 * USAGE
 *   <div style={{ width: '100vw', height: '100vh' }}>
 *     <LittEndCard />
 *   </div>
 * ----------------------------------------------------------------------------
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/* ── types ─────────────────────────────────────────────────────────────── */
export interface TechItem {
  /** Product name (primary label). */
  name: string;
  /** Optional secondary line, e.g. "Vertex AI". */
  sub?: string;
  /** URL/path to an off-white (cream) monochrome icon. */
  icon: string;
}

export interface LittEndCardProps {
  /** Cream Litt wordmark (transparent PNG). */
  logoSrc?: string;
  /** Tagline under the logo. Accepts rich nodes (use <strong> to emphasise). */
  tagline?: React.ReactNode;
  /** Label above the tech row. */
  stackLabel?: string;
  /** The tech-stack tiles. */
  techStack?: TechItem[];
  /** Footer brand word (left of the dot). */
  footerBrand?: string;
  /** Footer slogan (right of the dot). */
  footerSlogan?: string;
  /** Scale the 1920×1080 stage to fit the parent container. Default true. */
  fit?: boolean;
  /** Play the staggered entrance animation. Default true. */
  animate?: boolean;
  /** Inject the IBM Plex Google Fonts <link> once. Default true. */
  injectFonts?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/* ── defaults ──────────────────────────────────────────────────────────── */
const DEFAULT_LOGO = "/assets/litt_logo_cream_lg.png";

const DEFAULT_TECH: TechItem[] = [
  { name: "Google ADK", sub: "Agent Dev Kit", icon: "/assets/tech/adk.png" },
  { name: "Gemini 2.5 Pro", sub: "Vertex AI", icon: "/assets/tech/gemini.png" },
  { name: "Cloud Run", icon: "/assets/tech/cloudrun.png" },
  { name: "Firestore", icon: "/assets/tech/firestore.png" },
  { name: "Cloud Trace", icon: "/assets/tech/cloudtrace.png" },
];

const DEFAULT_TAGLINE = (
  <>
    Autonomous operations agent for <strong>solo attorneys</strong> and{" "}
    <strong>small law firms</strong>.
  </>
);

const STAGE_W = 1920;
const STAGE_H = 1080;

/* ── scoped stylesheet ─────────────────────────────────────────────────── */
const CSS = `
.lec-root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #07100d;
  display: flex; align-items: center; justify-content: center;
  font-family: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
.lec-stage { position: relative; width: ${STAGE_W}px; height: ${STAGE_H}px; flex-shrink: 0; }
.lec-card {
  --ink: #ECEAE0; --ink-2: #A7B3AC; --ink-3: #70807A; --teal: #5DCAA5;
  --hair: rgba(255,255,255,.10); --hair-2: rgba(255,255,255,.16);
  --surface: rgba(24,34,31,.62);
  position: relative; width: 100%; height: 100%; overflow: hidden; color: var(--ink);
  background: radial-gradient(120% 80% at 50% -12%, #15271f 0%, #0e1c17 48%, #09120e 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 96px;
}
.lec-card::before { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(46% 38% at 50% 34%, rgba(93,202,165,.13), transparent 70%); }
.lec-card::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background: radial-gradient(60% 50% at 100% 100%, rgba(143,188,238,.06), transparent 60%),
              radial-gradient(50% 50% at 0% 100%, rgba(93,202,165,.05), transparent 60%); }
.lec-frame { position: absolute; inset: 40px; border: 1px solid var(--hair); border-radius: 18px; pointer-events: none; }
.lec-corner { position: absolute; width: 18px; height: 18px; border: 2px solid var(--teal); opacity: .55; }
.lec-corner.tl { top: 52px; left: 52px; border-right: none; border-bottom: none; }
.lec-corner.tr { top: 52px; right: 52px; border-left: none; border-bottom: none; }
.lec-corner.bl { bottom: 52px; left: 52px; border-right: none; border-top: none; }
.lec-corner.br { bottom: 52px; right: 52px; border-left: none; border-top: none; }
.lec-center { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; text-align: center; }
.lec-logo { height: 214px; width: auto; display: block; filter: drop-shadow(0 8px 40px rgba(0,0,0,.35)); }
.lec-tagline { margin-top: 52px; font-size: 34px; font-weight: 400; letter-spacing: -.3px; line-height: 1.4;
  color: var(--ink); max-width: 1140px; text-wrap: balance; }
.lec-tagline strong { font-weight: 600; }
.lec-rule { margin-top: 58px; width: 148px; height: 1px; position: relative;
  background: linear-gradient(90deg, transparent, rgba(225,236,230,.34) 16%, rgba(225,236,230,.34) 84%, transparent); }
.lec-rule::after { content: ""; position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; border-radius: 50%;
  transform: translate(-50%,-50%); background: #74D7B4; box-shadow: 0 0 0 4px rgba(93,202,165,.22); }
.lec-stack { margin-top: 62px; display: flex; flex-direction: column; align-items: center; gap: 30px; }
.lec-stack-label { font-family: "IBM Plex Mono", monospace; font-size: 18px; font-weight: 500; letter-spacing: 3.4px;
  text-transform: uppercase; color: #C6CFC9; }
.lec-techrow { display: flex; align-items: flex-start; gap: 34px; }
.lec-tech { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 168px; }
.lec-tech-tile { width: 104px; height: 104px; border-radius: 20px; border: 1px solid var(--hair); background: var(--surface);
  display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.22); }
.lec-tech-icon { width: 58px; height: 58px; object-fit: contain; display: block; }
.lec-tech-name { font-size: 17px; font-weight: 500; letter-spacing: -.1px; color: var(--ink-2); line-height: 1.25; text-align: center; }
.lec-tech-name span { display: block; font-size: 13px; color: var(--ink-3); font-weight: 400; margin-top: 3px; }
.lec-foot { position: absolute; left: 0; right: 0; bottom: 104px; z-index: 2; display: flex; align-items: center;
  justify-content: center; gap: 20px; font-family: "IBM Plex Mono", monospace; font-size: 18px; letter-spacing: 2px;
  text-transform: uppercase; color: #C6CFC9; }
.lec-foot .lec-dot { width: 6px; height: 6px; border-radius: 50%; background: #C6CFC9; }
@media (prefers-reduced-motion: no-preference) {
  .lec-animate .lec-rise { opacity: 0; transform: translateY(14px);
    animation: lecRise .8s cubic-bezier(.2,.7,.3,1) forwards; animation-delay: var(--d, 0ms); }
  @keyframes lecRise { to { opacity: 1; transform: none; } }
}
`;

/* ── one-time <head> injectors ─────────────────────────────────────────── */
function useInjectOnce(id: string, make: () => HTMLElement, enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    if (document.getElementById(id)) return;
    const el = make();
    el.id = id;
    document.head.appendChild(el);
  }, [id, enabled]);
}

/* ── fit-to-container scaler ───────────────────────────────────────────── */
function useFitScale(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width && height) setScale(Math.min(width / STAGE_W, height / STAGE_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [enabled]);
  return { ref, scale };
}

/* ── component ─────────────────────────────────────────────────────────── */
export default function LittEndCard({
  logoSrc = DEFAULT_LOGO,
  tagline = DEFAULT_TAGLINE,
  stackLabel = "Built on Google Cloud",
  techStack = DEFAULT_TECH,
  footerBrand = "Litt",
  footerSlogan = "Less ops. More law.",
  fit = true,
  animate = true,
  injectFonts = true,
  className,
  style,
}: LittEndCardProps) {
  useInjectOnce(
    "lec-styles",
    () => {
      const s = document.createElement("style");
      s.textContent = CSS;
      return s;
    },
    true
  );
  useInjectOnce(
    "lec-fonts",
    () => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
      return l;
    },
    injectFonts
  );

  const { ref, scale } = useFitScale(fit);

  const stageStyle: React.CSSProperties = fit
    ? { transform: `scale(${scale})`, transformOrigin: "center center" }
    : {};

  return (
    <div
      ref={ref}
      className={`lec-root${animate ? " lec-animate" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      <div className="lec-stage" style={stageStyle}>
        <div className="lec-card">
          <div className="lec-frame" />
          <span className="lec-corner tl" />
          <span className="lec-corner tr" />
          <span className="lec-corner bl" />
          <span className="lec-corner br" />

          <div className="lec-center">
            <img
              className="lec-logo lec-rise"
              src={logoSrc}
              alt={footerBrand}
              style={{ ["--d" as any]: "60ms" }}
            />
            <div className="lec-tagline lec-rise" style={{ ["--d" as any]: "240ms" }}>
              {tagline}
            </div>
            <div className="lec-rule lec-rise" style={{ ["--d" as any]: "420ms" }} />

            <div className="lec-stack lec-rise" style={{ ["--d" as any]: "560ms" }}>
              <div className="lec-stack-label">{stackLabel}</div>
              <div className="lec-techrow">
                {techStack.map((t) => (
                  <div className="lec-tech" key={t.name}>
                    <div className="lec-tech-tile">
                      <img className="lec-tech-icon" src={t.icon} alt={t.name} />
                    </div>
                    <div className="lec-tech-name">
                      {t.name}
                      {t.sub ? <span>{t.sub}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lec-foot lec-rise" style={{ ["--d" as any]: "760ms" }}>
            <span>{footerBrand}</span>
            <span className="lec-dot" />
            <span>{footerSlogan}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
