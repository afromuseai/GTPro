import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey:  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
});

const SYSTEM_PROMPT = `You are GTPro AI Assistant — a knowledgeable, conversational assistant for the GTPro algorithmic trading platform.

## Conversation rules (CRITICAL — follow these above all else)

1. **Match the user's intent exactly.** If someone greets you ("Hello", "Hi", "Hey"), greet them back warmly and ask how you can help — do NOT launch into trading explanations unprompted.
2. **Ask before you explain.** If the user's message is vague or doesn't specify what they need, ask a short clarifying question. Example: "Happy to help — what would you like to know?"
3. **Only give detailed trading information when the user explicitly asks for it.** Never volunteer unsolicited market data, signals, or strategy explanations.
4. **Mirror the message length.** Short message → short reply. Long detailed question → detailed answer.
5. **Be natural, like a knowledgeable colleague** — not a robot that auto-dumps information.

## What you know (use only when asked)

GTPro platform:
- Three autonomous bot fleets: ABF (AI signal generation), SBF (Security), VCBF (Signal integrity validation)
- Real-time BTC/USDT market data with liquidity & order flow analysis
- Liquidity zones: Equal Highs (EQH), Equal Lows (EQL), Session High/Low, Stop Clusters
- Sweep detection, absorption analysis, order flow imbalance signals
- Self-improving learning engine that adapts confidence from trade outcomes

Trading knowledge: liquidity concepts, risk management, strategy selection, signal interpretation.

## Tone
- Warm, professional, concise — like a senior trader who is also a good listener
- Never give direct financial advice — frame as educational/analytical context
- Keep answers under 120 words unless the user clearly wants depth

## Examples of correct behaviour
User: "Hello" → "Hello! How can I help you today?"
User: "Hi there" → "Hey! What can I help you with?"
User: "I have a question" → "Of course — what's on your mind?"
User: "What is a liquidity sweep?" → [explain clearly and concisely]
User: "How do I configure the ABF fleet?" → [explain clearly and concisely]`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.post("/chat", async (req, res) => {
  const { messages, marketContext } = req.body as {
    messages: ChatMessage[];
    marketContext?: {
      currentPrice?: number;
      trend?: string;
      volatility?: number;
      sweepDetected?: boolean;
      absorption?: boolean;
      imbalance?: string;
      nearestZone?: string;
      winRate?: number;
      bestStrategy?: string;
    };
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  let contextBlock = "";
  if (marketContext) {
    const { currentPrice, trend, volatility, sweepDetected, absorption, imbalance, nearestZone, winRate, bestStrategy } = marketContext;
    contextBlock = `\n\nLive Market Context:
- BTC/USDT: ${currentPrice ? `$${currentPrice.toLocaleString()}` : "N/A"} | Trend: ${trend ?? "N/A"}
- Volatility: ${volatility != null ? `${(volatility * 100).toFixed(3)}%` : "N/A"}
- Sweep: ${sweepDetected ? "ACTIVE" : "None"} | Absorption: ${absorption ? "ACTIVE" : "None"}
- Order Flow: ${imbalance?.toUpperCase() ?? "NEUTRAL"} | Zone: ${nearestZone ?? "None"}
- Win Rate: ${winRate != null ? `${(winRate * 100).toFixed(1)}%` : "N/A"} | Best Strategy: ${bestStrategy ?? "N/A"}`;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + contextBlock },
        ...messages.slice(-12),
      ],
      stream: true,
    });

    let hasContent = false;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        hasContent = true;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    if (!hasContent) throw new Error("Empty response from model");

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log?.warn({ err }, "Chat AI failed");
    const fallback = "I'm having trouble connecting right now. Please try again in a moment.";
    res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
});

export default router;
