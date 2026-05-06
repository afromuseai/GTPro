import React from "react";
import { useGetUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { User, SlidersHorizontal, Shield, Bell, LogOut } from "lucide-react";

const Section = ({ icon: Icon, title, desc, children }: { icon: React.ElementType, title: string, desc: string, children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
    style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
    <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    <div className="p-6 border-b border-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
          <Icon size={16} className="text-primary" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold">{title}</h3>
          <p className="text-[12px] text-muted-foreground">{desc}</p>
        </div>
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const Toggle = ({ label, desc, defaultChecked = false }: { label: string, desc: string, defaultChecked?: boolean }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
    <div>
      <Label className="text-[13px] font-semibold cursor-pointer">{label}</Label>
      <p className="text-[12px] text-muted-foreground mt-0.5">{desc}</p>
    </div>
    <Switch defaultChecked={defaultChecked} />
  </div>
);

export function SettingsPage() {
  const { data: profile, isLoading } = useGetUserProfile({ query: { queryKey: getGetUserProfileQueryKey() } });

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full">

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-black tracking-tight">Settings</h2>
        <p className="text-[13px] text-muted-foreground mt-1">Manage your account, preferences, and security.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="space-y-5"
      >

        {/* Profile */}
        <Section icon={User} title="Profile" desc="Your identity and account details.">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-8 w-48" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar"
                    className="w-14 h-14 rounded-2xl border-2 border-primary/20 object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 border-2 border-primary/20 flex items-center justify-center text-xl font-black text-primary">
                    {profile?.displayName?.charAt(0) ?? "T"}
                  </div>
                )}
                <div>
                  <div className="text-[16px] font-bold">{profile?.displayName ?? "Trader"}</div>
                  <div className="text-[13px] text-muted-foreground">{profile?.email ?? "—"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-white/[0.06] p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Plan</div>
                  <div className="text-[14px] font-bold text-primary">Pro</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Member Since</div>
                  <div className="text-[14px] font-bold">
                    {profile?.createdAt ? format(new Date(profile.createdAt), "MMM yyyy") : "—"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications" desc="Control how and when GTPro contacts you.">
          <Toggle label="Email Alerts" desc="Daily P&L summaries and critical system events." defaultChecked />
          <Toggle label="Trade Confirmations" desc="Email on every executed order." />
          <Toggle label="Risk Breach Alerts" desc="Immediate notification when drawdown limits are hit." defaultChecked />
        </Section>

        {/* Trading preferences */}
        <Section icon={SlidersHorizontal} title="Trading Preferences" desc="Configure platform-wide trading behaviour.">
          <Toggle label="Strict Risk Mode" desc="Halt all bots if global portfolio drawdown exceeds threshold." defaultChecked />
          <Toggle label="Real-Time Tracking" desc="Monitor live market data in real-time." defaultChecked />
          <Toggle label="Auto-reconnect" desc="Re-establish exchange connections after network interruption." defaultChecked />
        </Section>

        {/* Security */}
        <Section icon={Shield} title="Security" desc="Protect your account and API access.">
          <Toggle label="Two-Factor Authentication" desc="Require 2FA for key actions and withdrawals." />
          <Toggle label="API Key Expiry Reminders" desc="Alert 7 days before exchange API keys expire." defaultChecked />
          <Toggle label="Session Timeout" desc="Auto-logout after 30 minutes of inactivity." />
        </Section>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-500/15 p-5 flex items-center justify-between"
          style={{ background: "rgba(239,68,68,0.04)" }}>
          <div className="flex items-center gap-3">
            <LogOut size={16} className="text-red-400 shrink-0" />
            <div>
              <div className="text-[13px] font-semibold text-red-400">Sign Out All Devices</div>
              <div className="text-[12px] text-muted-foreground">Revoke all active sessions immediately.</div>
            </div>
          </div>
          <Button variant="outline" size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300 text-[12px] font-semibold transition-all">
            Sign Out All
          </Button>
        </div>

      </motion.div>
    </div>
  );
}
