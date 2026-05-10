import { useMemo } from "react";
import { Bot, MessageSquare, X } from "lucide-react";

import { ChatPanel } from "./ChatPanel";
import type { ChatMessage, ChatResponse, FarmLayer } from "../types";
import { usePersistentBoolean, usePersistentString } from "../hooks/usePersistentState";

type FloatingChatAssistantProps = {
  layers: FarmLayer[];
  chat: (
    question: string,
    layerId?: string,
    history?: ChatMessage[],
  ) => Promise<ChatResponse>;
};

export function FloatingChatAssistant({ layers, chat }: FloatingChatAssistantProps) {
  const [open, setOpen] = usePersistentBoolean("croptwin_assistant_open", false);
  const [selectedLayerId, setSelectedLayerId] = usePersistentString("croptwin_assistant_layer", layers[0]?.id ?? "");

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? layers[0],
    [layers, selectedLayerId],
  );

  if (!selectedLayer) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <section className="mb-3 w-[380px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-lg border border-card-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-card-border bg-field-bg px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-spring-green/30 text-forest-green">
                <Bot size={15} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">CropTwin Assistant</p>
                <p className="text-xs text-muted">Ask about farm status or next action</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md border border-card-border bg-white text-muted transition hover:text-ink"
              aria-label="Close assistant"
              title="Close assistant"
            >
              <X size={15} />
            </button>
          </div>

          <div className="border-b border-card-border bg-white px-3 py-2">
            <select
              value={selectedLayer.id}
              onChange={(event) => setSelectedLayerId(event.target.value)}
              className="w-full rounded-md border border-card-border bg-field-bg px-3 py-2 text-xs font-medium text-ink outline-none focus:border-forest-green/60"
              aria-label="Assistant target layer"
            >
              {layers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name} · {layer.crop} · Health {layer.health_score}
                </option>
              ))}
            </select>
          </div>

          <ChatPanel key={selectedLayer.id} layer={selectedLayer} chat={chat} height={430} compact />
        </section>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-green text-white shadow-xl transition hover:bg-forest-green/90 focus:outline-none focus:ring-4 focus:ring-forest-green/25"
        aria-label="Open CropTwin assistant"
        title="CropTwin assistant"
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </button>
    </div>
  );
}
