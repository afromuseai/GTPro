import React, { useRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Shield, Zap, BarChart3, Bot, Globe, ArrowRight, CheckCircle, Lock, UserCheck, KeyRound, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from "lucide-react";

const EASE_CUBIC: [number, number, number, number] = [0.25, 0.1, 0.25, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE_CUBIC, delay: d } }),
};

const STATS = [
  { value: "< 2ms", label: "Execution Latency" },
  { value: "99.97%", label: "System Uptime" },
  { value: "$4.2B+", label: "Volume Processed" },
  { value: "47+", label: "Connected Exchanges" },
];

const FEATURES = [
  { num: "01", title: "Analyze", desc: "AI processes market data, liquidity, and volatility in real time. Our engine continuously monitors conditions across 47+ exchanges to identify opportunities.", icon: Zap },
  { num: "02", title: "Execute", desc: "Bot agents simulate trades with realistic behavior and timing. Watch strategies deploy across market conditions without real capital at risk.", icon: Bot },
  { num: "03", title: "Optimize", desc: "Real-time performance feedback continuously improves system intelligence. Learn from live market execution.", icon: BarChart3 },
  { num: "04", title: "ABF — Agent Bot Fleet", desc: "Generates signals and executes strategies with precision. Our proprietary algorithms adapt to market regimes in real-time.", icon: Shield },
  { num: "05", title: "SBF — Security Bot Fleet", desc: "Monitors system integrity and protects operations. Real-time risk monitoring with automated circuit breakers.", icon: Lock },
  { num: "06", title: "VCBF — Vulnerability Fleet", desc: "Scans and stabilizes system performance. Continuous optimization ensures peak execution quality.", icon: Activity },
];

const TERMINAL_BASE = [
  { pair: "BTC/USDT", side: "BUY",  qty: "0.4820", price: 67341.50, basePnl: 812.40,  pos: true,  fleet: "ABF-α" },
  { pair: "ETH/USDT", side: "SELL", qty: "3.1200", price: 3512.80,  basePnl: 228.90,  pos: true,  fleet: "ABF-β" },
  { pair: "SOL/USDT", side: "BUY",  qty: "42.000", price: 182.64,   basePnl: -94.20,  pos: false, fleet: "HBF-γ" },
  { pair: "BNB/USDT", side: "BUY",  qty: "8.5000", price: 594.10,   basePnl: 163.70,  pos: true,  fleet: "ABF-α" },
  { pair: "XRP/USDT", side: "SELL", qty: "9400.0", price: 0.6124,   basePnl: 47.30,   pos: true,  fleet: "HBF-δ" },
];

// ── Animated terminal row ─────────────────────────────────────────────────────
function TerminalRow({ row, index }: { row: typeof TERMINAL_BASE[0]; index: number }) {
  const [pnl, setPnl] = useState(row.basePnl);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const delta = (Math.random() - 0.48) * (Math.abs(row.basePnl) * 0.04);
      setPnl(prev => {
        const next = prev + delta;
        setFlash(delta > 0 ? "up" : "down");
        setTimeout(() => setFlash(null), 400);
        return next;
      });
    }, 1800 + index * 340);
    return () => clearInterval(id);
  }, [row.basePnl, index]);

  const isPos = pnl >= 0;
  const priceStr = row.price >= 1000
    ? row.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : row.price.toFixed(4);

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.52 + index * 0.1, duration: 0.5 }}
      className="grid grid-cols-6 px-5 py-3 border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors group"
    >
      <span className="font-mono text-[12px] font-bold text-foreground">{row.pair}</span>
      <span className={`font-mono text-[11px] font-black tracking-widest ${row.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
        {row.side}
      </span>
      <span className="font-mono text-[12px] text-muted-foreground">{row.qty}</span>
      <span className="font-mono text-[12px] text-foreground">${priceStr}</span>
      <span className="font-mono text-[10px] text-muted-foreground/50 self-center">{row.fleet}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={Math.round(pnl * 100)}
          initial={{ opacity: 0.6, y: flash === "up" ? -3 : 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className={`font-mono text-[12px] font-black text-right flex items-center justify-end gap-1 ${
            isPos ? "text-emerald-400" : "text-red-400"
          } ${flash === "up" ? "text-emerald-300" : flash === "down" ? "text-red-300" : ""}`}
        >
          {isPos
            ? <ChevronUp size={10} className="shrink-0" />
            : <ChevronDown size={10} className="shrink-0" />}
          {isPos ? "+" : ""}${Math.abs(pnl).toFixed(2)}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

// Pre-baked particle definitions — deterministic, no runtime randomness causing re-renders
const PARTICLES = [
  { x: 8,  y: 12, s: 1.8, op: 0.45, color: "rgba(200,168,75,", dur: 14, delay: 0    },
  { x: 18, y: 68, s: 1.2, op: 0.30, color: "rgba(200,168,75,", dur: 19, delay: 2.1  },
  { x: 27, y: 34, s: 2.2, op: 0.20, color: "rgba(147,197,253,", dur: 22, delay: 0.8 },
  { x: 35, y: 82, s: 1.5, op: 0.35, color: "rgba(255,255,255,", dur: 17, delay: 4.2 },
  { x: 44, y: 21, s: 1.0, op: 0.25, color: "rgba(200,168,75,", dur: 25, delay: 1.5  },
  { x: 52, y: 55, s: 2.5, op: 0.15, color: "rgba(147,197,253,", dur: 20, delay: 3.3 },
  { x: 61, y: 78, s: 1.3, op: 0.40, color: "rgba(200,168,75,", dur: 16, delay: 0.4  },
  { x: 70, y: 42, s: 1.8, op: 0.22, color: "rgba(255,255,255,", dur: 23, delay: 2.7 },
  { x: 78, y: 15, s: 1.1, op: 0.35, color: "rgba(200,168,75,", dur: 18, delay: 5.0  },
  { x: 85, y: 63, s: 2.0, op: 0.18, color: "rgba(147,197,253,", dur: 21, delay: 1.1 },
  { x: 92, y: 38, s: 1.4, op: 0.30, color: "rgba(200,168,75,", dur: 15, delay: 3.8  },
  { x: 14, y: 88, s: 1.6, op: 0.25, color: "rgba(255,255,255,", dur: 26, delay: 0.6 },
  { x: 23, y: 52, s: 1.0, op: 0.40, color: "rgba(200,168,75,", dur: 13, delay: 4.5  },
  { x: 48, y: 90, s: 2.3, op: 0.15, color: "rgba(147,197,253,", dur: 24, delay: 2.0 },
  { x: 56, y: 9,  s: 1.7, op: 0.28, color: "rgba(200,168,75,", dur: 19, delay: 1.8  },
  { x: 66, y: 71, s: 1.2, op: 0.35, color: "rgba(255,255,255,", dur: 20, delay: 3.1 },
  { x: 75, y: 29, s: 1.9, op: 0.22, color: "rgba(200,168,75,", dur: 17, delay: 0.2  },
  { x: 82, y: 86, s: 1.3, op: 0.30, color: "rgba(147,197,253,", dur: 22, delay: 4.8 },
  { x: 90, y: 18, s: 1.1, op: 0.45, color: "rgba(200,168,75,", dur: 14, delay: 2.5  },
  { x: 38, y: 6,  s: 2.1, op: 0.18, color: "rgba(255,255,255,", dur: 28, delay: 1.3 },
  { x: 5,  y: 48, s: 1.4, op: 0.32, color: "rgba(200,168,75,", dur: 16, delay: 3.6  },
  { x: 96, y: 74, s: 1.6, op: 0.25, color: "rgba(147,197,253,", dur: 21, delay: 0.9 },
  { x: 42, y: 44, s: 1.0, op: 0.38, color: "rgba(200,168,75,", dur: 12, delay: 5.5  },
  { x: 58, y: 62, s: 2.4, op: 0.12, color: "rgba(255,255,255,", dur: 30, delay: 2.3 },
];

// ── Floating particle field ────────────────────────────────────────────────────
function ParticleField() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 3 }}>
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left:   `${p.x}%`,
            top:    `${p.y}%`,
            width:  p.s,
            height: p.s,
            background: `${p.color}${p.op})`,
            boxShadow: `0 0 ${p.s * 3}px ${p.s}px ${p.color}${p.op * 0.6})`,
          }}
          animate={{
            y:       [-8, 8, -8],
            x:       [-4, 4, -4],
            opacity: [p.op * 0.5, p.op, p.op * 0.5],
          }}
          transition={{
            duration:   p.dur,
            delay:      p.delay,
            repeat:     Infinity,
            ease:       "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ── Subtle horizontal scan-line data streams ──────────────────────────────────
const SCAN_LINES = [
  { top: 22, w: 180, op: 0.12, dur: 8,  delay: 0   },
  { top: 41, w: 120, op: 0.08, dur: 11, delay: 2.5 },
  { top: 63, w: 200, op: 0.10, dur: 9,  delay: 1.2 },
  { top: 78, w: 90,  op: 0.07, dur: 13, delay: 4.0 },
];

function ScanLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block" style={{ zIndex: 3 }}>
      {SCAN_LINES.map((l, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top:    `${l.top}%`,
            left:   "-10%",
            width:  l.w,
            height: 1,
            background: `linear-gradient(to right, transparent, rgba(200,168,75,${l.op}), transparent)`,
          }}
          animate={{ x: ["0%", "120vw"] }}
          transition={{
            duration: l.dur,
            delay:    l.delay,
            repeat:   Infinity,
            ease:     "linear",
            repeatDelay: l.dur * 0.8,
          }}
        />
      ))}
    </div>
  );
}

// ── Live system indicator ─────────────────────────────────────────────────────
function LiveIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 1.1 }}
      className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.07] backdrop-blur-sm"
    >
      <span className="relative flex w-2 h-2">
        <motion.span
          className="absolute inline-flex w-full h-full rounded-full bg-emerald-400"
          animate={{ scale: [1, 2.4, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 2.0, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
      </span>
      <span className="text-[10px] font-black tracking-[0.22em] uppercase text-emerald-400">Live System Active</span>
      <motion.div
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 2.2, repeat: Infinity }}
        className="w-px h-3 bg-emerald-400/40"
      />
      <span className="text-[10px] font-mono text-emerald-400/70 tracking-wider">SYS:OK</span>
    </motion.div>
  );
}

// ── Hero video background ─────────────────────────────────────────────────────
function HeroBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Slow-zoom video wrapper */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.0 }}
        animate={{ scale: 1.08 }}
        transition={{ duration: 28, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
        style={{ filter: "brightness(0.32) saturate(0.85)" }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-fallback.png"
          preload="none"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center md:hidden"
          style={{ backgroundImage: "url('/hero-fallback.png')" }}
        />
      </motion.div>

      {/* Layer 1 — Primary dark gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(160deg, rgba(10,14,26,0.78) 0%, rgba(10,14,26,0.68) 35%, rgba(10,14,26,0.88) 70%, rgba(10,14,26,1) 100%)",
        }}
      />

      {/* Layer 2 — Gold radial ambient glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background: "radial-gradient(ellipse 75% 55% at 50% 38%, rgba(200,168,75,0.13) 0%, transparent 65%)",
        }}
      />

      {/* Layer 2b — Blue counter-glow for depth */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        style={{
          background: "radial-gradient(ellipse 60% 40% at 30% 60%, rgba(59,130,246,0.07) 0%, transparent 60%)",
        }}
      />

      {/* Layer 3 — Vignette edge */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 38%, rgba(5,7,15,0.82) 100%)",
        }}
      />

      {/* Side vignettes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(5,7,15,0.65) 0%, transparent 16%, transparent 84%, rgba(5,7,15,0.65) 100%)",
        }}
      />

      {/* Bottom fade to background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, transparent, rgba(10,14,26,1))",
        }}
      />
    </div>
  );
}

// ── CTA Glow pulse wrapper ────────────────────────────────────────────────────
function PulseCtaGlow({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative inline-block">
      <motion.div
        className="absolute -inset-2 rounded-xl pointer-events-none"
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse at center, rgba(200,168,75,0.45) 0%, transparent 70%)" }}
      />
      {children}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-background/90 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="GTPro" className="h-11 w-auto object-contain" />
          <div className="hidden md:flex gap-8 text-[13px] font-medium text-muted-foreground tracking-wide">
            <a href="#features" className="hover:text-foreground transition-colors duration-200">Features</a>
            <a href="#stats"    className="hover:text-foreground transition-colors duration-200">Performance</a>
            <a href="#pricing"  className="hover:text-foreground transition-colors duration-200">Pricing</a>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-[13px] font-medium">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.18 }}>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-btn px-5 text-[13px]">
                  Get Access
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.nav>

      <main className="flex-1 pt-16">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28 px-6 min-h-[90vh] flex items-center">

          <HeroBackground />

          {/* Subtle grid on top of video */}
          <div className="absolute inset-0 line-grid opacity-[0.18] pointer-events-none" style={{ zIndex: 1 }} />

          {/* Floating data particles */}
          <ParticleField />

          {/* Scan-line data streams */}
          <ScanLines />

          {/* Headline depth glow — large blurred orb behind the text */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              zIndex: 2,
              top: "12%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 900,
              height: 340,
            }}
            animate={{ opacity: [0.28, 0.50, 0.28], scale: [1, 1.07, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Gold glow */}
            <div style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at 50% 50%, rgba(200,168,75,0.30) 0%, transparent 58%)",
              filter: "blur(32px)",
            }} />
            {/* Purple counter-accent */}
            <motion.div
              style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.16) 0%, transparent 62%)",
                filter: "blur(28px)",
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
            />
          </motion.div>

          {/* Content */}
          <div className="max-w-6xl mx-auto relative w-full" style={{ zIndex: 10 }}>

            {/* Eyebrow pill */}
            <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/[0.08] text-primary text-xs font-bold tracking-[0.18em] uppercase backdrop-blur-sm">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                Institutional Trading Infrastructure
              </div>
            </motion.div>

            {/* Headline with layered text shadow */}
            <motion.h1
              variants={fadeUp} custom={0.08} initial="hidden" animate="show"
              className="text-center text-5xl md:text-7xl lg:text-[88px] font-black tracking-[-0.04em] leading-[1.0] mb-7"
              style={{
                textShadow: [
                  "0 0 120px rgba(200,168,75,0.22)",
                  "0 0 60px rgba(200,168,75,0.12)",
                  "0 4px 60px rgba(0,0,0,0.9)",
                  "0 2px 20px rgba(0,0,0,1)",
                ].join(", "),
              }}
            >
              Command the Markets<br />
              with <span className="shimmer-text">Intelligent Systems</span>
            </motion.h1>

            {/* Sub headline */}
            <motion.p
              variants={fadeUp} custom={0.18} initial="hidden" animate="show"
              className="text-center text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8"
              style={{ textShadow: "0 1px 24px rgba(0,0,0,0.95)" }}
            >
              GTPro is an AI-powered trading intelligence platform built for real-time analysis, live market execution, and continuous system optimization.
            </motion.p>

            {/* Live system indicator */}
            <motion.div
              variants={fadeUp} custom={0.24} initial="hidden" animate="show"
              className="flex justify-center mb-10"
            >
              <LiveIndicator />
            </motion.div>

            {/* CTAs */}
            <motion.div
              variants={fadeUp} custom={0.32} initial="hidden" animate="show"
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link href="/sign-up">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }}>
                  <PulseCtaGlow>
                    <Button size="lg" className="h-13 px-9 text-[15px] font-black bg-primary text-primary-foreground hover:bg-primary/90 glow-btn transition-all duration-300 gap-2.5 relative z-10">
                      Start System <ArrowRight size={16} />
                    </Button>
                  </PulseCtaGlow>
                </motion.div>
              </Link>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" variant="outline" className="h-13 px-9 text-[15px] font-medium border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 text-foreground transition-all duration-300 backdrop-blur-sm">
                  View Demo
                </Button>
              </motion.div>
            </motion.div>

            {/* Trust line */}
            <motion.div
              variants={fadeUp} custom={0.36} initial="hidden" animate="show"
              className="text-center"
            >
              <p className="text-[12px] text-muted-foreground tracking-wider">Service-based platform • Real-time execution • AI-powered signals</p>
            </motion.div>

            {/* ── Terminal Mockup ── */}
            <motion.div
              initial={{ opacity: 0, y: 52 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.42, ease: [0.25, 0.1, 0.25, 1] }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-white/[0.10] overflow-hidden backdrop-blur-md"
              style={{
                background: "linear-gradient(180deg, rgba(13,18,33,0.94) 0%, rgba(10,14,26,0.97) 100%)",
                boxShadow: [
                  "0 48px 140px rgba(0,0,0,0.85)",
                  "0 0 80px rgba(200,168,75,0.07)",
                  "inset 0 1px 0 rgba(255,255,255,0.06)",
                ].join(", "),
              }}
            >
              {/* Terminal titlebar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]" style={{ background: "rgba(8,11,22,0.92)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <span className="ml-3 text-[11px] text-muted-foreground font-mono tracking-[0.18em] uppercase">GTPro · Live Positions</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-muted-foreground/40 tracking-wider hidden sm:block">ABF · FLEET ALPHA v2.4</span>
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                    <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-widest">LIVE</span>
                  </div>
                </div>
              </div>

              {/* System status strip */}
              <div className="flex items-center gap-6 px-5 py-2 border-b border-white/[0.04]" style={{ background: "rgba(5,8,16,0.5)" }}>
                {[
                  { label: "SBF", value: "NOMINAL", color: "text-emerald-400" },
                  { label: "VCBF", value: "98.4%", color: "text-emerald-400" },
                  { label: "LATENCY", value: "1.8ms", color: "text-primary" },
                  { label: "EXECUTIONS", value: "247", color: "text-blue-400" },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground/40">{s.label}</span>
                    <span className={`text-[10px] font-mono font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Table header */}
              <div className="grid grid-cols-6 px-5 py-2 text-[10px] font-black text-muted-foreground/50 tracking-[0.18em] uppercase border-b border-white/[0.04]">
                <span>Pair</span><span>Side</span><span>Qty</span><span>Price</span><span>Fleet</span>
                <span className="text-right">Unrealized P&amp;L</span>
              </div>

              {/* Animated Rows */}
              {TERMINAL_BASE.map((row, i) => (
                <TerminalRow key={row.pair} row={row} index={i} />
              ))}

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.04]" style={{ background: "rgba(8,11,22,0.6)" }}>
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/40">
                  <span>5 positions open</span>
                  <span className="text-white/[0.08]">·</span>
                  <motion.span animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2.5, repeat: Infinity }}>
                    Real-time · ABF execution engine
                  </motion.span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={11} className="text-emerald-400" />
                  <span className="text-[11px] font-mono font-black text-emerald-400">+$1,158.40</span>
                  <span className="text-[10px] text-muted-foreground/40 font-mono">total</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section id="stats" className="py-16 px-6 border-y border-white/[0.05]" style={{ background: "hsl(228 50% 5%)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x divide-white/[0.07]">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  className="text-center px-6"
                >
                  <div className="text-3xl md:text-4xl font-black tracking-tight gold-gradient stat-glow mb-1.5">{s.value}</div>
                  <div className="text-[12px] text-muted-foreground uppercase tracking-widest font-medium">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-28 px-6 relative">
          <div className="absolute inset-0 dot-grid pointer-events-none opacity-60" />
          <div className="max-w-7xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-20"
            >
              <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-4">How It Works</p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-5">Analyze. Execute. Optimize.</h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">Three core components working together in real-time to deliver intelligent market execution.</p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.num}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.55, delay: i * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
                  whileHover={{ y: -5, transition: { duration: 0.22 } }}
                  className="group relative p-7 rounded-2xl border border-white/[0.07] cursor-default overflow-hidden"
                  style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}
                >
                  <div className="text-[11px] font-black tracking-[0.2em] text-primary/40 mb-5 font-mono">{f.num}</div>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/18 transition-colors duration-300 border border-primary/15">
                    <f.icon size={18} className="text-primary" />
                  </div>
                  <h3 className="text-[16px] font-bold mb-2.5 text-foreground">{f.title}</h3>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">{f.desc}</p>
                  <div className="absolute inset-0 rounded-2xl border border-primary/0 group-hover:border-primary/15 transition-all duration-400 pointer-events-none" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at 30% 0%, rgba(200,168,75,0.06) 0%, transparent 60%)" }} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Billing Model ── */}
        <section className="py-16 px-6 border-y border-white/[0.05]" style={{ background: "hsl(228 50% 5%)" }}>
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10"
            >
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">Pay for Performance Infrastructure, Not Promises</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                GTPro uses a service-based credit system. You only pay for bot execution and AI processing — no subscriptions, no hidden fees, full transparency.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { point: "No subscriptions required", sub: "Pay only for what you use" },
                { point: "No hidden fees", sub: "Transparent pricing at every level" },
                { point: "Full usage transparency", sub: "See exactly what you're paying for" },
              ].map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/[0.06]"
                  style={{ background: "hsl(228 48% 7%)" }}
                >
                  <CheckCircle size={20} className="text-primary shrink-0" />
                  <div>
                    <div className="text-[15px] font-semibold mb-1">{t.point}</div>
                    <div className="text-[13px] text-muted-foreground">{t.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security & Control ── */}
        <section id="security" className="py-24 px-6 relative">
          <div className="absolute inset-0 dot-grid pointer-events-none opacity-40" />
          <div className="max-w-5xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-14"
            >
              <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-4">Security & Control</p>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">Built on trust. Operated by you.</h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-[15px]">
                GTPro runs a strict no-custody model. Your capital stays in your exchange account at all times — we only execute trades on your explicit instruction.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: Lock,     title: "Mandatory 2FA Protection",   desc: "All accounts require two-factor authentication via TOTP (time-based one-time password) combined with real phone verification. Biometric login supported on compatible devices.", color: "text-emerald-400", border: "border-emerald-400/15", bg: "bg-emerald-400/[0.04]" },
                { icon: KeyRound, title: "VOIP & Temp Email Blocked",  desc: "Phone verification rejects VOIP services and temporary email providers. Only legitimate phone numbers and permanent email addresses pass verification — preventing account takeovers.", color: "text-primary", border: "border-primary/15", bg: "bg-primary/[0.04]" },
                { icon: UserCheck,title: "Zero Withdrawal Access",     desc: "GTPro never requests withdrawal permissions. API keys are configured for trade execution only — your funds remain exclusively under your control at all times.", color: "text-blue-400", border: "border-blue-400/15", bg: "bg-blue-400/[0.04]" },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`group relative p-6 rounded-2xl border ${item.border} ${item.bg} overflow-hidden cursor-default`}
                >
                  <div className={`w-10 h-10 rounded-xl border ${item.border} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <item.icon size={18} className={item.color} />
                  </div>
                  <h3 className="text-[15px] font-bold mb-2.5">{item.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  <div className={`absolute inset-0 rounded-2xl border ${item.border} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-28 px-6 relative">
          <div className="absolute inset-0 dot-grid pointer-events-none opacity-50" />
          <div className="max-w-6xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <p className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-4">Simple Pricing</p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Credits. No Subscriptions.</h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Deposit service credits and spend only on what you actually run. No monthly lock-ins. Cancel anytime.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {[
                {
                  name: "Starter",
                  credits: "$25",
                  hours: "~50 bot-hours",
                  rate: "$0.50/hour",
                  desc: "Perfect for exploring strategies and running short sessions.",
                  features: ["50 bot-hours of execution", "Real-time AI analysis", "ABF signal access", "Basic fleet monitoring"],
                  highlight: false,
                  cta: "Get Started",
                },
                {
                  name: "Professional",
                  credits: "$100",
                  hours: "~250 bot-hours",
                  rate: "$0.40/hour",
                  desc: "For active traders running multiple simultaneous strategies.",
                  features: ["250 bot-hours of execution", "Priority AI processing", "All fleet access (ABF, HBF, VCBF)", "Advanced security monitoring", "Real-time P&L analytics"],
                  highlight: true,
                  cta: "Most Popular",
                },
                {
                  name: "Institutional",
                  credits: "$500",
                  hours: "~1,400 bot-hours",
                  rate: "$0.35/hour",
                  desc: "Maximum throughput for institutional-grade operations.",
                  features: ["1,400+ bot-hours of execution", "Dedicated fleet allocation", "SBF priority threat monitoring", "Full audit log access", "API rate limit exemptions"],
                  highlight: false,
                  cta: "Go Institutional",
                },
              ].map((plan, i) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: i * 0.1 }}
                  whileHover={{ y: -6, transition: { duration: 0.22 } }}
                  className={`relative rounded-2xl border overflow-hidden flex flex-col ${
                    plan.highlight
                      ? "border-primary/40"
                      : "border-white/[0.08]"
                  }`}
                  style={{
                    background: plan.highlight
                      ? "linear-gradient(145deg, hsl(228 45% 10%) 0%, hsl(228 50% 7%) 100%)"
                      : "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)",
                  }}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />
                  )}
                  {plan.highlight && (
                    <div className="absolute top-3.5 right-4 text-[9px] font-black tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border border-primary/40 bg-primary/15 text-primary">
                      Most Popular
                    </div>
                  )}
                  <div className="p-7 flex flex-col flex-1">
                    <div className="mb-6">
                      <div className="text-[12px] font-black tracking-[0.18em] uppercase text-muted-foreground/60 mb-1">{plan.name}</div>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-4xl font-black tracking-tight gold-gradient">{plan.credits}</span>
                        <span className="text-[13px] text-muted-foreground font-medium">in credits</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[12px] text-primary font-bold">{plan.hours}</span>
                        <span className="text-[11px] text-muted-foreground/50">· {plan.rate}</span>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-3 leading-relaxed">{plan.desc}</p>
                    </div>
                    <div className="space-y-2.5 mb-8 flex-1">
                      {plan.features.map(f => (
                        <div key={f} className="flex items-start gap-2.5">
                          <CheckCircle size={13} className="text-primary shrink-0 mt-0.5" />
                          <span className="text-[13px] text-muted-foreground">{f}</span>
                        </div>
                      ))}
                    </div>
                    <Link href="/sign-up">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          size="sm"
                          className={`w-full h-11 text-[13px] font-bold transition-all duration-200 ${
                            plan.highlight
                              ? "bg-primary text-primary-foreground hover:bg-primary/90 glow-btn"
                              : "border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
                          }`}
                          variant={plan.highlight ? "default" : "outline"}
                        >
                          {plan.cta} <ArrowRight size={13} className="ml-1.5" />
                        </Button>
                      </motion.div>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              className="text-center text-[12px] text-muted-foreground/60"
            >
              All credits are non-expiring · No subscriptions · Cancel anytime · Real-time usage transparency
            </motion.div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="cta" className="py-36 px-6 relative overflow-hidden">
          <div className="absolute inset-0 line-grid pointer-events-none" />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
            animate={{ opacity: [0.12, 0.22, 0.12], scale: [1, 1.07, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            style={{ background: "radial-gradient(circle, rgba(200,168,75,0.25) 0%, transparent 65%)" }}
          />
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              className="text-xs font-bold tracking-[0.25em] uppercase text-primary mb-5">
              Get started now
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.65 }}
              className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-[1.05]"
            >
              Activate Your<br />
              <span className="shimmer-text">System</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.1 }}
              className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto"
            >
              Deposit credits to start running AI trading bots with real-time analysis and live market execution.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Link href="/sign-up">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <PulseCtaGlow>
                    <Button size="lg" className="h-13 px-10 text-[16px] font-black bg-primary text-primary-foreground hover:bg-primary/90 glow-btn transition-all duration-300 gap-2 relative z-10">
                      Start with $10 <ArrowRight size={16} />
                    </Button>
                  </PulseCtaGlow>
                </motion.div>
              </Link>
            </motion.div>
            <p className="mt-5 text-[12px] text-muted-foreground">No credit card required · Real-time market tracking</p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-10 px-6" style={{ background: "hsl(228 52% 4%)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-5">
          <img src="/logo.png" alt="GTPro" className="h-9 w-auto object-contain" />
          <p className="text-[13px] text-muted-foreground">&copy; {new Date().getFullYear()} GTPro Trading Technologies. All rights reserved.</p>
          <div className="flex gap-6 text-[13px] text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
