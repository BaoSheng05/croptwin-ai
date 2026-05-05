import { useOutletContext } from "react-router-dom";
import { ChatPanel } from "../components/ChatPanel";
import type { FarmStreamContext } from "../App";
import { useState } from "react";

export default function ChatPage() {
  const { farm, chat } = useOutletContext<FarmStreamContext>();
  const [selected, setSelected] = useState(farm.layers[0].id);

  const selectedLayer = farm.layers.find(l => l.id === selected) || farm.layers[0];

  return (
    <div className="grid gap-6">
      <h2 className="text-2xl font-semibold text-white">Chat-to-Farm Assistant</h2>
      <div className="flex gap-2">
        {farm.layers.map(l => (
          <button 
            key={l.id} 
            onClick={() => setSelected(l.id)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${selected === l.id ? 'bg-mint text-ink font-medium' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
          >
            {l.name}
          </button>
        ))}
      </div>
      <div className="max-w-2xl">
        <ChatPanel layer={selectedLayer} chat={chat} />
      </div>
    </div>
  );
}
