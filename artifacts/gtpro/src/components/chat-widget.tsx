import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Loader2, ChevronDown, Sparkles, User } from "lucide-react";
import { useMarketData } from "@/engine/market-data";
import { useLiquidity } from "@/engine/liquidity-engine";
import { useLearning } from "@/engine/learning/learning-engine";

interface Message {
  id:        string;
  role:      "user" | "assistant";
  content:   string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "What does a liquidity sweep mean?",
  "Explain the Sweep & Reclaim strategy",
  "How does the ABF fleet generate signals?",
  "What's good risk management?",
];

export function ChatWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm GTPro AI. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread]   = useState(0);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const abortRef   = useRef<AbortController | null>(null);
  const loadingRef = useRef(false); // ref mirror of loading for guard

  // Use refs for market data to avoid stale-closure issues in callback
  const marketRef   = useRef(useMarketData());
  const liquidityRef = useRef(useLiquidity());
  const learningRef = useRef(useLearning());
  const market    = useMarketData();
  const liquidity = useLiquidity();
  const learning  = useLearning();
  marketRef.current    = market;
  liquidityRef.current = liquidity;
  learningRef.current  = learning;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
      setUnread(0);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: trimmed, timestamp: new Date(),
    };
    const assistantId = crypto.randomUUID();

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);
    setInput("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Snapshot market data from refs to avoid stale closure
    const m = marketRef.current;
    const l = liquidityRef.current;
    const lr = learningRef.current;

    const payload = {
      messages: [
        { role: "user" as const, content: trimmed },
      ],
      marketContext: {
        currentPrice:  m.currentPrice,
        trend:         m.trend,
        volatility:    m.volatility,
        sweepDetected: l.sweepDetected,
        absorption:    l.absorption,
        imbalance:     l.imbalance,
        nearestZone:   l.nearestZone?.label,
        winRate:       lr.overallWinRate,
        bestStrategy:  lr.bestStrategy,
      },
    };

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   full    = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process all complete lines
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trimEnd();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");

          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
            if (data.done) {
              // stream complete — ensure final content is set
              if (full) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId ? { ...m, content: full } : m
                ));
              }
              break;
            }
            if (data.content) {
              full += data.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: full } : m
              ));
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      // If model returned nothing, show fallback in the message
      if (!full) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "No response received — please try again." }
            : m
        ));
      }

      if (!open) setUnread(u => u + 1);
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "Sorry, I couldn't reach the assistant. Please try again." }
          : m
      ));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [open]); // minimal deps — uses refs for all live data

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* ── Floating button ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 px-3 py-2 rounded-full border border-primary/30 bg-[hsl(228_45%_8%)] text-[11px] font-semibold text-primary/70 shadow-lg cursor-pointer hover:text-primary hover:border-primary/50 transition-colors"
              onClick={() => setOpen(true)}
            >
              <Sparkles size={11} className="text-primary" />
              Ask AI Assistant
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(o => !o)}
          className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-primary/40 transition-all duration-300"
          style={{ background: "linear-gradient(135deg, hsl(43 74% 45%) 0%, hsl(43 74% 35%) 100%)" }}
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <span className="text-[hsl(228_50%_6%)] text-lg font-black">✕</span>
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Bot size={22} className="text-[hsl(228_50%_6%)]" />
              </motion.div>
            )}
          </AnimatePresence>
          {unread > 0 && !open && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
              {unread}
            </span>
          )}
        </motion.button>
      </div>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[540px] flex flex-col rounded-2xl border border-white/[0.1] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
            style={{ background: "linear-gradient(160deg, hsl(228 50% 7%) 0%, hsl(228 45% 5%) 100%)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"
              style={{ background: "linear-gradient(90deg, hsl(43 74% 45% / 0.12) 0%, transparent 100%)" }}>
              <div className="flex items-center gap-2.5">
                <img src="/ai-assistant-avatar.png" alt="GTPro AI Assistant" 
                  className="w-8 h-8 rounded-full border border-primary/30 object-cover" />
                <div>
                  <div className="text-[13px] font-bold text-foreground">GTPro AI</div>
                  <div className="flex items-center gap-1.5">
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                    <span className="text-[10px] text-muted-foreground/50">Live market context active</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {msg.role === "assistant" ? (
                    <img src="/ai-assistant-avatar.png" alt="Assistant" 
                      className="w-6 h-6 rounded-full shrink-0 border border-primary/30 object-cover mt-0.5" />
                  ) : (
                    <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 border border-white/[0.1] bg-white/[0.06]">
                      <User size={10} className="text-muted-foreground/60" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary/15 border border-primary/20 text-foreground rounded-tr-sm"
                      : "bg-white/[0.04] border border-white/[0.06] text-foreground/90 rounded-tl-sm"
                  }`}>
                    {msg.content || (
                      <span className="flex items-center gap-1.5">
                        <motion.span className="w-1.5 h-1.5 rounded-full bg-primary/50"
                          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
                        <motion.span className="w-1.5 h-1.5 rounded-full bg-primary/50"
                          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
                        <motion.span className="w-1.5 h-1.5 rounded-full bg-primary/50"
                          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {messages.length <= 2 && !loading && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-[10px] px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary/60 hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-white/[0.05]">
              <div className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about signals, strategies, liquidity…"
                  rows={1}
                  disabled={loading}
                  className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/30 outline-none min-h-[20px] max-h-[80px] overflow-y-auto leading-relaxed disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-30"
                  style={{ background: input.trim() && !loading ? "linear-gradient(135deg, hsl(43 74% 45%) 0%, hsl(43 74% 35%) 100%)" : "rgba(255,255,255,0.06)" }}
                >
                  {loading
                    ? <Loader2 size={13} className="animate-spin text-primary" />
                    : <Send size={13} className={input.trim() ? "text-[hsl(228_50%_6%)]" : "text-muted-foreground/40"} />
                  }
                </button>
              </div>
              <div className="text-[9px] text-muted-foreground/25 text-center mt-1.5">
                GTPro AI · Trading Intelligence Assistant · Not financial advice
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
