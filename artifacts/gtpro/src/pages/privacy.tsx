import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-white/[0.05] sticky top-0 z-40" style={{ background: "rgba(5, 8, 16, 0.95)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} /> Back
            </button>
          </Link>
          <h1 className="text-xl font-black" style={{ color: "#D4AF37" }}>Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-12">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Last updated: May 3, 2026</p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              GTPro is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your personal information.
            </p>
          </div>

          {[
            {
              num: "1",
              title: "Information We Collect",
              items: [
                "Account Information: Email, password, name, and phone number",
                "Profile Data: Account settings, preferences, and configuration",
                "Activity Data: Bot sessions, execution history, strategy deployments, and performance metrics",
                "Device & Session Data: IP address, browser type, device information, and session duration",
                "Communication Data: Support tickets, feedback, and messages sent through the platform",
              ],
            },
            {
              num: "2",
              title: "How We Use Your Information",
              items: [
                "Provide & Improve Services: Deliver GTPro features and optimize platform performance",
                "Personalization: Customize your experience and show relevant recommendations",
                "Security & Compliance: Prevent fraud, enforce Terms of Service, and comply with legal obligations",
                "Analytics: Understand user behavior to improve platform functionality",
                "Communication: Send transactional emails, security alerts, and platform updates",
                "Support: Respond to user inquiries and resolve issues",
              ],
            },
            {
              num: "3",
              title: "Data Protection & Security",
              items: [
                "Encryption: Sensitive data is encrypted in transit (HTTPS) and at rest (AES-256)",
                "Access Controls: Only authorized employees can access personal data",
                "Security Measures: Regular security audits, monitoring, and incident response protocols",
                "Secure Infrastructure: Data stored on secure, encrypted servers",
                "No Third-Party Sale: We never sell personal data to third parties",
              ],
            },
            {
              num: "4",
              title: "Third-Party Services",
              items: [
                "Clerk Authentication: Handles user authentication and identity verification",
                "Cloud Infrastructure: Data hosted on secure cloud providers (AWS/similar)",
                "Payment Processing: Payment data handled through PCI-compliant processors (not stored by GTPro)",
                "Analytics: Usage analytics tracked to improve platform performance",
                "Each third party is contractually obligated to maintain data security and confidentiality",
              ],
            },
            {
              num: "5",
              title: "Cookies & Tracking",
              items: [
                "Session Cookies: Used to maintain your login session and user preferences",
                "Functional Cookies: Enable core platform features",
                "Analytics Cookies: Track usage patterns to improve the service",
                "No Cross-Site Tracking: We do not track users across third-party websites",
                "You can disable cookies in browser settings (may affect functionality)",
              ],
            },
            {
              num: "6",
              title: "Data Retention",
              items: [
                "Active Accounts: Data retained while your account is active",
                "Deleted Accounts: Personal data deleted within 30 days of account deletion",
                "Backups: Data may remain in backups for 90 days for disaster recovery",
                "Compliance: Some data retained to comply with legal and regulatory requirements",
              ],
            },
            {
              num: "7",
              title: "Your Rights",
              items: [
                "Access: Request a copy of your personal data",
                "Correction: Update or correct inaccurate information",
                "Deletion: Request deletion of your account and data (subject to legal holds)",
                "Portability: Receive your data in a portable format",
                "Opt-Out: Unsubscribe from marketing communications anytime",
                "To exercise these rights, contact privacy@gtpro.io",
              ],
            },
            {
              num: "8",
              title: "International Data Transfers",
              items: [
                "GTPro operates globally and may transfer data to different regions",
                "All transfers comply with applicable data protection laws",
                "Data is protected by equivalent security standards worldwide",
              ],
            },
            {
              num: "9",
              title: "GDPR & Regional Compliance",
              items: [
                "EU/EEA Users: Data processing complies with GDPR requirements",
                "California Residents: Data handling complies with CCPA regulations",
                "All Users: Subject to our standard privacy protections regardless of location",
              ],
            },
            {
              num: "10",
              title: "Children's Privacy",
              items: [
                "GTPro is not intended for users under 18 years old",
                "We do not knowingly collect data from minors",
                "If we discover child data, we will delete it immediately",
              ],
            },
            {
              num: "11",
              title: "Data Breach Notification",
              items: [
                "In case of a data breach, affected users will be notified promptly",
                "Notification will include details of the breach and protective measures taken",
                "Notifications comply with applicable legal requirements",
              ],
            },
            {
              num: "12",
              title: "Policy Updates",
              items: [
                "We may update this Privacy Policy to reflect changes in practice or law",
                "Material changes will be announced via email or platform notification",
                "Continued use constitutes acceptance of updated privacy policies",
              ],
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
              {section.items && (
                <ul className="space-y-2 ml-11">
                  {section.items.map((item, j) => (
                    <li key={j} className="text-[13px] text-muted-foreground flex gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
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
            <p className="text-sm font-bold text-primary">Privacy Inquiries</p>
            <p className="text-[13px] text-muted-foreground">
              For privacy-related questions or to exercise your data rights, contact us at{" "}
              <span className="font-mono text-primary">privacy@gtpro.io</span>
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
