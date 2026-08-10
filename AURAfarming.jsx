import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Bug, Leaf, Droplets, Map as MapIcon, Cpu, Settings as SettingsIcon,
  Upload, Image as ImageIcon, Camera, Play, CheckCircle2, AlertTriangle, AlertCircle,
  Wifi, Battery, Sun, Thermometer, Activity, TrendingUp, Sprout, Zap, ChevronRight,
  X, Radio, MapPin, Info, Loader2, ScanLine, Gauge, FlaskConical, Beaker, Signal,
  ArrowRight, CircleDot
} from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Cell
} from "recharts";

/* =========================================================================
   AURAfarming — simulated smart-farming AI platform demo
   Design tokens:
   - bg-void:      #090E0B   (near-black, faint green cast)
   - bg-surface:   rgba(255,255,255,0.035) glass panels on #0E1611
   - accent-aura:  #7EEBA6   (bioluminescent green — AI presence)
   - accent-amber: #F3B65C   (moderate / attention)
   - accent-red:   #F0716A   (critical / risk)
   - accent-soil:  #C99A62   (earthen — soil module)
   - accent-azure: #6FC3E4   (soil moisture / water)
   - text-hi:      #EAF2EC
   - text-lo:      #8CA096
   - display font: 'Space Grotesk'   body: 'Inter'   mono: 'JetBrains Mono'
   ========================================================================= */

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

const F = {
  display: "'Space Grotesk', 'Inter', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const COLORS = {
  void: "#090E0B",
  surface: "#0F1712",
  surfaceHi: "#131C16",
  border: "rgba(234,242,236,0.08)",
  borderHi: "rgba(126,235,166,0.35)",
  aura: "#7EEBA6",
  auraDim: "rgba(126,235,166,0.15)",
  amber: "#F3B65C",
  red: "#F0716A",
  soil: "#C99A62",
  azure: "#6FC3E4",
  hi: "#EAF2EC",
  lo: "#8CA096",
  loDim: "#5B6C63",
};

/* ---------------------------- deterministic PRNG ---------------------------- */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFromSeed(seedStr) {
  return mulberry32(hashString(seedStr));
}

/* ---------------------------- sample data ---------------------------- */
const CROPS = ["Tomato", "Corn", "Soybean", "Wheat", "Lettuce"];

const PEST_LIBRARY = [
  { species: "Aphid", baseRisk: "Moderate", note: "Sap-feeding insects that cluster on new growth and can transmit plant viruses." },
  { species: "Whitefly", baseRisk: "Moderate", note: "Tiny sap-feeders that congregate on leaf undersides; heavy infestations weaken plants." },
  { species: "Caterpillar", baseRisk: "Low", note: "Larvae that chew foliage; isolated activity is usually manageable by hand removal." },
  { species: "Beetle", baseRisk: "High", note: "Can cause rapid defoliation if populations are left unchecked." },
];

const DISEASE_LIBRARY = [
  { name: "Tomato Early Blight", crop: "Tomato", explanation: "Characteristic concentric lesions and yellowing consistent with early blight, typically starting on lower, older leaves.", action: "Remove heavily affected leaves and improve airflow around plants. Monitor surrounding plants for similar symptoms." },
  { name: "Septoria Leaf Spot", crop: "Tomato", explanation: "Numerous small circular spots with dark margins and pale centers, a signature pattern of Septoria infection.", action: "Prune lower foliage, avoid overhead watering, and apply a labeled fungicide if spread continues." },
  { name: "Powdery Mildew", crop: "Wheat", explanation: "A talc-like white coating across the leaf surface, characteristic of powdery mildew under humid, low-airflow conditions.", action: "Increase plant spacing for airflow and apply a sulfur-based or approved fungicide at first sign of spread." },
  { name: "Late Blight", crop: "Potato", explanation: "Dark, water-soaked lesions with pale sporulation at the margins, consistent with late blight under cool, wet conditions.", action: "Isolate and remove infected plants immediately; late blight spreads quickly in humid conditions." },
  { name: "Healthy Foliage", crop: "Lettuce", explanation: "Uniform pigmentation, intact leaf margins, and no lesion patterns detected across the sampled tissue.", action: "No action needed. Continue routine monitoring on the standard scan interval." },
];

const FIELDS = [
  { id: "F-01", name: "Field 01", crop: "Tomato", health: 94, pestRisk: "Low", diseaseRisk: "Low", soil: 82, lastScan: "6 minutes ago", x: 18, y: 26, status: "healthy" },
  { id: "F-02", name: "Field 02", crop: "Corn", health: 88, pestRisk: "Low", diseaseRisk: "Moderate", soil: 76, lastScan: "11 minutes ago", x: 46, y: 18, status: "healthy" },
  { id: "F-03", name: "Field 03", crop: "Tomato", health: 79, pestRisk: "Moderate", diseaseRisk: "Moderate", soil: 71, lastScan: "12 minutes ago", x: 70, y: 30, status: "attention" },
  { id: "F-04", name: "Field 04", crop: "Soybean", health: 91, pestRisk: "Low", diseaseRisk: "Low", soil: 85, lastScan: "4 minutes ago", x: 24, y: 58, status: "healthy" },
  { id: "F-05", name: "Field 05", crop: "Wheat", health: 58, pestRisk: "High", diseaseRisk: "Moderate", soil: 63, lastScan: "2 minutes ago", x: 55, y: 66, status: "critical" },
  { id: "F-06", name: "Field 06", crop: "Lettuce", health: 96, pestRisk: "Low", diseaseRisk: "Low", soil: 88, lastScan: "19 minutes ago", x: 80, y: 72, status: "healthy" },
];

const INITIAL_FEED = [
  { id: 1, text: "Tomato #A-104 analyzed \u2014 healthy", time: "2m ago", icon: "leaf", tone: "aura" },
  { id: 2, text: "Possible aphid activity detected \u2014 Field 03", time: "9m ago", icon: "bug", tone: "amber" },
  { id: 3, text: "Soil sample #23 analyzed \u2014 Field 04", time: "14m ago", icon: "droplet", tone: "azure" },
  { id: 4, text: "Leaf disease scan completed \u2014 no issues found", time: "22m ago", icon: "leaf", tone: "aura" },
  { id: 5, text: "AURA Field Node 02 came online", time: "41m ago", icon: "radio", tone: "lo" },
  { id: 6, text: "Wheat #W-018 flagged for beetle pressure", time: "1h ago", icon: "bug", tone: "red" },
];

/* ---------------------------- simulated inference services ----------------------------
   In production these would be replaced by calls to a hosted model / FastAPI backend.
   services/pestModel.ts, services/diseaseModel.ts, services/soilModel.ts
------------------------------------------------------------------------------------ */
function runPestModel(seedKey) {
  const rng = rngFromSeed("pest:" + seedKey);
  const pest = PEST_LIBRARY[Math.floor(rng() * PEST_LIBRARY.length)];
  const count = 1 + Math.floor(rng() * 5);
  const clusters = rng() > 0.55 ? 1 + Math.floor(rng() * 2) : 0;
  const confidence = 88 + rng() * 11;
  const riskOrder = ["Low", "Moderate", "High"];
  let riskIdx = riskOrder.indexOf(pest.baseRisk);
  if (count >= 4) riskIdx = Math.min(2, riskIdx + 1);
  const risk = riskOrder[riskIdx];
  const boxes = Array.from({ length: count }).map((_, i) => {
    const bx = 8 + rng() * 78;
    const by = 10 + rng() * 72;
    const bw = 7 + rng() * 6;
    const bh = 7 + rng() * 6;
    return { x: bx, y: by, w: bw, h: bh, confidence: 80 + rng() * 19 };
  });
  const crop = CROPS[Math.floor(rng() * CROPS.length)];
  const recMap = {
    Low: "Populations are within a manageable range. Continue routine monitoring.",
    Moderate: "Early intervention recommended. Populations can spread rapidly and may transmit plant viruses.",
    High: "Intervention recommended promptly \u2014 consider targeted treatment before the infestation spreads to neighboring rows.",
  };
  return {
    species: pest.species,
    note: pest.note,
    confidence: Number(confidence.toFixed(1)),
    count,
    clusters,
    risk,
    crop,
    boxes,
    recommendation: recMap[risk],
    inferenceTime: (0.31 + rng() * 0.28).toFixed(2),
  };
}

function runDiseaseModel(seedKey) {
  const rng = rngFromSeed("disease:" + seedKey);
  const primaryIdx = Math.floor(rng() * DISEASE_LIBRARY.length);
  const primary = DISEASE_LIBRARY[primaryIdx];
  const isHealthy = primary.name === "Healthy Foliage";
  const confidence = isHealthy ? 97 + rng() * 2.5 : 90 + rng() * 8.5;
  const affected = isHealthy ? Number((rng() * 2).toFixed(1)) : Number((8 + rng() * 30).toFixed(1));
  const severity = affected < 10 ? "Minor" : affected < 25 ? "Moderate" : "Severe";
  const others = DISEASE_LIBRARY.filter((_, i) => i !== primaryIdx)
    .sort(() => rng() - 0.5)
    .slice(0, 2)
    .map((d) => ({ name: d.name, confidence: Number((rng() * (100 - confidence) * 0.6).toFixed(1)) }));
  const remainder = Math.max(0, 100 - confidence - others.reduce((s, o) => s + o.confidence, 0));
  const alternatives = [{ name: primary.name, confidence: Number(confidence.toFixed(1)) }, ...others, { name: "Other", confidence: Number(remainder.toFixed(1)) }]
    .sort((a, b) => b.confidence - a.confidence);
  const heatmapRegions = isHealthy ? [] : Array.from({ length: 3 + Math.floor(rng() * 4) }).map(() => ({
    cx: 15 + rng() * 70,
    cy: 15 + rng() * 70,
    r: 6 + rng() * 10,
    intensity: 0.35 + rng() * 0.5,
  }));
  return {
    diagnosis: primary.name,
    crop: primary.crop,
    confidence: Number(confidence.toFixed(1)),
    severity: isHealthy ? "None" : severity,
    affected,
    healthy: Number((100 - affected).toFixed(1)),
    explanation: primary.explanation,
    recommendation: primary.action,
    alternatives,
    heatmapRegions,
    isHealthy,
    inferenceTime: (0.24 + rng() * 0.19).toFixed(2),
  };
}

function runSoilModel(values) {
  const { moisture, ph, nitrogen, phosphorus, potassium, organic, temperature } = values;
  const phScore = 100 - Math.min(100, Math.abs(ph - 6.5) * 28);
  const score = Math.round(
    moisture * 0.2 + nitrogen * 0.2 + phosphorus * 0.15 + potassium * 0.15 +
    organic * 8 * 0.15 + phScore * 0.15
  );
  const clamped = Math.max(0, Math.min(100, score));
  const category = clamped >= 80 ? "Excellent" : clamped >= 65 ? "Good" : clamped >= 45 ? "Fair" : "Poor";

  const suitability = {
    Tomato: clampPct(0.32 * moisture + 0.22 * nitrogen + 0.18 * potassium + 0.28 * phScore - Math.abs(ph - 6.4) * 4),
    Corn: clampPct(0.28 * moisture + 0.32 * nitrogen + 0.15 * phosphorus + 0.25 * phScore - Math.abs(ph - 6.2) * 4),
    Wheat: clampPct(0.22 * moisture + 0.22 * nitrogen + 0.2 * potassium + 0.36 * phScore - Math.abs(ph - 6.8) * 4),
    Soybean: clampPct(0.26 * moisture + 0.18 * nitrogen + 0.28 * phosphorus + 0.28 * phScore - Math.abs(ph - 6.5) * 4),
  };

  const issues = [];
  if (phosphorus < 50) issues.push("slightly low phosphorus");
  if (nitrogen < 45) issues.push("low nitrogen");
  if (potassium < 45) issues.push("low potassium");
  if (moisture < 40) issues.push("low soil moisture");
  if (moisture > 88) issues.push("excess moisture, risking root stress");
  if (ph < 5.8) issues.push("acidic pH");
  if (ph > 7.3) issues.push("alkaline pH");
  if (organic < 3) issues.push("low organic matter");

  let recommendation;
  if (issues.length === 0) {
    recommendation = "Your soil profile is well balanced across nutrients, pH, and moisture. Maintain current practices and continue routine sampling.";
  } else {
    const strengths = [];
    if (potassium >= 65) strengths.push("adequate potassium");
    if (moisture >= 60 && moisture <= 88) strengths.push("healthy moisture");
    if (nitrogen >= 65) strengths.push("strong nitrogen levels");
    const strengthText = strengths.length ? `Your soil has ${strengths.join(" and ")} but ${issues.join(" and ")}.` : `Your soil shows ${issues.join(" and ")}.`;
    recommendation = `${strengthText} Consider a targeted amendment before the next planting cycle.`;
  }

  return { score: clamped, category, suitability, recommendation, issues };
}
function clampPct(n) { return Math.max(4, Math.min(99, Math.round(n))); }

/* ---------------------------- procedurally generated sample imagery ----------------------------
   Generates a synthetic crop/leaf photo entirely on <canvas> so the demo needs zero external
   image assets. A real deployment would swap this for camera captures from the AURA Field Node.
------------------------------------------------------------------------------------------------ */
function generateSampleImage(kind, seedKey) {
  const rng = rngFromSeed(kind + ":" + seedKey);
  const w = 640, h = 480;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");

  const gTop = kind === "disease" ? "#3c5a3a" : "#2f4a30";
  const gBot = kind === "disease" ? "#1c2c1c" : "#182518";
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, gTop);
  grad.addColorStop(1, gBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // soil texture speckles
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, rng() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // draw a cluster of leaves
  const leafCount = kind === "disease" ? 5 : 7;
  for (let i = 0; i < leafCount; i++) {
    const cx = w * 0.5 + (rng() - 0.5) * w * 0.7;
    const cy = h * 0.55 + (rng() - 0.5) * h * 0.55;
    const scale = 55 + rng() * 60;
    const rot = rng() * Math.PI * 2;
    drawLeaf(ctx, cx, cy, scale, rot, kind === "disease" && rng() > 0.35);
  }

  // pests: small dark ellipses with legs, scattered on leaves
  if (kind === "pest") {
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const px = w * 0.3 + rng() * w * 0.5;
      const py = h * 0.3 + rng() * h * 0.45;
      drawPest(ctx, px, py, 5 + rng() * 4, rng);
    }
  }

  // disease blotches
  if (kind === "disease") {
    const n = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      const px = w * 0.3 + rng() * w * 0.5;
      const py = h * 0.3 + rng() * h * 0.45;
      drawBlotch(ctx, px, py, 8 + rng() * 14, rng);
    }
  }

  // soft vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  return canvas.toDataURL("image/jpeg", 0.92);
}

function drawLeaf(ctx, cx, cy, scale, rot, diseased) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -scale);
  ctx.bezierCurveTo(scale * 0.75, -scale * 0.6, scale * 0.75, scale * 0.6, 0, scale);
  ctx.bezierCurveTo(-scale * 0.75, scale * 0.6, -scale * 0.75, -scale * 0.6, 0, -scale);
  ctx.closePath();
  const base = diseased ? "#6b7a3c" : "#3f7a44";
  const tip = diseased ? "#8a6a34" : "#274d2b";
  const lg = ctx.createLinearGradient(0, -scale, 0, scale);
  lg.addColorStop(0, base);
  lg.addColorStop(1, tip);
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // vein
  ctx.beginPath();
  ctx.moveTo(0, -scale * 0.9);
  ctx.lineTo(0, scale * 0.9);
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
function drawPest(ctx, x, y, r, rng) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(20,16,10,0.9)";
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,16,10,0.9)";
  ctx.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.4, r * 0.5);
    ctx.lineTo(i * r * 0.7, r * 1.3);
    ctx.stroke();
  }
  ctx.restore();
}
function drawBlotch(ctx, x, y, r, rng) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(120,80,30,0.85)");
  g.addColorStop(0.6, "rgba(90,60,20,0.6)");
  g.addColorStop(1, "rgba(90,60,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ============================== small primitives ============================== */

function GlassPanel({ children, className = "", style = {}, glow = false }) {
  return (
    <div
      className={className}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        boxShadow: glow ? `0 0 0 1px rgba(126,235,166,0.08), 0 20px 40px -20px rgba(0,0,0,0.6)` : `0 20px 40px -24px rgba(0,0,0,0.6)`,
        backdropFilter: "blur(6px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, color = COLORS.aura }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color, boxShadow: `0 0 8px ${color}` }} />
      <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.14em", color: COLORS.lo, textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

function StatusPill({ level }) {
  const map = {
    Low: { c: COLORS.aura, bg: "rgba(126,235,166,0.12)" },
    Healthy: { c: COLORS.aura, bg: "rgba(126,235,166,0.12)" },
    Good: { c: COLORS.aura, bg: "rgba(126,235,166,0.12)" },
    Moderate: { c: COLORS.amber, bg: "rgba(243,182,92,0.14)" },
    Fair: { c: COLORS.amber, bg: "rgba(243,182,92,0.14)" },
    High: { c: COLORS.red, bg: "rgba(240,113,106,0.14)" },
    Poor: { c: COLORS.red, bg: "rgba(240,113,106,0.14)" },
    Critical: { c: COLORS.red, bg: "rgba(240,113,106,0.14)" },
  };
  const s = map[level] || { c: COLORS.lo, bg: "rgba(140,160,150,0.12)" };
  return (
    <span style={{
      fontFamily: F.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
      color: s.c, background: s.bg, padding: "3px 9px", borderRadius: 999, border: `1px solid ${s.c}33`,
    }}>{level.toUpperCase()}</span>
  );
}

function AnimatedNumber({ value, decimals = 0, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef();
  useEffect(() => {
    const start = performance.now();
    const from = display;
    const dur = 900;
    function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span>{display.toFixed(decimals)}{suffix}</span>;
}

function MetricCard({ icon: Icon, label, value, suffix = "", sub, tone = "aura", decimals = 0 }) {
  const toneColor = { aura: COLORS.aura, amber: COLORS.amber, red: COLORS.red, azure: COLORS.azure, soil: COLORS.soil }[tone];
  return (
    <GlassPanel style={{ padding: "20px 20px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: `${toneColor}1A`, border: `1px solid ${toneColor}33` }}>
          <Icon size={16} color={toneColor} />
        </div>
      </div>
      <div style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, color: COLORS.hi, lineHeight: 1 }}>
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
      </div>
      <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.lo, marginTop: 8 }}>{label}</div>
      {sub && <div style={{ fontFamily: F.mono, fontSize: 11, color: toneColor, marginTop: 6 }}>{sub}</div>}
    </GlassPanel>
  );
}

function HealthGauge({ value, size = 168, label, tone = COLORS.aura, thickness = 12 }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={thickness} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 8px ${tone}88)` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: F.display, fontSize: size * 0.22, fontWeight: 700, color: COLORS.hi }}>
          <AnimatedNumber value={pct} />
        </div>
        {label && <div style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.lo, marginTop: 2, letterSpacing: "0.06em" }}>{label}</div>}
      </div>
    </div>
  );
}

function ConfidenceBar({ label, value, tone = COLORS.aura, mono = true }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: mono ? F.mono : F.body, fontSize: 12.5, color: COLORS.hi }}>{label}</span>
        <span style={{ fontFamily: F.mono, fontSize: 12.5, color: tone }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: `linear-gradient(90deg, ${tone}99, ${tone})`, borderRadius: 999, transition: "width 0.8s cubic-bezier(.16,1,.3,1)" }} />
      </div>
    </div>
  );
}

const PIPELINE_STEPS = ["Preprocessing image", "Extracting features", "Running model inference", "Detecting features", "Calculating confidence", "Generating recommendations"];

function ProcessingAnimation({ running, onDone, steps = PIPELINE_STEPS }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  useEffect(() => {
    if (!running) { setActiveIdx(-1); return; }
    setActiveIdx(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(iv);
        setTimeout(() => onDone && onDone(), 180);
      } else {
        setActiveIdx(i);
      }
    }, 200);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (!running) return null;
  return (
    <div style={{ padding: "18px 20px", fontFamily: F.mono }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", opacity: i <= activeIdx ? 1 : 0.28, transition: "opacity 0.3s" }}>
          {i < activeIdx ? <CheckCircle2 size={14} color={COLORS.aura} /> : i === activeIdx ? <Loader2 size={14} color={COLORS.aura} className="aura-spin" /> : <span style={{ width: 14, height: 14, borderRadius: 999, border: `1px solid ${COLORS.lo}55` }} />}
          <span style={{ fontSize: 12.5, color: i <= activeIdx ? COLORS.hi : COLORS.lo }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function DropZone({ onFile, onSample, sampleLabel = "Try Sample Image", accentColor = COLORS.aura }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      style={{
        border: `1.5px dashed ${drag ? accentColor : "rgba(255,255,255,0.14)"}`,
        borderRadius: 16, padding: "48px 24px", textAlign: "center",
        background: drag ? `${accentColor}0D` : "rgba(255,255,255,0.015)",
        transition: "all 0.2s", cursor: "pointer",
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div style={{ width: 52, height: 52, margin: "0 auto 16px", borderRadius: 14, background: `${accentColor}14`, border: `1px solid ${accentColor}33`, display: "grid", placeItems: "center" }}>
        <Upload size={22} color={accentColor} />
      </div>
      <div style={{ fontFamily: F.display, fontSize: 16, color: COLORS.hi, fontWeight: 600, marginBottom: 4 }}>Drop a crop image here</div>
      <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.lo, marginBottom: 20 }}>or click to upload &middot; JPG, PNG supported</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }} style={btnPrimary(accentColor)}>
          <ImageIcon size={14} /> Upload Image
        </button>
        <button onClick={(e) => { e.stopPropagation(); onSample(); }} style={btnGhost}>
          <Zap size={14} /> {sampleLabel}
        </button>
      </div>
    </div>
  );
}

function btnPrimary(color = COLORS.aura) {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, fontFamily: F.body, fontSize: 13, fontWeight: 600,
    color: "#0B1410", background: color, border: "none", borderRadius: 10, padding: "10px 16px",
    cursor: "pointer", boxShadow: `0 0 20px ${color}44`,
  };
}
const btnGhost = {
  display: "inline-flex", alignItems: "center", gap: 8, fontFamily: F.body, fontSize: 13, fontWeight: 600,
  color: COLORS.hi, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLORS.border}`, borderRadius: 10,
  padding: "10px 16px", cursor: "pointer",
};

function AlertBadge({ tone, children }) {
  const c = { aura: COLORS.aura, amber: COLORS.amber, red: COLORS.red, lo: COLORS.lo, azure: COLORS.azure }[tone] || COLORS.lo;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: F.mono, fontSize: 11, color: c }}><span style={{ width: 5, height: 5, borderRadius: 999, background: c }} />{children}</span>;
}

function SectionHeading({ eyebrow, title, subtitle, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, color: COLORS.hi, margin: 0, letterSpacing: "-0.01em" }}>{title}</h1>
        {subtitle && <p style={{ fontFamily: F.body, fontSize: 14.5, color: COLORS.lo, marginTop: 8, maxWidth: 560 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ============================== Sidebar / Header ============================== */

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "pest", label: "Pest Detection", icon: Bug },
  { id: "disease", label: "Disease Detection", icon: Leaf },
  { id: "soil", label: "Soil Health", icon: Droplets },
  { id: "map", label: "Farm Map", icon: MapIcon },
  { id: "models", label: "AI Models", icon: Cpu },
  { id: "system", label: "System", icon: Radio },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ active, setActive }) {
  return (
    <div style={{
      width: 248, flexShrink: 0, background: "linear-gradient(180deg, #0C1310, #090E0B)",
      borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", height: "100%",
    }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${COLORS.aura}, #3fae6c)`, display: "grid", placeItems: "center", boxShadow: `0 0 18px ${COLORS.aura}55` }}>
            <Sprout size={18} color="#0B1410" />
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 16.5, fontWeight: 700, color: COLORS.hi, letterSpacing: "-0.01em" }}>AURAfarming</div>
          </div>
        </div>
        <div style={{ fontFamily: F.body, fontSize: 10.5, color: COLORS.lo, marginTop: 10, lineHeight: 1.4 }}>
          Automated Understanding &amp; Analysis for Farming
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: COLORS.aura, boxShadow: `0 0 8px ${COLORS.aura}`, animation: "aura-pulse 2s infinite" }} />
          <span style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.aura, letterSpacing: "0.08em" }}>SYSTEM ONLINE</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: "14px 12px", overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          return (
            <div key={item.id} onClick={() => setActive(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10,
                cursor: "pointer", marginBottom: 3, position: "relative",
                background: isActive ? "rgba(126,235,166,0.1)" : "transparent",
                border: isActive ? `1px solid ${COLORS.borderHi}` : "1px solid transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <item.icon size={16} color={isActive ? COLORS.aura : COLORS.lo} />
              <span style={{ fontFamily: F.body, fontSize: 13.5, fontWeight: isActive ? 600 : 500, color: isActive ? COLORS.hi : COLORS.lo }}>{item.label}</span>
              {isActive && <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: 999, background: COLORS.aura }} />}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <GlassPanel style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.lo }}>FIELD NODE 03</span>
            <Battery size={12} color={COLORS.aura} />
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: COLORS.hi }}>87% &middot; charging</div>
        </GlassPanel>
      </div>
    </div>
  );
}

function Header({ title }) {
  return (
    <div style={{
      height: 64, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 28px", flexShrink: 0,
      background: "rgba(9,14,11,0.7)", backdropFilter: "blur(8px)",
    }}>
      <div style={{ fontFamily: F.mono, fontSize: 11.5, color: COLORS.lo, letterSpacing: "0.06em" }}>
        AURAFARMING / <span style={{ color: COLORS.hi }}>{title.toUpperCase()}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <AlertBadge tone="aura"><Signal size={11} style={{ marginRight: 2 }} />1,284 scans this season</AlertBadge>
        <div style={{ width: 32, height: 32, borderRadius: 999, background: "linear-gradient(135deg, #2b3d2f, #16211a)", border: `1px solid ${COLORS.border}`, display: "grid", placeItems: "center", fontFamily: F.mono, fontSize: 11, color: COLORS.hi }}>JD</div>
      </div>
    </div>
  );
}

/* ============================== Background scan-grid ============================== */
function ScanGridBackground() {
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.5,
      backgroundImage: `linear-gradient(rgba(126,235,166,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(126,235,166,0.035) 1px, transparent 1px)`,
      backgroundSize: "42px 42px",
      maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%)",
    }} />
  );
}

/* ============================== Overview Page ============================== */

function radarData() {
  return [
    { subject: "Crop Health", value: 92 },
    { subject: "Pest Control", value: 81 },
    { subject: "Disease Control", value: 76 },
    { subject: "Soil Quality", value: 78 },
    { subject: "Environment", value: 85 },
  ];
}

const feedIcon = { leaf: Leaf, bug: Bug, droplet: Droplets, radio: Radio };

function OverviewPage({ feed, onRunDemo, demoState }) {
  return (
    <div style={{ position: "relative" }}>
      <ScanGridBackground />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 32 }}>
          <Eyebrow>Farm status &middot; live</Eyebrow>
          <h1 style={{ fontFamily: F.display, fontSize: 38, fontWeight: 700, color: COLORS.hi, margin: 0, letterSpacing: "-0.015em", maxWidth: 620 }}>
            AI-powered intelligence for every crop.
          </h1>
          <p style={{ fontFamily: F.body, fontSize: 15, color: COLORS.lo, marginTop: 12, maxWidth: 540, lineHeight: 1.6 }}>
            Monitor pests, detect plant disease, and understand soil health with computer vision and intelligent analysis.
          </p>
          <button onClick={onRunDemo} style={{ ...btnPrimary(COLORS.aura), marginTop: 22, padding: "12px 22px", fontSize: 13.5 }}>
            <Play size={15} /> RUN DEMO
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
          <MetricCard icon={Sprout} label="Crop Health" value={92} suffix="%" sub="Healthy" tone="aura" />
          <MetricCard icon={Bug} label="Pest Risk" value={2} sub="Low &middot; 2 detected areas" tone="amber" />
          <MetricCard icon={Leaf} label="Disease Risk" value={1} sub="Low &middot; 1 potential issue" tone="amber" />
          <MetricCard icon={Droplets} label="Soil Health" value={78} suffix="/100" sub="Good" tone="azure" />
          <MetricCard icon={ScanLine} label="AI Scans" value={1284} sub="This season" tone="aura" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <GlassPanel style={{ padding: 24 }}>
            <Eyebrow>Diagnostics</Eyebrow>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, color: COLORS.hi, marginBottom: 14 }}>Farm Health Overview</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData()} outerRadius="75%">
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: COLORS.lo, fontSize: 11, fontFamily: F.mono }} />
                  <Radar dataKey="value" stroke={COLORS.aura} fill={COLORS.aura} fillOpacity={0.22} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </GlassPanel>

          <GlassPanel style={{ padding: 24 }}>
            <Eyebrow>Activity</Eyebrow>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 600, color: COLORS.hi, marginBottom: 14 }}>Recent AI Scans</div>
            <div>
              {feed.map((f) => {
                const Icon = feedIcon[f.icon] || Info;
                return (
                  <div key={f.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: `${COLORS[f.tone] || COLORS.lo}1A`, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                      <Icon size={12.5} color={COLORS[f.tone] || COLORS.lo} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: F.body, fontSize: 12.5, color: COLORS.hi, lineHeight: 1.4 }}>{f.text}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.loDim, marginTop: 2 }}>{f.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        </div>
      </div>

      {demoState.running && <DemoOverlay demoState={demoState} />}
    </div>
  );
}

function DemoOverlay({ demoState }) {
  const stages = [
    { key: "pest", label: "Pest Scan", icon: Bug },
    { key: "disease", label: "Disease Scan", icon: Leaf },
    { key: "soil", label: "Soil Analysis", icon: Droplets },
    { key: "health", label: "Farm Health Update", icon: Activity },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(4,7,5,0.78)", backdropFilter: "blur(4px)",
      display: "grid", placeItems: "center", zIndex: 50, padding: 20,
    }}>
      <GlassPanel style={{ width: 440, padding: 28 }} glow>
        {!demoState.done ? (
          <>
            <Eyebrow>AURAfarming Demo Mode</Eyebrow>
            <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 600, color: COLORS.hi, marginBottom: 20 }}>Running complete farm analysis&hellip;</div>
            {stages.map((s, i) => {
              const state = i < demoState.stage ? "done" : i === demoState.stage ? "active" : "pending";
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", opacity: state === "pending" ? 0.35 : 1, transition: "opacity 0.3s" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: state === "done" ? `${COLORS.aura}22` : "rgba(255,255,255,0.05)", border: `1px solid ${state === "done" ? COLORS.aura : COLORS.border}` }}>
                    {state === "active" ? <Loader2 size={14} color={COLORS.aura} className="aura-spin" /> : <s.icon size={14} color={state === "done" ? COLORS.aura : COLORS.lo} />}
                  </div>
                  <span style={{ fontFamily: F.body, fontSize: 13.5, color: state === "pending" ? COLORS.lo : COLORS.hi }}>{s.label}</span>
                  {state === "done" && <CheckCircle2 size={14} color={COLORS.aura} style={{ marginLeft: "auto" }} />}
                </div>
              );
            })}
          </>
        ) : (
          <>
            <Eyebrow>Analysis complete</Eyebrow>
            <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, color: COLORS.hi, marginBottom: 20 }}>AURAfarming Analysis Complete</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <StatBlock label="Overall Farm Health" value="91%" tone={COLORS.aura} />
              <StatBlock label="Pest Risk" value="Low" tone={COLORS.aura} />
              <StatBlock label="Disease Risk" value="Moderate" tone={COLORS.amber} />
              <StatBlock label="Soil Health" value="78/100" tone={COLORS.azure} />
            </div>
            <button onClick={demoState.onClose} style={{ ...btnPrimary(COLORS.aura), width: "100%", justifyContent: "center" }}>Close summary</button>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
function StatBlock({ label, value, tone }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 700, color: tone }}>{value}</div>
    </div>
  );
}

/* ============================== Pest Detection Page ============================== */

function PestDetectionPage() {
  const [imgSrc, setImgSrc] = useState(null);
  const [seedKey, setSeedKey] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImgSrc(e.target.result);
      setSeedKey(file.name + file.size);
      setResult(null);
      setProcessing(true);
    };
    reader.readAsDataURL(file);
  };
  const handleSample = () => {
    const key = "sample-" + Math.floor(Math.random() * 100000);
    setImgSrc(generateSampleImage("pest", key));
    setSeedKey(key);
    setResult(null);
    setProcessing(true);
  };
  const handleDone = () => {
    setProcessing(false);
    setResult(runPestModel(seedKey));
  };

  const riskTone = result ? ({ Low: "aura", Moderate: "amber", High: "red" }[result.risk]) : "aura";

  return (
    <div>
      <SectionHeading eyebrow="Computer vision &middot; object detection" title="Pest Detection" subtitle="Identify harmful insects before they threaten your crop." />

      <div style={{ display: "grid", gridTemplateColumns: imgSrc ? "1.4fr 1fr" : "1fr", gap: 20 }}>
        <GlassPanel style={{ padding: 20 }}>
          {!imgSrc ? (
            <DropZone onFile={handleFile} onSample={handleSample} />
          ) : (
            <div>
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
                <img src={imgSrc} alt="Analysis subject" style={{ width: "100%", display: "block" }} />
                {processing && <ScanSweep color={COLORS.aura} />}
                {result && result.boxes.map((b, i) => (
                  <div key={i} style={{
                    position: "absolute", left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`,
                    border: `1.5px solid ${COLORS.aura}`, borderRadius: 4, boxShadow: `0 0 12px ${COLORS.aura}66`,
                    animation: "box-in 0.4s ease-out both", animationDelay: `${i * 0.08}s`,
                  }}>
                    <span style={{
                      position: "absolute", top: -20, left: -1, fontFamily: F.mono, fontSize: 9.5, background: COLORS.aura,
                      color: "#08110c", padding: "2px 5px", borderRadius: 3, whiteSpace: "nowrap", fontWeight: 700,
                    }}>{result.species} {b.confidence.toFixed(0)}%</span>
                  </div>
                ))}
                <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 8 }}>
                  <button onClick={() => { setImgSrc(null); setResult(null); }} style={{ ...btnGhost, padding: "6px 10px", fontSize: 11 }}>
                    <X size={12} /> Clear
                  </button>
                </div>
              </div>
              {processing && <ProcessingAnimation running={processing} onDone={handleDone} steps={["Uploading image", "Image preprocessing", "Feature extraction", "Model inference", "Object detection", "Confidence calculation", "Generating recommendations"]} />}
              {result && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontFamily: F.mono, fontSize: 11, color: COLORS.lo }}>
                  <span>Model: <span style={{ color: COLORS.hi }}>AURA-PestVision v1.2</span></span>
                  <span>Inference time: <span style={{ color: COLORS.aura }}>{result.inferenceTime}s</span></span>
                </div>
              )}
            </div>
          )}
        </GlassPanel>

        {imgSrc && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!result ? (
              <GlassPanel style={{ padding: 20, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.lo }}>Awaiting inference&hellip;</span>
              </GlassPanel>
            ) : (
              <>
                <GlassPanel style={{ padding: 20 }} glow>
                  <Eyebrow color={COLORS[riskTone]}>Detection result</Eyebrow>
                  <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, color: COLORS.hi }}>{result.species} detected</div>
                  <div style={{ fontFamily: F.mono, fontSize: 12.5, color: COLORS.aura, marginTop: 4 }}>Confidence: {result.confidence.toFixed(1)}%</div>
                  <div style={{ fontFamily: F.body, fontSize: 12.5, color: COLORS.lo, marginTop: 10, lineHeight: 1.5 }}>
                    Detected: {result.count} {result.species.toLowerCase()}{result.count > 1 ? "s" : ""}{result.clusters > 0 ? `, ${result.clusters} possible cluster${result.clusters > 1 ? "s" : ""}` : ""}.
                  </div>
                  <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
                    <div>
                      <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo }}>RISK LEVEL</div>
                      <div style={{ marginTop: 4 }}><StatusPill level={result.risk} /></div>
                    </div>
                    <div>
                      <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo }}>CROP</div>
                      <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi, marginTop: 6 }}>{result.crop}</div>
                    </div>
                  </div>
                </GlassPanel>

                <RecommendationCard text={result.recommendation} />

                <GlassPanel style={{ padding: 20 }}>
                  <Eyebrow>Detection details</Eyebrow>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F.mono, fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: COLORS.lo, textAlign: "left" }}>
                        <th style={{ paddingBottom: 8, fontWeight: 500 }}>Species</th>
                        <th style={{ paddingBottom: 8, fontWeight: 500 }}>Count</th>
                        <th style={{ paddingBottom: 8, fontWeight: 500 }}>Confidence</th>
                        <th style={{ paddingBottom: 8, fontWeight: 500 }}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderTop: `1px solid ${COLORS.border}`, color: COLORS.hi }}>
                        <td style={{ padding: "9px 0" }}>{result.species}</td>
                        <td style={{ padding: "9px 0" }}>{result.count}</td>
                        <td style={{ padding: "9px 0" }}>{result.confidence.toFixed(1)}%</td>
                        <td style={{ padding: "9px 0" }}><StatusPill level={result.risk} /></td>
                      </tr>
                    </tbody>
                  </table>
                </GlassPanel>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScanSweep({ color }) {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, height: "22%", top: 0,
      background: `linear-gradient(180deg, transparent, ${color}33, transparent)`,
      animation: "scan-sweep 1.4s ease-in-out infinite", pointerEvents: "none",
    }} />
  );
}

function RecommendationCard({ text }) {
  return (
    <GlassPanel style={{ padding: 18, borderColor: `${COLORS.amber}33` }}>
      <div style={{ display: "flex", gap: 10 }}>
        <AlertTriangle size={16} color={COLORS.amber} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.amber, marginBottom: 5, letterSpacing: "0.06em" }}>RECOMMENDATION</div>
          <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi, lineHeight: 1.5 }}>{text}</div>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ============================== Disease Detection Page ============================== */

function DiseaseDetectionPage() {
  const [imgSrc, setImgSrc] = useState(null);
  const [seedKey, setSeedKey] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImgSrc(e.target.result);
      setSeedKey(file.name + file.size);
      setResult(null);
      setProcessing(true);
    };
    reader.readAsDataURL(file);
  };
  const handleSample = () => {
    const key = "sample-" + Math.floor(Math.random() * 100000);
    setImgSrc(generateSampleImage("disease", key));
    setSeedKey(key);
    setResult(null);
    setProcessing(true);
  };
  const handleDone = () => { setProcessing(false); setResult(runDiseaseModel(seedKey)); };

  return (
    <div>
      <SectionHeading eyebrow="Computer vision &middot; classification" title="Plant Disease Detection" subtitle="Detect early signs of disease from a single leaf image." />

      <div style={{ display: "grid", gridTemplateColumns: imgSrc ? "1.4fr 1fr" : "1fr", gap: 20 }}>
        <GlassPanel style={{ padding: 20 }}>
          {!imgSrc ? (
            <DropZone onFile={handleFile} onSample={handleSample} accentColor={COLORS.amber} />
          ) : (
            <div>
              <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000" }}>
                <img src={imgSrc} alt="Leaf subject" style={{ width: "100%", display: "block" }} />
                {processing && <ScanSweep color={COLORS.amber} />}
                {result && !result.isHealthy && (
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 100 100" preserveAspectRatio="none">
                    {result.heatmapRegions.map((r, i) => (
                      <circle key={i} cx={r.cx} cy={r.cy} r={r.r} fill={COLORS.red} opacity={r.intensity * 0.55}
                        style={{ animation: "heat-in 0.6s ease-out both", animationDelay: `${i * 0.07}s`, filter: "blur(1.5px)" }} />
                    ))}
                  </svg>
                )}
              </div>
              {processing && <ProcessingAnimation running={processing} onDone={handleDone} steps={["Uploading image", "Image preprocessing", "Feature extraction", "Model inference", "Segmentation analysis", "Confidence calculation", "Generating recommendations"]} />}
              {result && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontFamily: F.mono, fontSize: 11, color: COLORS.lo }}>
                  <span>Model: <span style={{ color: COLORS.hi }}>AURA-PlantVision v2.0</span></span>
                  <span>Inference time: <span style={{ color: COLORS.amber }}>{result.inferenceTime}s</span></span>
                </div>
              )}
            </div>
          )}
        </GlassPanel>

        {imgSrc && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!result ? (
              <GlassPanel style={{ padding: 20, minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: F.mono, fontSize: 12, color: COLORS.lo }}>Awaiting inference&hellip;</span>
              </GlassPanel>
            ) : (
              <>
                <GlassPanel style={{ padding: 20 }} glow>
                  <Eyebrow color={result.isHealthy ? COLORS.aura : COLORS.amber}>Diagnosis</Eyebrow>
                  <div style={{ fontFamily: F.display, fontSize: 21, fontWeight: 700, color: COLORS.hi }}>{result.diagnosis}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 12.5, color: COLORS.amber, marginTop: 4 }}>Confidence: {result.confidence.toFixed(1)}%</div>
                  <div style={{ display: "flex", gap: 20, marginTop: 16 }}>
                    <div>
                      <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo }}>SEVERITY</div>
                      <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi, marginTop: 6 }}>{result.severity}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo }}>AFFECTED AREA</div>
                      <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi, marginTop: 6 }}>~{result.affected}%</div>
                    </div>
                  </div>
                </GlassPanel>

                <GlassPanel style={{ padding: 20 }}>
                  <Eyebrow>Tissue analysis</Eyebrow>
                  <ConfidenceBar label="Healthy tissue" value={result.healthy} tone={COLORS.aura} />
                  <ConfidenceBar label="Affected tissue" value={result.affected} tone={COLORS.red} />
                </GlassPanel>

                <GlassPanel style={{ padding: 18 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.azure, marginBottom: 6, letterSpacing: "0.06em" }}>AI EXPLANATION</div>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi, lineHeight: 1.5 }}>{result.explanation}</div>
                </GlassPanel>

                <RecommendationCard text={result.recommendation} />

                <GlassPanel style={{ padding: 20 }}>
                  <Eyebrow>Alternative predictions</Eyebrow>
                  {result.alternatives.map((a) => (
                    <ConfidenceBar key={a.name} label={a.name} value={a.confidence} tone={a.name === result.diagnosis ? COLORS.amber : COLORS.lo} />
                  ))}
                </GlassPanel>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== Soil Health Page ============================== */

function SoilSlider({ label, value, onChange, min, max, step = 1, unit = "%", tone = COLORS.azure }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi }}>{label}</span>
        <span style={{ fontFamily: F.mono, fontSize: 12.5, color: tone }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: tone, height: 4 }} />
    </div>
  );
}

function SoilHealthPage() {
  const [values, setValues] = useState({ moisture: 79, ph: 6.4, nitrogen: 72, phosphorus: 61, potassium: 84, organic: 4.1, temperature: 24 });
  const result = useMemo(() => runSoilModel(values), [values]);
  const set = (k) => (v) => setValues((s) => ({ ...s, [k]: v }));
  const scoreTone = result.score >= 80 ? COLORS.aura : result.score >= 65 ? COLORS.aura : result.score >= 45 ? COLORS.amber : COLORS.red;

  const suitBars = Object.entries(result.suitability).map(([crop, v]) => ({ crop, v }));

  return (
    <div>
      <SectionHeading eyebrow="Sensor intelligence" title="Soil Health Intelligence" subtitle="Turn soil measurements into actionable crop intelligence." />

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 20 }}>
        <GlassPanel style={{ padding: 24 }}>
          <Eyebrow>Sensor readings</Eyebrow>
          <SoilSlider label="Soil Moisture" value={values.moisture} onChange={set("moisture")} min={0} max={100} tone={COLORS.azure} />
          <SoilSlider label="pH" value={values.ph} onChange={set("ph")} min={3.5} max={9} step={0.1} unit="" tone={COLORS.soil} />
          <SoilSlider label="Nitrogen (N)" value={values.nitrogen} onChange={set("nitrogen")} min={0} max={100} tone={COLORS.aura} />
          <SoilSlider label="Phosphorus (P)" value={values.phosphorus} onChange={set("phosphorus")} min={0} max={100} tone={COLORS.amber} />
          <SoilSlider label="Potassium (K)" value={values.potassium} onChange={set("potassium")} min={0} max={100} tone={COLORS.aura} />
          <SoilSlider label="Organic Matter" value={values.organic} onChange={set("organic")} min={0} max={10} step={0.1} unit="%" tone={COLORS.soil} />
          <SoilSlider label="Temperature" value={values.temperature} onChange={set("temperature")} min={0} max={45} unit="\u00b0C" tone={COLORS.azure} />
        </GlassPanel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <GlassPanel style={{ padding: 24, display: "flex", alignItems: "center", gap: 26 }} glow>
            <HealthGauge value={result.score} size={140} label="/ 100" tone={scoreTone} />
            <div>
              <Eyebrow color={scoreTone}>Soil health score</Eyebrow>
              <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 700, color: COLORS.hi }}><StatusPill level={result.category} /></div>
              <div style={{ fontFamily: F.body, fontSize: 12.5, color: COLORS.lo, marginTop: 10, maxWidth: 260, lineHeight: 1.5 }}>Computed from moisture, nutrient balance, pH deviation, and organic matter content.</div>
            </div>
          </GlassPanel>

          <GlassPanel style={{ padding: 22 }}>
            <Eyebrow>Indicators</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <IndicatorTile label="Nitrogen" value={`${values.nitrogen}%`} tone={COLORS.aura} />
              <IndicatorTile label="Phosphorus" value={`${values.phosphorus}%`} tone={COLORS.amber} />
              <IndicatorTile label="Potassium" value={`${values.potassium}%`} tone={COLORS.aura} />
              <IndicatorTile label="Moisture" value={`${values.moisture}%`} tone={COLORS.azure} />
              <IndicatorTile label="pH" value={values.ph.toFixed(1)} tone={COLORS.soil} />
              <IndicatorTile label="Organic Matter" value={`${values.organic.toFixed(1)}%`} tone={COLORS.soil} />
            </div>
          </GlassPanel>

          <GlassPanel style={{ padding: 22 }}>
            <Eyebrow>Crop suitability</Eyebrow>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={suitBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="crop" width={70} tick={{ fill: COLORS.lo, fontSize: 12, fontFamily: F.mono }} axisLine={false} tickLine={false} />
                  <Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={16}>
                    {suitBars.map((b, i) => <Cell key={i} fill={b.v >= 80 ? COLORS.aura : b.v >= 60 ? COLORS.azure : COLORS.amber} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassPanel>

          <GlassPanel style={{ padding: 18 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <FlaskConical size={16} color={COLORS.azure} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.azure, marginBottom: 5, letterSpacing: "0.06em" }}>AI RECOMMENDATION</div>
                <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi, lineHeight: 1.5 }}>{result.recommendation}</div>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
function IndicatorTile({ label, value, tone }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.lo, marginBottom: 6 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: tone }}>{value}</div>
    </div>
  );
}

/* ============================== Farm Map Page ============================== */

function FarmMapPage() {
  const [selected, setSelected] = useState(FIELDS[2]);
  const statusColor = { healthy: COLORS.aura, attention: COLORS.amber, critical: COLORS.red };
  return (
    <div>
      <SectionHeading eyebrow="Geospatial monitoring" title="Farm Map" subtitle="A live overview of every field, camera node, and active alert across the property." />
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <GlassPanel style={{ padding: 18, position: "relative", minHeight: 480 }}>
          <div style={{
            position: "absolute", inset: 18, borderRadius: 12, overflow: "hidden",
            background: "repeating-linear-gradient(120deg, #16261a, #16261a 26px, #132218 26px, #132218 52px)",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(9,14,11,0.2), rgba(9,14,11,0.75))" }} />
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 100 100" preserveAspectRatio="none">
              {[15, 40, 63, 88].map((y) => <line key={y} x1={0} x2={100} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.3} />)}
              {[20, 45, 70].map((x) => <line key={x} y1={0} y2={100} x1={x} x2={x} stroke="rgba(255,255,255,0.06)" strokeWidth={0.3} />)}
            </svg>
            {FIELDS.map((f) => (
              <div key={f.id} onClick={() => setSelected(f)}
                style={{ position: "absolute", left: `${f.x}%`, top: `${f.y}%`, transform: "translate(-50%,-50%)", cursor: "pointer", textAlign: "center" }}>
                <div style={{
                  width: selected?.id === f.id ? 20 : 15, height: selected?.id === f.id ? 20 : 15, borderRadius: 999,
                  background: statusColor[f.status], boxShadow: `0 0 16px ${statusColor[f.status]}aa`,
                  border: selected?.id === f.id ? `2px solid ${COLORS.hi}` : "2px solid rgba(0,0,0,0.3)",
                  transition: "all 0.2s", animation: f.status === "critical" ? "aura-pulse 1.4s infinite" : "none",
                }} />
                <div style={{ fontFamily: F.mono, fontSize: 9.5, color: COLORS.hi, marginTop: 5, background: "rgba(9,14,11,0.7)", padding: "1px 5px", borderRadius: 4, display: "inline-block" }}>{f.id}</div>
              </div>
            ))}
            {/* camera node markers */}
            {[[30, 40], [58, 52], [75, 20]].map(([x, y], i) => (
              <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }}>
                <Camera size={13} color={COLORS.lo} />
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: 30, left: 30, display: "flex", gap: 16, background: "rgba(9,14,11,0.75)", padding: "8px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
            <LegendDot color={COLORS.aura} label="Healthy" />
            <LegendDot color={COLORS.amber} label="Attention" />
            <LegendDot color={COLORS.red} label="Critical" />
          </div>
        </GlassPanel>

        <GlassPanel style={{ padding: 22 }}>
          {selected ? (
            <>
              <Eyebrow color={statusColor[selected.status]}>{selected.id}</Eyebrow>
              <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, color: COLORS.hi, marginBottom: 16 }}>{selected.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <FieldStat label="Crop" value={selected.crop} />
                <FieldStat label="Health" value={`${selected.health}%`} />
                <FieldStat label="Pest Risk" value={<StatusPill level={selected.pestRisk} />} />
                <FieldStat label="Disease Risk" value={<StatusPill level={selected.diseaseRisk} />} />
                <FieldStat label="Soil" value={`${selected.soil}/100`} />
                <FieldStat label="Last Scan" value={selected.lastScan} />
              </div>
              <div style={{ height: 1, background: COLORS.border, margin: "16px 0" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F.mono, fontSize: 11.5, color: COLORS.lo }}>
                <MapPin size={13} /> Field node actively reporting
              </div>
            </>
          ) : (
            <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.lo }}>Select a field on the map to view details.</div>
          )}

          <div style={{ marginTop: 22 }}>
            <Eyebrow>All fields</Eyebrow>
            {FIELDS.map((f) => (
              <div key={f.id} onClick={() => setSelected(f)} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8,
                cursor: "pointer", background: selected?.id === f.id ? "rgba(126,235,166,0.08)" : "transparent", marginBottom: 2,
              }}>
                <span style={{ fontFamily: F.body, fontSize: 12.5, color: COLORS.hi }}>{f.id} &middot; {f.crop}</span>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: statusColor[f.status] }} />
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
function LegendDot({ color, label }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color }} /><span style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.hi }}>{label}</span></div>;
}
function FieldStat({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.lo, marginBottom: 4 }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: F.body, fontSize: 13.5, color: COLORS.hi, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/* ============================== AI Models Page ============================== */

function Sparkline({ color, seed }) {
  const rng = rngFromSeed("spark" + seed);
  const pts = Array.from({ length: 16 }).map((_, i) => ({ i, v: 40 + rng() * 50 + i * 1.2 }));
  return (
    <div style={{ height: 46 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ModelCard({ name, kind, icon: Icon, detects, accuracy, tone, seed }) {
  return (
    <GlassPanel style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${tone}1A`, border: `1px solid ${tone}33`, display: "grid", placeItems: "center" }}>
            <Icon size={18} color={tone} />
          </div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: COLORS.hi }}>{name}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo }}>{kind}</div>
          </div>
        </div>
        <AlertBadge tone="aura">ONLINE</AlertBadge>
      </div>
      <Sparkline color={tone} seed={seed} />
      <div style={{ margin: "14px 0 10px", fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo }}>DETECTS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {detects.map((d) => (
          <span key={d} style={{ fontFamily: F.body, fontSize: 11, color: COLORS.hi, background: "rgba(255,255,255,0.05)", border: `1px solid ${COLORS.border}`, padding: "4px 9px", borderRadius: 999 }}>{d}</span>
        ))}
      </div>
      {accuracy != null && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: F.mono, fontSize: 10.5, color: COLORS.lo }}>ACCURACY</span>
            <span style={{ fontFamily: F.mono, fontSize: 12, color: tone }}>{accuracy}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
            <div style={{ width: `${accuracy}%`, height: "100%", borderRadius: 999, background: tone }} />
          </div>
        </div>
      )}
    </GlassPanel>
  );
}

function ModelsPage() {
  return (
    <div>
      <SectionHeading eyebrow="Model center" title="AI Models" subtitle="The computer-vision and analysis models running inside every AURA Field Node." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        <ModelCard name="AURA-PestVision" kind="Object Detection" icon={Bug} tone={COLORS.aura} accuracy={94.7} seed="pv"
          detects={["Aphids", "Caterpillars", "Whiteflies", "Beetles"]} />
        <ModelCard name="AURA-PlantVision" kind="Disease Classification" icon={Leaf} tone={COLORS.amber} accuracy={96.2} seed="dv"
          detects={["Early Blight", "Late Blight", "Leaf Spot", "Powdery Mildew", "Healthy"]} />
        <ModelCard name="AURA-SoilIQ" kind="Soil Health Analysis" icon={Droplets} tone={COLORS.azure} accuracy={null} seed="sq"
          detects={["pH", "Nutrients", "Moisture", "Organic Matter"]} />
      </div>

      <GlassPanel style={{ padding: 22, marginTop: 20 }}>
        <Eyebrow>Architecture note</Eyebrow>
        <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.lo, lineHeight: 1.7, maxWidth: 720 }}>
          Every module in this demo runs through a swappable inference service (<code style={{ fontFamily: F.mono, color: COLORS.hi }}>services/pestModel</code>, <code style={{ fontFamily: F.mono, color: COLORS.hi }}>services/diseaseModel</code>, <code style={{ fontFamily: F.mono, color: COLORS.hi }}>services/soilModel</code>) so the simulated inference used here can be replaced with a hosted model or FastAPI backend without changing the interface.
        </div>
      </GlassPanel>
    </div>
  );
}

/* ============================== System / Camera Page ============================== */

function LiveFeedCanvas() {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let raf; let t = 0;
    function draw() {
      t += 0.01;
      const w = canvas.width, h = canvas.height;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `hsl(${110 + Math.sin(t) * 4}, 30%, ${16 + Math.sin(t * 0.7) * 2}%)`);
      g.addColorStop(1, "#0e1610");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const rng = mulberry32(i * 999);
        const x = w * (0.15 + i * 0.18) + Math.sin(t + i) * 6;
        const y = h * 0.62;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 0.5 + i) * 0.05);
        ctx.beginPath();
        ctx.moveTo(0, -40 - i * 3);
        ctx.bezierCurveTo(24, -20, 24, 20, 0, 40);
        ctx.bezierCurveTo(-24, 20, -24, -20, 0, -40 - i * 3);
        ctx.fillStyle = `hsl(115, 35%, ${22 + i * 2}%)`;
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={640} height={360} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function SystemPage() {
  const items = [
    { label: "Camera Online", icon: Camera }, { label: "Solar Charging", icon: Sun },
    { label: "AI Processing", icon: Cpu }, { label: "Network Connected", icon: Wifi },
  ];
  return (
    <div>
      <SectionHeading eyebrow="Hardware" title="AI Camera System" subtitle="The solar-powered field node behind every scan in this dashboard." />
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        <GlassPanel style={{ padding: 20 }}>
          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
            <LiveFeedCanvas />
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.5)", padding: "4px 9px", borderRadius: 999 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: COLORS.red, animation: "aura-pulse 1.2s infinite" }} />
              <span style={{ fontFamily: F.mono, fontSize: 10.5, color: "#fff", letterSpacing: "0.06em" }}>LIVE</span>
            </div>
            <div style={{ position: "absolute", bottom: 12, right: 12, fontFamily: F.mono, fontSize: 10, color: "#cfe8d6", background: "rgba(0,0,0,0.5)", padding: "4px 9px", borderRadius: 6 }}>
              FIELD NODE 03 &middot; 640x360 &middot; 4 FPS
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
            {items.map((it) => (
              <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.border}` }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: COLORS.aura, boxShadow: `0 0 6px ${COLORS.aura}` }} />
                <span style={{ fontFamily: F.body, fontSize: 11.5, color: COLORS.hi }}>{it.label}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel style={{ padding: 22 }}>
          <Eyebrow>AURA Field Node</Eyebrow>
          <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 700, color: COLORS.hi, marginBottom: 4 }}>Solar-powered AI monitoring system</div>
          <div style={{ fontFamily: F.body, fontSize: 12.5, color: COLORS.lo, marginBottom: 18 }}>Deployed at Field 03 &middot; ID FN-0003</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <MetricRow icon={Battery} label="Battery" value="87%" tone={COLORS.aura} />
            <MetricRow icon={Sun} label="Solar" value="64W" tone={COLORS.amber} />
            <MetricRow icon={Thermometer} label="Temperature" value="29\u00b0C" tone={COLORS.azure} />
            <MetricRow icon={Activity} label="Last Scan" value="4 min ago" tone={COLORS.aura} />
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
function MetricRow({ icon: Icon, label, value, tone }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${COLORS.border}` }}>
      <Icon size={14} color={tone} style={{ marginBottom: 8 }} />
      <div style={{ fontFamily: F.mono, fontSize: 10, color: COLORS.lo }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: COLORS.hi, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/* ============================== Settings Page ============================== */

function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 40, height: 22, borderRadius: 999, background: on ? COLORS.aura : "rgba(255,255,255,0.12)",
      position: "relative", cursor: "pointer", transition: "background 0.2s",
    }}>
      <div style={{ width: 16, height: 16, borderRadius: 999, background: "#0B1410", position: "absolute", top: 3, left: on ? 21 : 3, transition: "left 0.2s" }} />
    </div>
  );
}

function SettingsPage() {
  const [pestAlerts, setPestAlerts] = useState(true);
  const [diseaseAlerts, setDiseaseAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [scanInterval, setScanInterval] = useState(15);
  return (
    <div>
      <SectionHeading eyebrow="Configuration" title="Settings" subtitle="Manage alerts, scan cadence, and system preferences." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <GlassPanel style={{ padding: 22 }}>
          <Eyebrow>Notifications</Eyebrow>
          <SettingRow label="Pest alerts" desc="Notify when new pest activity is detected." on={pestAlerts} onChange={setPestAlerts} />
          <SettingRow label="Disease alerts" desc="Notify when a disease diagnosis exceeds 90% confidence." on={diseaseAlerts} onChange={setDiseaseAlerts} />
          <SettingRow label="Weekly summary report" desc="Send a farm health digest every Monday." on={weeklyReport} onChange={setWeeklyReport} />
        </GlassPanel>
        <GlassPanel style={{ padding: 22 }}>
          <Eyebrow>Scan cadence</Eyebrow>
          <div style={{ fontFamily: F.body, fontSize: 13, color: COLORS.hi, marginBottom: 10 }}>Field node scan interval: <span style={{ color: COLORS.aura, fontFamily: F.mono }}>{scanInterval} min</span></div>
          <input type="range" min={5} max={60} step={5} value={scanInterval} onChange={(e) => setScanInterval(Number(e.target.value))} style={{ width: "100%", accentColor: COLORS.aura }} />
          <div style={{ height: 1, background: COLORS.border, margin: "20px 0" }} />
          <Eyebrow>Model versions</Eyebrow>
          {[["AURA-PestVision", "v1.2"], ["AURA-PlantVision", "v2.0"], ["AURA-SoilIQ", "v1.0"]].map(([n, v]) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontFamily: F.mono, fontSize: 12, color: COLORS.lo }}>
              <span style={{ color: COLORS.hi }}>{n}</span><span>{v}</span>
            </div>
          ))}
        </GlassPanel>
      </div>
    </div>
  );
}
function SettingRow({ label, desc, on, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ maxWidth: 300 }}>
        <div style={{ fontFamily: F.body, fontSize: 13.5, color: COLORS.hi, fontWeight: 600 }}>{label}</div>
        <div style={{ fontFamily: F.body, fontSize: 12, color: COLORS.lo, marginTop: 3 }}>{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

/* ============================== App shell ============================== */

const PAGE_TITLES = { overview: "Overview", pest: "Pest Detection", disease: "Disease Detection", soil: "Soil Health", map: "Farm Map", models: "AI Models", system: "System", settings: "Settings" };

export default function App() {
  const [active, setActive] = useState("overview");
  const [feed] = useState(INITIAL_FEED);
  const [demoState, setDemoState] = useState({ running: false, stage: 0, done: false });

  const runDemo = useCallback(() => {
    setDemoState({ running: true, stage: 0, done: false });
    let stage = 0;
    const iv = setInterval(() => {
      stage++;
      if (stage >= 4) {
        clearInterval(iv);
        setDemoState((s) => ({ ...s, stage: 4, done: true }));
      } else {
        setDemoState((s) => ({ ...s, stage }));
      }
    }, 750);
  }, []);

  const closeDemo = () => setDemoState({ running: false, stage: 0, done: false });

  const page = useMemo(() => {
    switch (active) {
      case "overview": return <OverviewPage feed={feed} onRunDemo={runDemo} demoState={{ ...demoState, onClose: closeDemo }} />;
      case "pest": return <PestDetectionPage />;
      case "disease": return <DiseaseDetectionPage />;
      case "soil": return <SoilHealthPage />;
      case "map": return <FarmMapPage />;
      case "models": return <ModelsPage />;
      case "system": return <SystemPage />;
      case "settings": return <SettingsPage />;
      default: return null;
    }
  }, [active, feed, demoState]);

  return (
    <div style={{ width: "100%", height: "100vh", minHeight: 640, display: "flex", background: COLORS.void, color: COLORS.hi, fontFamily: F.body, overflow: "hidden" }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }
        ::-webkit-scrollbar-track { background: transparent; }
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: rgba(255,255,255,0.1); }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 999px; background: #EAF2EC; margin-top: -5px; box-shadow: 0 0 0 3px rgba(126,235,166,0.25); cursor: pointer; }
        @keyframes aura-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes scan-sweep { 0% { top: -22%; } 100% { top: 100%; } }
        @keyframes box-in { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes heat-in { from { opacity: 0; r: 0; } to { opacity: 1; } }
        .aura-spin { animation: aura-spin-kf 1s linear infinite; }
        @keyframes aura-spin-kf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <Sidebar active={active} setActive={setActive} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header title={PAGE_TITLES[active]} />
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px 60px" }}>
          {page}
        </div>
      </div>
    </div>
  );
}
