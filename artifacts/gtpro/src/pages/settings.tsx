import React from "react";
import { useGetUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { User, SlidersHorizontal, Shield, Bell, LogOut, Webhook, Loader2, Check } from "lucide-react";
import { useAuth } from "@clerk/react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface AlertPrefs {
  emailEnabled:    boolean;
  smsEnabled:      boolean;
  phoneNumber:     string | null;
  onTradeOpen:     boolean;
  onTradeClose:    boolean;
  onStopLoss:      boolean;
  onTakeProfit:    boolean;
  onBotStop:       boolean;
  onHighSignal:    boolean;
  webhookUrl:      string | null;
  webhookEnabled:  boolean;
}

function useAlertPrefs() {
  const { getToken } = useAuth();
  const [prefs,   setPrefs]   = React.useState<AlertPrefs | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving,  setSaving]  = React.useState(false);
  const [saved,   setSaved]   = React.useState(false);

  const authFetch = React.useCallback(async (url: string, init?: RequestInit) => {
    const token = await getToken().catch(() => null);
    return fetch(url, {
      credentials: "include",
      ...init,
      headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  }, [getToken]);

  React.useEffect(() => {
    authFetch(`${BASE}/api/alerts/preferences`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPrefs(d); })
      .finally(() => setLoading(false));
  }, [authFetch]);

  const save = async (updated: AlertPrefs) => {
    setSaving(true);
    await authFetch(`${BASE}/api/alerts/preferences`, { method: "PUT", body: JSON.stringify(updated) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return { prefs, setPrefs, loading, saving, saved, save };
}

function AlertToggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
      <div>
        <Label className="text-[13px] font-semibold cursor-pointer">{label}</Label>
        <p className="text-[12px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

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

function AlertPrefsSection() {
  const { prefs, setPrefs, loading, saving, saved, save } = useAlertPrefs();

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
        <div className="p-6"><Skeleton className="h-40 w-full" /></div>
      </div>
    );
  }

  const p = prefs ?? {
    emailEnabled: false, smsEnabled: false, phoneNumber: null,
    onTradeOpen: true, onTradeClose: true, onStopLoss: true,
    onTakeProfit: true, onBotStop: true, onHighSignal: false,
    webhookUrl: null, webhookEnabled: false,
  };

  const update = (key: keyof AlertPrefs, val: boolean | string | null) => {
    setPrefs({ ...p, [key]: val });
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 50% 6%) 100%)" }}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
            <Webhook size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold">Alert System</h3>
            <p className="text-[12px] text-muted-foreground">Configure SMS alerts and webhook notifications for bot events.</p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-2">
        {/* Delivery toggles */}
        <AlertToggle label="SMS Alerts" desc="Send SMS when key events happen (requires Twilio)."
          checked={p.smsEnabled} onChange={v => update("smsEnabled", v)} />
        {p.smsEnabled && (
          <div className="pb-3 border-b border-white/[0.05]">
            <Input value={p.phoneNumber ?? ""} onChange={e => update("phoneNumber", e.target.value)}
              placeholder="+1 555 000 0000" className="h-9 text-[12px] border-white/[0.1] bg-white/[0.03] max-w-xs" />
          </div>
        )}
        <AlertToggle label="Webhook" desc="POST event payloads to your endpoint."
          checked={p.webhookEnabled} onChange={v => update("webhookEnabled", v)} />
        {p.webhookEnabled && (
          <div className="pb-3 border-b border-white/[0.05]">
            <Input value={p.webhookUrl ?? ""} onChange={e => update("webhookUrl", e.target.value)}
              placeholder="https://your-server.com/hook" className="h-9 text-[12px] border-white/[0.1] bg-white/[0.03] max-w-sm" />
          </div>
        )}

        {/* Event toggles */}
        <div className="pt-2">
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted-foreground/40 mb-2">Trigger Events</p>
          <AlertToggle label="Trade Opened"    desc="Bot enters a new position."           checked={p.onTradeOpen}   onChange={v => update("onTradeOpen", v)} />
          <AlertToggle label="Trade Closed"    desc="Bot exits a position (TP or SL)."     checked={p.onTradeClose}  onChange={v => update("onTradeClose", v)} />
          <AlertToggle label="Stop Loss Hit"   desc="Position closed at stop loss."        checked={p.onStopLoss}    onChange={v => update("onStopLoss", v)} />
          <AlertToggle label="Take Profit Hit" desc="Position closed at take profit."      checked={p.onTakeProfit}  onChange={v => update("onTakeProfit", v)} />
          <AlertToggle label="Bot Stopped"     desc="Bot session ended (manual or limit)." checked={p.onBotStop}     onChange={v => update("onBotStop", v)} />
          <AlertToggle label="High Signal"     desc="ABF engine generates a high-confidence signal." checked={p.onHighSignal} onChange={v => update("onHighSignal", v)} />
        </div>

        <div className="pt-2">
          <Button onClick={() => save(p)} disabled={saving}
            className="h-9 px-4 text-[12px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : null}
            {saved ? "Saved!" : saving ? "Saving…" : "Save Alert Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

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

        {/* Alert System */}
        <AlertPrefsSection />

        {/* Trading preferences */}
        <Section icon={SlidersHorizontal} title="Trading Preferences" desc="Configure platform-wide trading behaviour.">
          <Toggle label="Strict Risk Mode" desc="Halt all bots if global portfolio drawdown exceeds threshold." defaultChecked />
          <Toggle label="Real-Time Tracking" desc="Monitor live market data in real-time." defaultChecked />
          <Toggle label="Auto-reconnect" desc="Re-establish exchange connections after network interruption." defaultChecked />
        </Section>

        {/* Security */}
        <Section icon={Shield} title="Security" desc="Protect your account and API access.">
          <Toggle label="Two-Factor Authentication" desc="Require 2FA for key actions." />
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
