import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Zap, BarChart3, Brain, AlertCircle, ChevronRight } from "lucide-react";

const EASE_CUBIC: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

const STEPS = [
  {
    id: 1,
    title: "Welcome to GTPro",
    icon: Zap,
  },
  {
    id: 2,
    title: "How GTPro Works",
    icon: Brain,
  },
  {
    id: 3,
    title: "Service-Based Credits",
    icon: BarChart3,
  },
  {
    id: 4,
    title: "Real-Time Execution",
    icon: AlertCircle,
  },
  {
    id: 5,
    title: "Confirmation",
    icon: CheckCircle2,
  },
];

interface OnboardingProps {
  onComplete: () => Promise<void>;
}

export function OnboardingPage({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [understood, setUnderstood] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await onComplete();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(200,168,75,0.08) 0%, transparent 60%), hsl(228 55% 4%)",
          }}
        />
      </div>

      {/* Modal container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_CUBIC }}
        className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/[0.08] p-8 md:p-12 backdrop-blur-xl"
        style={{
          background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)",
          boxShadow: "0 48px 140px rgba(0,0,0,0.85), 0 0 80px rgba(200,168,75,0.07), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Progress indicator */}
        <div className="flex justify-between items-center mb-10">
          {STEPS.map((step, i) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/50 scale-110"
                      : isCompleted
                        ? "bg-primary/30 text-primary"
                        : "bg-white/[0.05] text-muted-foreground/60 border border-white/[0.1]"
                  }`}
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.8 }}
                >
                  {isCompleted ? <CheckCircle2 size={20} /> : step.id}
                </motion.div>
                <span className="text-[9px] font-bold tracking-wider uppercase text-muted-foreground/50 mt-2 text-center hidden md:block">
                  Step {step.id}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: EASE_CUBIC }}
          >
            {currentStep === 1 && <StepWelcome />}
            {currentStep === 2 && <StepHowItWorks />}
            {currentStep === 3 && <StepBilling />}
            {currentStep === 4 && <StepTransparency />}
            {currentStep === 5 && <StepConfirmation understood={understood} setUnderstood={setUnderstood} />}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex justify-between gap-4 mt-10">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-6 h-10"
          >
            Back
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={handleNext}
              className="px-8 h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Continue <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={!understood || isSubmitting}
              className="px-8 h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "Loading..." : "Enter Dashboard"}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Step Components ───────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <motion.div
          className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Zap size={28} className="text-primary" />
        </motion.div>
      </div>

      <div>
        <h2 className="text-3xl font-black mb-3">Welcome to GTPro</h2>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Command intelligent trading systems powered by AI-driven analysis, execution simulation, and continuous optimization.
        </p>
      </div>

      <p className="text-sm text-muted-foreground/60">Let's set you up for success in 5 quick steps.</p>
    </div>
  );
}

function StepHowItWorks() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-black mb-2">How GTPro Works</h2>
        <p className="text-muted-foreground">Three core components power your trading.</p>
      </div>

      <div className="grid gap-4">
        {[
          {
            num: "01",
            title: "AI Analysis",
            desc: "Bot fleets analyze market conditions and generate trading signals.",
            icon: Brain,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
          },
          {
            num: "02",
            title: "Real-Time Execution",
            desc: "Trades execute against live market feeds with real API latency tracking and actual fill prices.",
            icon: Zap,
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            num: "03",
            title: "Continuous Learning",
            desc: "The system adapts and improves using performance feedback.",
            icon: BarChart3,
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
          },
        ].map((item, i) => (
          <motion.div
            key={item.num}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="flex gap-4 p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-colors"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.bg}`}>
              <item.icon size={18} className={item.color} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted-foreground/60 mb-0.5">{item.num}</div>
              <div className="font-bold text-sm">{item.title}</div>
              <div className="text-[13px] text-muted-foreground">{item.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StepBilling() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-black mb-2">Service-Based Credits</h2>
      </div>

      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          GTPro uses a credit-based system. You deposit funds to access services like bot execution and AI analysis.
        </p>

        <div
          className="rounded-2xl border border-primary/20 p-6"
          style={{ background: "linear-gradient(145deg, rgba(200,168,75,0.05) 0%, transparent 100%)" }}
        >
          <div className="space-y-3">
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Credits are used for system operations</span>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Credits decrease based on usage (pay-per-use model)</span>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Optional subscription plans for higher usage</span>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">Transparent pricing — no hidden fees</span>
            </div>
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground/60 text-center">
          Deposit service credits to run AI-driven trading operations with full transparency and real-time monitoring.
        </p>
      </div>
    </div>
  );
}

function StepTransparency() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-black mb-2">Real-Time Intelligence</h2>
        <p className="text-muted-foreground text-sm">Important things to understand</p>
      </div>

      <div
        className="rounded-2xl border border-amber-400/20 p-6 space-y-4"
        style={{ background: "linear-gradient(145deg, rgba(217,119,6,0.05) 0%, transparent 100%)" }}
      >
        <div className="flex gap-3">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-300 mb-1">Funds Are Not Withdrawable</div>
            <p className="text-sm text-muted-foreground">Service credits can only be used for platform features. They cannot be converted back to cash.</p>
          </div>
        </div>

        <div className="h-px bg-white/[0.05]" />

        <div className="flex gap-3">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-300 mb-1">Live Market Data</div>
            <p className="text-sm text-muted-foreground">All signals are analyzed against real-time BTC/USDT data from CoinGecko. Execution happens live via Binance Futures when API keys are connected, or tracked with real market pricing.</p>
          </div>
        </div>

        <div className="h-px bg-white/[0.05]" />

        <div className="flex gap-3">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-300 mb-1">Your Assets Are Secure</div>
            <p className="text-sm text-muted-foreground">GTPro uses AES-256-GCM encryption for API credentials. You control all execution via encrypted key management. No assets are held by GTPro.</p>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground/60 text-center italic">GTPro is an AI-powered trading intelligence platform with real-time market analysis and execution capabilities.</p>
    </div>
  );
}

function StepConfirmation({ understood, setUnderstood }: { understood: boolean; setUnderstood: (v: boolean) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-black mb-2">You're All Set</h2>
        <p className="text-muted-foreground">Confirm you understand the platform before accessing your dashboard.</p>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.1] cursor-pointer transition-all hover:bg-white/[0.02]">
          <input
            type="checkbox"
            checked={understood}
            onChange={e => setUnderstood(e.target.checked)}
            className="w-5 h-5 rounded border border-primary/40 checked:bg-primary checked:border-primary flex-shrink-0 mt-0.5 cursor-pointer"
          />
          <span className="text-sm leading-relaxed">
            I understand that GTPro is a <span className="font-bold text-primary">real-time AI trading platform</span>. Service credits
            are <span className="font-bold text-amber-400">non-withdrawable</span>, and I control execution via my encrypted Binance API keys.
            <span className="font-bold text-blue-400"> Live market data</span> powers all signals. GTPro does not hold or manage my assets.
          </span>
        </label>

        {understood && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 flex gap-3"
          >
            <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-300">Great! You're ready to explore GTPro.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
