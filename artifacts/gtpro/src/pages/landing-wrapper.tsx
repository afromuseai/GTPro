import React from "react";
import { Link } from "wouter";
import { LandingPage } from "@/pages/landing";
import { motion } from "framer-motion";
import { LayoutDashboard } from "lucide-react";
import { useDevBypass, IS_DEV } from "@/contexts/dev-bypass";
import { Show } from "@clerk/react";

function DashboardBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.6 }}
      className="fixed top-4 right-4 z-[9999]"
    >
      <Link href="/dashboard">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold tracking-wide border border-primary/40 shadow-[0_4px_20px_rgba(212,175,55,0.2)] transition-all"
          style={{ background: "linear-gradient(135deg, hsl(43 74% 45%) 0%, hsl(43 74% 35%) 100%)", color: "hsl(228 50% 6%)" }}
        >
          <LayoutDashboard size={13} />
          Go to Dashboard
        </motion.button>
      </Link>
    </motion.div>
  );
}

function DevDashboardBanner() {
  const { enabled } = useDevBypass();
  if (!IS_DEV || !enabled) return null;
  return <DashboardBanner />;
}

export function LandingWrapper() {
  return (
    <>
      {/* Show "Go to Dashboard" for dev bypass users */}
      <DevDashboardBanner />
      {/* Show "Go to Dashboard" for signed-in Clerk users */}
      {!IS_DEV && (
        <Show when="signed-in">
          <DashboardBanner />
        </Show>
      )}
      <LandingPage />
    </>
  );
}
