"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, User } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "model";
  text: string;
  citations?: Array<{ uri?: string; title?: string; text?: string }>;
}

interface GeminiModel {
  name: string;
  displayName: string;
  description?: string;
}

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName: string;
}

export function ChatPanel({ open, onOpenChange, storeId, storeName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [loadingModels, setLoadingModels] = useState(true);
  const [sending, setSending] = useState(false);

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setModels(data);
          setModel(data[0].name);
        }
      })
      .catch((err) => console.error("Failed to load models:", err))
      .finally(() => setLoadingModels(false));
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeIds: [storeId],
          messages: next.map((m) => ({ role: m.role, text: m.text })),
          model,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      const data = await res.json();
      setMessages((curr) => [
        ...curr,
        { role: "model", text: data.text || "(resposta vazia)", citations: data.citations },
      ]);
    } catch (err) {
      toast.error("Erro no chat: " + String(err));
      setMessages((curr) => [
        ...curr,
        { role: "model", text: "❌ Erro: " + String(err) },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Chat — {storeName}</SheetTitle>
          <SheetDescription>
            Teste o RAG conversando com os documentos deste store.
          </SheetDescription>
          <div className="pt-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
              disabled={sending || loadingModels}
            >
              {loadingModels ? (
                <option>Carregando modelos...</option>
              ) : models.length === 0 ? (
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              ) : (
                models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.displayName}
                  </option>
                ))
              )}
            </select>
          </div>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Comece uma conversa para testar o RAG.
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`flex-1 max-w-[80%] ${m.role === "user" ? "text-right" : ""}`}
              >
                <div
                  className={`inline-block text-left rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {m.text}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.citations.map((c, ci) => (
                      <div
                        key={ci}
                        className="text-[10px] bg-muted/50 border rounded p-2 text-left"
                      >
                        <div className="font-medium text-foreground/70">
                          📎 {c.title || `Citação ${ci + 1}`}
                        </div>
                        {c.text && (
                          <div className="text-muted-foreground line-clamp-3 mt-1">
                            {c.text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex gap-3">
              <div className="p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> pensando...
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte algo... (Enter envia, Shift+Enter quebra linha)"
            rows={2}
            disabled={sending}
            className="resize-none"
          />
          <Button onClick={send} disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
