import { FormEvent, useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Cpu } from "lucide-react";
import type { FarmLayer } from "../types";

type Message = { role: "user" | "ai"; text: string; mode?: string };

type ChatPanelProps = {
  layer: FarmLayer;
  chat: (
    question: string,
    layerId?: string,
    history?: { role: string; text: string }[],
  ) => Promise<{ answer: string; referenced_layers: string[]; mode?: string }>;
};

const suggestions = [
  { emoji: "⚠️", text: "What if I ignore it?" },
  { emoji: "🎯", text: "What should I do next?" },
  { emoji: "🤖", text: "Explain auto mode" },
  { emoji: "🌱", text: "Farm sustainability" },
  { emoji: "📊", text: "Give me an overall summary" },
];

export function ChatPanel({ layer, chat }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: `Hi! I'm CropTwin AI. I'm monitoring ${layer.name} (${layer.crop}) — health score ${layer.health_score}. Ask me anything about your farm.` },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function modeLabel(mode?: string) {
    if (mode === "deepseek") return "DeepSeek AI";
    if (mode === "gemini" || mode === "ai") return "Gemini AI";
    if (mode === "unconfigured") return "AI not configured";
    if (mode === "ai_error") return "AI request failed";
    return "AI assistant";
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role, text: m.text }));
      const response = await chat(text, layer.id, history);
      setMessages((prev) => [...prev, { role: "ai", text: response.answer, mode: (response as any).mode }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(question);
  }

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden" style={{ height: 560 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 animate-fade-up ${msg.role === "user" ? "flex-row-reverse" : ""}`} style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
              msg.role === "ai"
                ? "bg-gradient-to-br from-mint/20 to-emerald-800/20 text-mint"
                : "bg-white/[0.06] text-white/50"
            }`}>
              {msg.role === "ai" ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
              msg.role === "ai"
                ? "bg-white/[0.03] border border-white/[0.04] text-white/75"
                : "bg-mint/[0.08] border border-mint/15 text-white/80"
            }`}>
              {msg.text}
              {msg.role === "ai" && msg.mode && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/20">
                  {msg.mode === "unconfigured" || msg.mode === "ai_error" ? <Cpu size={10} /> : <Sparkles size={10} />}
                  {modeLabel(msg.mode)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 animate-fade-up">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-mint/20 to-emerald-800/20 text-mint">
              <Bot size={14} />
            </div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.04] px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-mint/40 animate-bounce" style={{ animationDelay: "0s" }} />
                <span className="h-2 w-2 rounded-full bg-mint/40 animate-bounce" style={{ animationDelay: "0.15s" }} />
                <span className="h-2 w-2 rounded-full bg-mint/40 animate-bounce" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div className="flex gap-1.5 px-5 py-2 overflow-x-auto border-t border-white/[0.04]">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => send(s.text)}
            disabled={loading}
            className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/40 transition hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-50"
          >
            {s.emoji} {s.text}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-white/[0.04] bg-white/[0.01]">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your farm..."
          disabled={loading}
          className="min-w-0 flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[13px] text-white placeholder-white/20 outline-none transition focus:border-mint/30 focus:bg-white/[0.03] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-mint to-emerald-500 text-ink transition hover:shadow-lg hover:shadow-mint/20 disabled:opacity-30"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
