import { FormEvent, useState } from "react";
import { Send } from "lucide-react";

import type { FarmLayer } from "../types";

type ChatPanelProps = {
  layer: FarmLayer;
  chat: (question: string, layerId?: string) => Promise<{ answer: string; referenced_layers: string[] }>;
};

export function ChatPanel({ layer, chat }: ChatPanelProps) {
  const [question, setQuestion] = useState(`What happens if I ignore the high humidity in ${layer.name}?`);
  const [answer, setAnswer] = useState(
    `${layer.name} is currently ${layer.status.toLowerCase()} with a health score of ${layer.health_score}.`,
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    const response = await chat(question, layer.id);
    setAnswer(response.answer);
  }

  async function handleSuggestion(suggestion: string) {
    setQuestion(suggestion);
    const response = await chat(suggestion, layer.id);
    setAnswer(response.answer);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <div>
        <p className="text-xs uppercase text-white/45">Chat-to-Farm</p>
        <h2 className="text-lg font-semibold text-white">Assistant</h2>
      </div>

      <div className="mt-4 rounded-md bg-field p-3 text-sm leading-6 text-white/70">{answer}</div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => handleSuggestion(`What happens if I ignore the warning in ${layer.name}?`)} className="rounded border border-white/10 bg-ink px-2 py-1 text-xs text-white/60 transition hover:bg-white/5 hover:text-white">What if I ignore it?</button>
        <button type="button" onClick={() => handleSuggestion("What should I do next?")} className="rounded border border-white/10 bg-ink px-2 py-1 text-xs text-white/60 transition hover:bg-white/5 hover:text-white">What to do next?</button>
        <button type="button" onClick={() => handleSuggestion("Explain auto mode")} className="rounded border border-white/10 bg-ink px-2 py-1 text-xs text-white/60 transition hover:bg-white/5 hover:text-white">Explain auto mode</button>
        <button type="button" onClick={() => handleSuggestion("Overall farm sustainability")} className="rounded border border-white/10 bg-ink px-2 py-1 text-xs text-white/60 transition hover:bg-white/5 hover:text-white">Sustainability info</button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-ink px-3 py-2 text-sm text-white outline-none transition focus:border-mint/60"
        />
        <button
          type="submit"
          className="grid h-10 w-10 place-items-center rounded-md bg-mint text-ink transition hover:bg-lime"
          title="Send"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
