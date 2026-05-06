import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-white/[0.05] sticky top-0 z-40" style={{ background: "rgba(5, 8, 16, 0.95)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} /> Back
            </button>
          </Link>
          <h1 className="text-xl font-black" style={{ color: "#D4AF37" }}>Terms of Service</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-12">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Last updated: May 3, 2026</p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              These Terms of Service ("Terms") govern your use of GTPro and its services. By accessing or using GTPro, you agree to be bound by these Terms.
            </p>
          </div>

          {[
            {
              num: "1",
              title: "Service Overview",
              content:
                "GTPro is a professional algorithmic trading intelligence and automation platform providing real-time market analysis and execution tooling. GTPro enables users to deploy automated trading strategies against live markets and analyze real-time market conditions using AI-driven signal systems.",
            },
            {
              num: "2",
              title: "Service Credits & Payments",
              content:
                "GTPro operates on a service credit system. Users deposit funds as service credits to access platform features including bot execution and AI analysis. All deposited credits are non-refundable and non-withdrawable. Credits can only be used to purchase platform services.",
            },
            {
              num: "3",
              title: "No Financial Advice",
              content:
                "GTPro does not provide personal financial advice or investment recommendations. GTPro is not a registered brokerage or investment advisor. Algorithmic signals and performance metrics represent the output of quantitative models operating on live market data and do not constitute personalized financial guidance. Users are solely responsible for their own trading decisions.",
            },
            {
              num: "4",
              title: "Risk Disclosure",
              content:
                "Algorithmic trading involves substantial risk of loss. Past signal performance does not guarantee future results. Market conditions, latency, exchange fees, and slippage may affect execution quality. Users should only trade with capital they can afford to lose and should implement appropriate risk management controls.",
            },
            {
              num: "5",
              title: "No Custody of Funds",
              content:
                "GTPro does not hold, manage, or control any user funds or assets. Users maintain exclusive control of their exchange accounts and capital. GTPro never requests withdrawal permissions or access to user assets.",
            },
            {
              num: "6",
              title: "User Responsibility",
              content:
                "Users are solely responsible for how they interpret and use GTPro's analysis and outputs. Users acknowledge that trading involves risk. GTPro is not liable for any financial losses, decisions, or actions taken outside the platform based on GTPro outputs.",
            },
            {
              num: "7",
              title: "Account Usage & Security",
              content:
                "Users agree to provide accurate account information and maintain the security of their accounts. Users must comply with all applicable laws and regulations. GTPro reserves the right to suspend or terminate accounts that violate these Terms or engage in abusive behavior.",
            },
            {
              num: "8",
              title: "Intellectual Property",
              content:
                "All GTPro content, design, algorithms, and technology are proprietary. Users may not reverse-engineer, copy, or redistribute GTPro's intellectual property without explicit permission.",
            },
            {
              num: "9",
              title: "Disclaimers & Limitations",
              content:
                "GTPro is provided 'as-is' without warranties of any kind. GTPro does not guarantee accuracy, availability, or uninterrupted service. GTPro is not liable for any indirect, incidental, or consequential damages arising from use of the platform.",
            },
            {
              num: "10",
              title: "Service Modifications",
              content:
                "GTPro may modify features, pricing, or service terms at any time. GTPro will notify users of material changes. Continued use of GTPro after changes constitutes acceptance of the new terms.",
            },
            {
              num: "11",
              title: "Termination",
              content:
                "GTPro may terminate user accounts for violation of these Terms, abusive behavior, or at GTPro's discretion. Users may delete their accounts at any time through account settings.",
            },
            {
              num: "12",
              title: "Acceptance",
              content:
                "By using GTPro, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, do not use GTPro.",
            },
          ].map((section, i) => (
            <motion.section
              key={section.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="space-y-3 pb-8 border-b border-white/[0.05]"
            >
              <h2 className="text-xl font-bold flex items-center gap-3">
                <span className="text-primary text-lg font-black w-8">{section.num}</span>
                {section.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed text-[14px]">{section.content}</p>
            </motion.section>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="rounded-xl border border-primary/20 p-6 space-y-3"
            style={{ background: "linear-gradient(145deg, rgba(200,168,75,0.05) 0%, transparent 100%)" }}
          >
            <p className="text-sm font-bold text-primary">Questions?</p>
            <p className="text-[13px] text-muted-foreground">
              If you have questions about these Terms, please contact us at{" "}
              <span className="font-mono text-primary">support@gtpro.io</span>
            </p>
          </motion.div>
        </motion.div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 px-6 mt-16" style={{ background: "hsl(228 52% 4%)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[12px] text-muted-foreground/60">
            &copy; {new Date().getFullYear()} GTPro Trading Technologies. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
