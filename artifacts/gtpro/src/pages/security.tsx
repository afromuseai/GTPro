import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Shield, CheckCircle2, AlertCircle } from "lucide-react";

export function SecurityPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-white/[0.05] sticky top-0 z-40" style={{ background: "rgba(5, 8, 16, 0.95)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} /> Back
            </button>
          </Link>
          <h1 className="text-xl font-black" style={{ color: "#D4AF37" }}>Security & Compliance</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Your Security Is Our Priority</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              GTPro implements institutional-grade security standards to protect your account, data, and assets.
            </p>
          </div>
        </motion.div>

        {/* Core Security Features */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <h3 className="text-2xl font-black">Core Security Features</h3>

          <div className="grid gap-6">
            {[
              {
                icon: Lock,
                title: "Mandatory Two-Factor Authentication (2FA)",
                desc: "Every account requires 2FA via TOTP (time-based one-time password) and real phone verification. This prevents unauthorized access even if credentials are compromised.",
                color: "text-emerald-400",
              },
              {
                icon: Shield,
                title: "VOIP & Temporary Email Blocking",
                desc: "Phone verification rejects VOIP services and temporary email providers. Only legitimate phone numbers and permanent email addresses pass verification — preventing account takeovers.",
                color: "text-primary",
              },
              {
                icon: Lock,
                title: "Zero Withdrawal Permissions",
                desc: "GTPro never requests withdrawal access. API keys are configured for execution only — your funds remain under your exclusive control in your own exchange accounts.",
                color: "text-blue-400",
              },
              {
                icon: CheckCircle2,
                title: "AES-256 Encryption",
                desc: "All sensitive data, including API credentials and account information, is encrypted at rest using AES-256. Keys are never transmitted to third-party servers or stored in plain text.",
                color: "text-violet-400",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex gap-4 p-6 rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.color} bg-white/[0.05] border border-white/[0.1]`}>
                  <item.icon size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-[16px] mb-2">{item.title}</h4>
                  <p className="text-muted-foreground text-[14px] leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* No-Custody Model */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6 rounded-2xl border border-primary/20 p-8"
          style={{ background: "linear-gradient(145deg, rgba(200,168,75,0.05) 0%, transparent 100%)" }}
        >
          <h3 className="text-2xl font-black">No-Custody Model</h3>
          <p className="text-muted-foreground leading-relaxed">
            GTPro operates on a strict no-custody model. This means:
          </p>
          <ul className="space-y-3">
            {[
              "Your capital remains in your exchange accounts at all times",
              "GTPro never holds, manages, or moves your funds",
              "You maintain 100% control of your assets",
              "API connections are configured for execution simulation only",
              "All trading activity is simulated and display-only",
            ].map((point, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex gap-3 text-[14px]"
              >
                <CheckCircle2 size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <span>{point}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* Data Security */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <h3 className="text-2xl font-black">Data Security & Privacy</h3>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Data Protection",
                points: [
                  "End-to-end encryption for sensitive communications",
                  "Secure HTTPS connections for all API calls",
                  "Regular security audits and penetration testing",
                  "Compliance with industry security standards",
                ],
              },
              {
                title: "Access Control",
                points: [
                  "Role-based access control (RBAC) for staff",
                  "Strict authentication requirements for admin access",
                  "Audit logs for all account changes",
                  "Session timeout and re-authentication for sensitive operations",
                ],
              },
              {
                title: "Incident Response",
                points: [
                  "24/7 security monitoring",
                  "Rapid incident response protocols",
                  "User notification in case of security events",
                  "Regular backup and disaster recovery testing",
                ],
              },
              {
                title: "Compliance",
                points: [
                  "GDPR compliant data handling",
                  "SOC 2 security frameworks",
                  "Regular compliance audits",
                  "Transparent privacy and security policies",
                ],
              },
            ].map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="rounded-xl border border-white/[0.06] p-6"
                style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
              >
                <h4 className="font-bold text-[15px] mb-4 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary" />
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.points.map((point, j) => (
                    <li key={j} className="text-[13px] text-muted-foreground flex gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Important Disclaimers */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6 rounded-2xl border border-amber-400/20 p-8"
          style={{ background: "linear-gradient(145deg, rgba(217,119,6,0.05) 0%, transparent 100%)" }}
        >
          <div className="flex gap-3">
            <AlertCircle size={24} className="text-amber-400 flex-shrink-0" />
            <h3 className="text-2xl font-black text-amber-300">Important Disclaimers</h3>
          </div>

          <ul className="space-y-3">
            {[
              "GTPro is a simulation and analysis platform — not a financial services provider or investment advisor",
              "All trading performance shown is simulated and does not represent real financial results",
              "Service credits are non-withdrawable and used exclusively for platform features",
              "GTPro does not provide financial advice or trading recommendations",
              "Users are solely responsible for their use of GTPro and any decisions made based on platform outputs",
              "Past simulated performance is not indicative of future results",
            ].map((point, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex gap-3 text-[14px]"
              >
                <span className="text-amber-400 mt-1">⚠</span>
                <span>{point}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* Report Security Issue */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="space-y-6 rounded-2xl border border-white/[0.06] p-8 text-center"
          style={{ background: "linear-gradient(145deg, hsl(228 45% 8%) 0%, hsl(228 52% 5%) 100%)" }}
        >
          <h3 className="text-2xl font-black">Found a Security Issue?</h3>
          <p className="text-muted-foreground max-w-xl mx-auto">
            If you discover a security vulnerability, please email <span className="font-mono text-primary">security@gtpro.io</span> instead of disclosing it publicly. We take all reports seriously and will respond promptly.
          </p>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6 py-12"
        >
          <p className="text-muted-foreground">
            Have questions about security? <Link href="/"><a className="text-primary hover:text-primary/80 underline">Contact support</a></Link>
          </p>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-8 px-6" style={{ background: "hsl(228 52% 4%)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[12px] text-muted-foreground/60">
            &copy; {new Date().getFullYear()} GTPro Trading Technologies. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
