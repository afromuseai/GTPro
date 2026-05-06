import React from "react";
import { Switch, Route, Redirect, Router as WouterRouter, useLocation } from "wouter";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

import { LandingPage } from "@/pages/landing";
import { LandingWrapper } from "@/pages/landing-wrapper";
import { DashboardPage } from "@/pages/dashboard";
import { AnalysisPage } from "@/pages/analysis";
import { LinkedAccountsPage } from "@/pages/linked-accounts";
import { SettingsPage } from "@/pages/settings";
import { BillingPage } from "@/pages/billing";
import { WalletPage } from "@/pages/wallet";
import { AdminPage } from "@/pages/admin";
import { JournalPage } from "@/pages/journal";
import { Setup2FAPage } from "@/pages/setup-2fa";
import { OnboardingPage } from "@/pages/onboarding";
import { TermsPage } from "@/pages/terms";
import { PrivacyPage } from "@/pages/privacy";
import { SecurityPage } from "@/pages/security";
import { AppLayout } from "@/components/layout";
import { DevBypassProvider, useDevBypass, IS_DEV } from "@/contexts/dev-bypass";
import { AdminAuthProvider, useAdminAuth, AdminAuthContext } from "@/contexts/admin-auth";
import { motion } from "framer-motion";
import { BotProvider } from "@/engine/bot-engine";
import { SignalProvider } from "@/engine/signal-engine";
import { FleetProvider } from "@/engine/fleet-engine";
import { MarketDataProvider } from "@/engine/market-data";
import { LiquidityProvider } from "@/engine/liquidity-engine";
import { LearningProvider } from "@/engine/learning/learning-engine";
import { ExchangeProvider } from "@/engine/exchange-engine";
import { WalletProvider } from "@/engine/wallet-engine";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// When no Clerk key is present (local dev without Clerk configured), auto-enable dev bypass
const NO_CLERK = !clerkPubKey;
if (NO_CLERK && IS_DEV) {
  localStorage.setItem("gtpro_dev_bypass", "true");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
  },
  variables: {
    colorPrimary: "#D4AF37",
    colorForeground: "#E8EAED",
    colorMutedForeground: "#718096",
    colorBackground: "#0D1221",
    colorInput: "#1A2035",
    colorInputForeground: "#E8EAED",
    colorNeutral: "#2D3748",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0D1221] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#2D3748]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    formFieldLabel: "text-foreground",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    badge: { display: "none" },
    taggedBadge: { display: "none" },
  },
};

function HideClerkDevBadge() {
  React.useEffect(() => {
    const hide = () => {
      document.querySelectorAll<HTMLAnchorElement>("a").forEach(el => {
        if (el.href?.includes("dashboard.clerk.com") || el.href?.includes("clerk.com/docs")) {
          const badge = el.closest('[class*="taggedBadge"], [class*="Badge"], [class*="footer"]') ?? el.parentElement;
          if (badge) (badge as HTMLElement).style.cssText = "display:none!important";
          (el as HTMLElement).style.cssText = "display:none!important";
        }
      });
      document.querySelectorAll("*").forEach(el => {
        const text = (el as HTMLElement).innerText?.trim();
        if (text === "Development mode" && (el as HTMLElement).children.length === 0) {
          const parent = el.parentElement;
          if (parent) (parent as HTMLElement).style.cssText = "display:none!important";
        }
      });
    };
    hide();
    const observer = new MutationObserver(hide);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}

function PasswordRequirements() {
  const [password, setPassword] = React.useState("");

  const checks = React.useMemo(() => ({
    length:    password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /\d/.test(password),
    special:   /[!@#$%^&*]/.test(password),
  }), [password]);

  const allMet = Object.values(checks).every(Boolean);

  React.useEffect(() => {
    let pwInput: HTMLInputElement | null = null;
    let attachedForm: HTMLFormElement | null = null;

    const onInput = (e: Event) => setPassword((e.target as HTMLInputElement).value);

    const isPasswordValid = (pw: string) =>
      pw.length >= 12 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /\d/.test(pw) &&
      /[!@#$%^&*]/.test(pw);

    const getSubmitBtn = () =>
      document.querySelector<HTMLButtonElement>(
        '.cl-formButtonPrimary, button[type="submit"]'
      );

    const enforceSubmit = () => {
      const submitBtn = getSubmitBtn();
      if (!submitBtn) return;
      const valid = isPasswordValid(pwInput?.value ?? "");
      submitBtn.disabled = !valid;
      submitBtn.style.opacity = valid ? "" : "0.35";
      submitBtn.style.cursor  = valid ? "" : "not-allowed";
      submitBtn.title = valid
        ? ""
        : "Complete all password requirements to continue";
    };

    const onFormSubmit = (e: Event) => {
      if (!isPasswordValid(pwInput?.value ?? "")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        enforceSubmit();
      }
    };

    const attach = () => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="password"]')
      );
      const target = inputs[inputs.length - 1] ?? null;
      if (target && target !== pwInput) {
        pwInput?.removeEventListener("input", onInput);
        pwInput?.removeEventListener("input", enforceSubmit);
        pwInput = target;
        pwInput.addEventListener("input", onInput);
        pwInput.addEventListener("input", enforceSubmit);

        const form = target.closest("form");
        if (form && form !== attachedForm) {
          attachedForm?.removeEventListener("submit", onFormSubmit, true);
          attachedForm = form;
          attachedForm.addEventListener("submit", onFormSubmit, true);
        }
      }
      enforceSubmit();
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      pwInput?.removeEventListener("input", onInput);
      pwInput?.removeEventListener("input", enforceSubmit);
      attachedForm?.removeEventListener("submit", onFormSubmit, true);
      const submitBtn = getSubmitBtn();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "";
        submitBtn.style.cursor  = "";
        submitBtn.title = "";
      }
    };
  }, []);

  if (!password) return null;

  return (
    <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
      <div className="text-[11px] font-bold text-muted-foreground mb-2.5">Password must contain:</div>
      <div className="space-y-1.5">
        {[
          { label: "12+ characters",             met: checks.length },
          { label: "Uppercase letter (A-Z)",      met: checks.uppercase },
          { label: "Lowercase letter (a-z)",      met: checks.lowercase },
          { label: "Number (0-9)",                met: checks.number },
          { label: "Special character (!@#$%^&*)", met: checks.special },
        ].map(({ label, met }) => (
          <div key={label} className="flex items-center gap-2 text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${met ? "bg-emerald-400" : "bg-white/[0.15]"}`} />
            <span className={met ? "text-emerald-400 font-medium" : "text-muted-foreground"}>{label}</span>
          </div>
        ))}
      </div>
      {allMet && (
        <div className="mt-2.5 text-[10px] text-emerald-400 font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          All requirements met
        </div>
      )}
    </div>
  );
}

function DevBypassBanner() {
  const { disable } = useDevBypass();
  const [, navigate] = useLocation();
  if (!IS_DEV) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500/20 border-b border-amber-500/40 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300">
      <span>⚠ Dev bypass active — Clerk auth disabled for local development</span>
      <button
        onClick={() => { disable(); navigate("/"); }}
        className="ml-4 underline hover:text-amber-100 transition-colors"
      >
        Exit
      </button>
    </div>
  );
}

function DevBypassButton() {
  const { enable } = useDevBypass();
  const [, navigate] = useLocation();
  if (!IS_DEV) return null;
  return (
    <div className="mt-4">
      <div className="relative mb-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/30" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground/50">dev only</span>
        </div>
      </div>
      <button
        onClick={() => { enable(); navigate("/dashboard"); }}
        className="w-full text-xs text-amber-500/70 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 rounded-lg py-2 px-4 transition-all bg-amber-500/5 hover:bg-amber-500/10"
      >
        Skip Auth (Dev Mode)
      </button>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% 10%, rgba(212,175,55,0.08) 0%, transparent 60%), hsl(228 55% 4%)" }}>
      <div className="w-full max-w-[480px]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-black mb-2" style={{ color: "#D4AF37" }}>Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to access your trading dashboard</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden p-8"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 7%) 0%, hsl(228 52% 5%) 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          </div>
        </motion.div>
      </div>
      <HideClerkDevBadge />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% 10%, rgba(212,175,55,0.08) 0%, transparent 60%), hsl(228 55% 4%)" }}>
      <div className="w-full max-w-[480px] space-y-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-black mb-2" style={{ color: "#D4AF37" }}>Join GTPro</h1>
            <p className="text-muted-foreground">Create your account to start algorithmic trading</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden p-8"
            style={{ background: "linear-gradient(145deg, hsl(228 45% 7%) 0%, hsl(228 52% 5%) 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/setup-2fa`} />
            <PasswordRequirements />
          </div>
        </motion.div>
      </div>
      <HideClerkDevBadge />
    </div>
  );
}

function HomeRedirect() {
  const { enabled } = useDevBypass();
  if (IS_DEV && enabled) return <Redirect to="/dashboard" />;
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><LandingPage /></Show>
    </>
  );
}

function OnboardingGuard({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [location] = useLocation();
  const [onboardingStatus, setOnboardingStatus] = React.useState<"loading" | "completed" | "pending">("loading");

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const authFetch = async (url: string, opts: RequestInit = {}) => {
      const token = await getToken();
      return fetch(url, {
        ...opts,
        credentials: "include",
        headers: {
          ...(opts.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    };

    const checkOnboarding = async () => {
      const email = user.emailAddresses?.[0]?.emailAddress;
      if (!email) { setOnboardingStatus("completed"); return; }

      try {
        const adminRes = await authFetch(`${basePath}/api/admin/check?email=${encodeURIComponent(email)}`);
        const adminData = await adminRes.json();
        if (adminData.isAdmin) { setOnboardingStatus("completed"); return; }
      } catch {
        // ignore admin check errors — fall through to onboarding check
      }

      if (location === "/onboarding") { setOnboardingStatus("pending"); return; }

      try {
        const res = await authFetch(`${basePath}/api/onboarding/status`);
        if (!res.ok) {
          // API auth failure — treat as completed to avoid false loop
          setOnboardingStatus("completed");
          return;
        }
        const data = await res.json();
        setOnboardingStatus(data.hasCompletedOnboarding ? "completed" : "pending");
      } catch {
        setOnboardingStatus("completed");
      }
    };

    checkOnboarding();
  }, [isLoaded, isSignedIn, user, location, getToken]);

  if (onboardingStatus === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <motion.div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
      </div>
    );
  }

  if (onboardingStatus === "pending") {
    return <OnboardingPage onComplete={async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/onboarding/complete`, {
          method: "POST",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error("Onboarding complete error:", (body as { error?: string }).error ?? "Onboarding completion failed");
        }
      } catch (err) {
        console.error("Onboarding complete error:", err);
      }
      window.location.replace(`${basePath || ""}/dashboard`);
    }} />;
  }

  return <TwoFAGuard component={Component} />;
}

function TwoFAGuard({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [location]               = useLocation();
  const [status, setStatus]      = React.useState<"loading" | "ok" | "incomplete">("loading");
  const [isAdmin, setIsAdmin]    = React.useState(false);

  React.useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const authFetch = async (url: string) => {
      const token = await getToken();
      return fetch(url, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    };

    const check = async () => {
      const email = user.emailAddresses?.[0]?.emailAddress;
      if (!email) { setStatus("ok"); return; }

      try {
        const adminRes = await authFetch(`${basePath}/api/admin/check?email=${encodeURIComponent(email)}`);
        const adminData = await adminRes.json();
        if (adminData.isAdmin) { setIsAdmin(true); setStatus("ok"); return; }
      } catch {
        // ignore
      }

      try {
        const res = await authFetch(`${basePath}/api/auth/2fa/status`);
        if (!res.ok) { setStatus("ok"); return; }
        const data = await res.json();
        setStatus(data.signupCompleted ? "ok" : "incomplete");
      } catch {
        setStatus("ok");
      }
    };

    check();
  }, [isLoaded, isSignedIn, user, getToken]);

  if (!isLoaded || status === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <motion.div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
      </div>
    );
  }

  // Already on setup-2fa — always allow through to avoid redirect loop
  if (location === "/setup-2fa") return <AppLayout><Component /></AppLayout>;

  // Admins skip 2FA
  if (isAdmin) return <AppLayout><Component /></AppLayout>;

  if (status === "incomplete") return <Redirect to="/setup-2fa" />;

  return <AppLayout><Component /></AppLayout>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { enabled } = useDevBypass();
  if (IS_DEV && enabled) {
    return (
      <>
        <DevBypassBanner />
        <AppLayout devMode><Component /></AppLayout>
      </>
    );
  }
  return (
    <>
      <Show when="signed-in">
        <OnboardingGuard component={Component} />
      </Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function AdminRoute() {
  const { isAdmin, loading } = useAdminAuth();
  const { enabled } = useDevBypass();

  if (IS_DEV && enabled) return <AdminPage />;

  if (loading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <motion.div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full"
        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
    </div>
  );
  if (!isAdmin) return <Redirect to="/sign-in" />;
  return <AdminPage />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = React.useRef<string | null | undefined>(undefined);

  React.useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function NoClerkAdminProvider({ children }: { children: React.ReactNode }) {
  const { enabled } = useDevBypass();
  return (
    <AdminAuthContext.Provider value={{ isAdmin: IS_DEV && enabled, loading: false }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/setup-2fa" component={() => <ProtectedRoute component={Setup2FAPage} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/admin" component={AdminRoute} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/analysis" component={() => <ProtectedRoute component={AnalysisPage} />} />
      <Route path="/journal" component={() => <ProtectedRoute component={JournalPage} />} />
      <Route path="/linked-accounts" component={() => <ProtectedRoute component={LinkedAccountsPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/billing" component={() => <ProtectedRoute component={BillingPage} />} />
      <Route path="/wallet" component={() => <ProtectedRoute component={WalletPage} />} />
      <Route path="/home" component={LandingWrapper} />
      <Route path="/:rest*" component={() => (
        <ProtectedRoute component={() => <div className="p-8 text-muted-foreground">Work in progress</div>} />
      )} />
    </Switch>
  );
}

export default function App() {
  return (
    <DevBypassProvider>
      <QueryClientProvider client={queryClient}>
        <MarketDataProvider>
        <LiquidityProvider>
        <LearningProvider>
        <FleetProvider>
        <BotProvider>
          <SignalProvider>
            <WouterRouter base={basePath}>
              {NO_CLERK ? (
                <NoClerkAdminProvider>
                  <AppRoutes />
                </NoClerkAdminProvider>
              ) : (
                <ClerkProvider
                  publishableKey={clerkPubKey!}
                  proxyUrl={clerkProxyUrl}
                  appearance={clerkAppearance}
                  signInUrl={`${basePath}/sign-in`}
                  signUpUrl={`${basePath}/sign-up`}
                >
                  <AdminAuthProvider>
                    <ClerkQueryClientCacheInvalidator />
                    <ExchangeProvider>
                    <WalletProvider>
                      <AppRoutes />
                    </WalletProvider>
                    </ExchangeProvider>
                  </AdminAuthProvider>
                </ClerkProvider>
              )}
            </WouterRouter>
            <Toaster />
          </SignalProvider>
        </BotProvider>
        </FleetProvider>
        </LearningProvider>
        </LiquidityProvider>
        </MarketDataProvider>
      </QueryClientProvider>
    </DevBypassProvider>
  );
}
