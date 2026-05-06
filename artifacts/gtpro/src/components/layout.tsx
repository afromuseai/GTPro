import React from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { LayoutDashboard, LineChart, Link as LinkIcon, Settings, LogOut, Menu, X, Bell, Bot, Shield, Cpu, Home, Wallet, ShieldAlert, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DevBypassContext } from "@/contexts/dev-bypass";
import { motion, AnimatePresence } from "framer-motion";
import { useBotEngine } from "@/engine/bot-engine";
import { useFleetEngine } from "@/engine/fleet-engine";
import { useAdminAuth } from "@/contexts/admin-auth";
import { ChatWidget } from "@/components/chat-widget";

const NAV_ITEMS = [
  { href: "/dashboard",      label: "Dashboard",      icon: LayoutDashboard },
  { href: "/analysis",       label: "Analysis",        icon: LineChart },
  { href: "/journal",        label: "Trade Journal",   icon: BookOpen },
  { href: "/linked-accounts",label: "Linked Accounts", icon: LinkIcon },
  { href: "/wallet",         label: "Service Credits", icon: Wallet },
  { href: "/settings",       label: "Settings",        icon: Settings },
];

function StatusPill({ label, active, icon: Icon }: { label: string; active: boolean; icon: React.ElementType }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wider uppercase transition-all duration-500 ${
      active
        ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-400"
        : "border-white/[0.07] bg-white/[0.02] text-muted-foreground/50"
    }`}>
      <motion.div
        className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-muted-foreground/30"}`}
        animate={active ? { opacity: [1, 0.3, 1], scale: [1, 0.75, 1] } : { opacity: 0.4 }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      <Icon size={10} />
      {label}
    </div>
  );
}

export function AppLayout({ children, devMode }: { children: React.ReactNode; devMode?: boolean }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { disable } = React.useContext(DevBypassContext);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { bot } = useBotEngine();
  const { sbfStats, vcbfStats } = useFleetEngine();
  const { isAdmin } = useAdminAuth();

  const displayName = devMode ? "Dev User" : (user?.fullName || user?.emailAddresses?.[0]?.emailAddress || "Trader");
  const initials    = devMode ? "D" : (user?.firstName?.charAt(0) || "T");
  const avatarUrl   = devMode ? null : user?.imageUrl;
  const pageTitle   = location.split("/")[1]?.replace(/-/g, " ") || "dashboard";

  function handleSignOut() {
    if (devMode) disable();
    else signOut({ redirectUrl: "/" });
  }

  return (
    <div className={`flex w-full bg-background overflow-hidden text-foreground ${devMode ? "h-[calc(100dvh-2rem)] mt-8" : "h-[100dvh]"}`}>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-white/[0.06] md:relative md:translate-x-0 transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} ${devMode ? "top-8" : ""}`}
        style={{ background: "linear-gradient(180deg, hsl(228 52% 5%) 0%, hsl(228 55% 4%) 100%)" }}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            {/* Hexagon icon — matches real brand */}
            <svg width="42" height="48" viewBox="0 0 42 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              {/* Outer hexagon */}
              <polygon points="21,1 40,11.5 40,36.5 21,47 2,36.5 2,11.5" fill="#0D1221" stroke="#D4AF37" strokeWidth="1.8"/>
              {/* Inner hexagon */}
              <polygon points="21,6 36,14.5 36,33.5 21,42 6,33.5 6,14.5" fill="none" stroke="#D4AF37" strokeWidth="0.8" strokeOpacity="0.45"/>
              {/* Vertex dots + connector lines */}
              <circle cx="21" cy="1" r="1.8" fill="#D4AF37"/>
              <line x1="21" y1="1" x2="21" y2="6" stroke="#D4AF37" strokeWidth="0.7" strokeOpacity="0.4"/>
              <line x1="40" y1="11.5" x2="36" y2="14.5" stroke="#D4AF37" strokeWidth="0.7" strokeOpacity="0.4"/>
              <line x1="40" y1="36.5" x2="36" y2="33.5" stroke="#D4AF37" strokeWidth="0.7" strokeOpacity="0.4"/>
              <line x1="21" y1="47" x2="21" y2="42" stroke="#D4AF37" strokeWidth="0.7" strokeOpacity="0.4"/>
              <line x1="2" y1="36.5" x2="6" y2="33.5" stroke="#D4AF37" strokeWidth="0.7" strokeOpacity="0.4"/>
              <line x1="2" y1="11.5" x2="6" y2="14.5" stroke="#D4AF37" strokeWidth="0.7" strokeOpacity="0.4"/>
              {/* Globe circle */}
              <circle cx="21" cy="22" r="11" fill="none" stroke="#D4AF37" strokeWidth="1.2"/>
              {/* Globe horizontal bands (clipped to circle) */}
              <clipPath id="sc"><circle cx="21" cy="22" r="11"/></clipPath>
              <line x1="10" y1="18.5" x2="32" y2="18.5" stroke="#D4AF37" strokeWidth="0.9" strokeOpacity="0.65" clipPath="url(#sc)"/>
              <line x1="10" y1="22"   x2="32" y2="22"   stroke="#D4AF37" strokeWidth="0.9" strokeOpacity="0.65" clipPath="url(#sc)"/>
              <line x1="10" y1="25.5" x2="32" y2="25.5" stroke="#D4AF37" strokeWidth="0.9" strokeOpacity="0.65" clipPath="url(#sc)"/>
              {/* Globe vertical ellipse */}
              <ellipse cx="21" cy="22" rx="4.5" ry="11" fill="none" stroke="#D4AF37" strokeWidth="0.9" strokeOpacity="0.5" clipPath="url(#sc)"/>
              {/* GT label */}
              <text x="21" y="39" textAnchor="middle" fill="#D4AF37" fontSize="5.5" fontWeight="700" fontFamily="Inter,sans-serif" letterSpacing="2.5">GT</text>
            </svg>
            {/* Wordmark — all gold, matching real brand */}
            <div className="flex flex-col leading-none">
              <span className="text-[19px] font-black tracking-tight" style={{ color: "#D4AF37", fontFamily: "Inter, sans-serif" }}>
                GTPro
              </span>
              <span className="text-[7.5px] font-bold tracking-[0.22em] uppercase mt-0.5" style={{ color: "#D4AF37", opacity: 0.55 }}>
                Global Trade Intelligence
              </span>
            </div>
          </div>
          <button className="md:hidden text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Home button */}
        <div className="px-3 pt-4 pb-1">
          <Link href="/home" onClick={() => setMobileMenuOpen(false)} className="block">
            <motion.div
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 border border-white/[0.06] hover:border-white/[0.1]"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <Home size={14} className="text-primary/60" />
              <span className="text-[12px] font-medium">Home</span>
            </motion.div>
          </Link>
        </div>

        {/* Section label */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/50">Navigation</p>
        </div>

        {/* Nav items */}
        <nav className="px-3 space-y-0.5 flex-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="block">
                <motion.div
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={isActive ? { background: "rgba(200,168,75,0.1)" } : {}}
                >
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary"
                        initial={{ opacity: 0, scaleY: 0.4 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.4 }}
                        transition={{ duration: 0.22 }}
                      />
                    )}
                  </AnimatePresence>
                  <item.icon size={16} className={isActive ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-[13px] font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-bg"
                      className="absolute inset-0 rounded-lg -z-10"
                      style={{ background: "linear-gradient(90deg, rgba(200,168,75,0.1) 0%, transparent 100%)" }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}

          {/* Admin Portal — only visible to logged-in admins */}
          {isAdmin && (
            <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="block mt-2">
              <motion.div
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                  location === "/admin"
                    ? "text-foreground border-red-400/20 bg-red-400/8"
                    : "text-red-400/60 hover:text-red-400 border-red-400/10 hover:border-red-400/20 hover:bg-red-400/5"
                }`}
              >
                <ShieldAlert size={15} className="text-red-400" />
                <span className="text-[13px] font-bold">Admin Panel</span>
                <span className="ml-auto text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded border border-red-400/25 bg-red-400/10 text-red-400">
                  Admin
                </span>
              </motion.div>
            </Link>
          )}
        </nav>

        {/* Bottom user card */}
        <div className="p-4 border-t border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06]"
            style={{ background: "rgba(255,255,255,0.025)" }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/20 shrink-0" />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0 ${devMode ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-primary/15 text-primary border border-primary/20"}`}>
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate">{displayName}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <motion.div
                  className={`w-1.5 h-1.5 rounded-full ${devMode ? "bg-amber-400" : "bg-emerald-400"}`}
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
                <span className="text-[11px] text-muted-foreground">{devMode ? "Dev Mode" : "Active"}</span>
              </div>
            </div>
            <button onClick={handleSignOut} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Sign Out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/[0.06] shrink-0"
          style={{ background: "rgba(5, 8, 16, 0.95)", backdropFilter: "blur(20px)" }}>
          <div className="flex items-center gap-4">
            <button className="md:hidden text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-[15px] font-bold capitalize tracking-tight">{pageTitle}</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">GTPro Trading Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* System Status — hidden on small screens */}
            <div className="hidden xl:flex items-center gap-1.5 mr-1">
              <StatusPill label={`SBF · ${sbfStats.threatLevel.toUpperCase()}`} active={sbfStats.threatLevel === "low"} icon={Shield} />
              <StatusPill label={`VCBF · ${vcbfStats.healthScore}%`} active={vcbfStats.status === "nominal"} icon={Cpu} />
              <StatusPill label={bot?.status === "RUNNING" ? "ABF · Active" : "ABF · Idle"} active={bot?.status === "RUNNING"} icon={Bot} />
            </div>

            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }} transition={{ duration: 0.15 }}>
              <Button variant="ghost" size="icon" className="w-9 h-9 text-muted-foreground hover:text-foreground relative">
                <Bell size={16} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
              </Button>
            </motion.div>

            <div className="w-px h-6 bg-white/[0.08] mx-1" />

            <div className="flex items-center gap-2.5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/20" />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] border ${devMode ? "bg-amber-500/20 border-amber-500/30 text-amber-400" : "bg-primary/15 border-primary/20 text-primary"}`}>
                  {initials}
                </div>
              )}
              <div className="hidden sm:block">
                <div className="text-[12px] font-semibold">{displayName}</div>
                <div className="text-[11px] text-muted-foreground">{devMode ? "Developer" : "Pro Plan"}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page with fade transition */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex-1 overflow-auto p-6 md:p-8"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
      <ChatWidget />
    </div>
  );
}
