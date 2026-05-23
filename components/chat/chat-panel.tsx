"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
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

const CHAT_WIDTH_STORAGE_KEY = "rag-chat-panel-width";
const CHAT_WIDTH_DEFAULT = 720;
const CHAT_WIDTH_MIN = 460;
const CHAT_WIDTH_MAX = 1100;
const MOBILE_BREAKPOINT = 640;

interface Citation {
  uri?: string;
  title?: string;
  text?: string;
}

interface Message {
  role: "user" | "model";
  text: string;
  citations?: Citation[];
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

interface StreamPayload {
  event_type?: string;
  delta?: { text?: string };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{
        retrievedContext?: Citation;
      }>;
    };
  }>;
}

function mergeStreamText(current: string, incoming: string): string {
  if (!incoming) return current;
  if (!current) return incoming;
  if (incoming === current) return current;
  if (incoming.startsWith(current)) return incoming;
  if (current.endsWith(incoming)) return current;
  return current + incoming;
}

function extractChunkText(payload: StreamPayload): string {
  if (payload.event_type === "content.delta" && typeof payload.delta?.text === "string") {
    return payload.delta.text;
  }

  const parts = payload.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p.text || "").join("");
}

function extractChunkCitations(payload: StreamPayload): Citation[] | undefined {
  const chunks = payload.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks) || chunks.length === 0) return undefined;

  const citations = chunks
    .map((chunk) => chunk.retrievedContext)
    .filter((citation): citation is Citation => Boolean(citation));

  return citations.length > 0 ? citations : undefined;
}

function parseSseData(rawEvent: string): StreamPayload | null {
  const lines = rawEvent.replace(/\r/g, "").split("\n");
  const payload = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n")
    .trim();

  if (!payload || payload === "[DONE]") return null;

  try {
    return JSON.parse(payload) as StreamPayload;
  } catch {
    return null;
  }
}

function clampChatWidth(width: number, viewportWidth: number): number {
  const maxByViewport = Math.max(
    CHAT_WIDTH_MIN,
    Math.min(CHAT_WIDTH_MAX, viewportWidth - 24)
  );
  return Math.min(Math.max(width, CHAT_WIDTH_MIN), maxByViewport);
}

function getInitialChatWidth(): number {
  if (typeof window === "undefined") return CHAT_WIDTH_DEFAULT;
  try {
    const raw = window.localStorage.getItem(CHAT_WIDTH_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed)) {
      return clampChatWidth(parsed, window.innerWidth);
    }
  } catch {
    // Ignore localStorage failures
  }
  return clampChatWidth(CHAT_WIDTH_DEFAULT, window.innerWidth);
}

export function ChatPanel({ open, onOpenChange, storeId, storeName }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [loadingModels, setLoadingModels] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatWidth, setChatWidth] = useState<number>(getInitialChatWidth);
  const [isDesktop, setIsDesktop] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth >= MOBILE_BREAKPOINT : false
  );
  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: CHAT_WIDTH_DEFAULT,
  });

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

  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= MOBILE_BREAKPOINT;
      setIsDesktop(desktop);
      if (desktop) {
        setChatWidth((current) => clampChatWidth(current, window.innerWidth));
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    try {
      window.localStorage.setItem(CHAT_WIDTH_STORAGE_KEY, String(Math.round(chatWidth)));
    } catch {
      // Ignore localStorage failures
    }
  }, [chatWidth, isDesktop]);

  useEffect(() => {
    const clearResizeState = () => {
      resizeStateRef.current.active = false;
      setIsResizing(false);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!resizeStateRef.current.active) return;

      const delta = resizeStateRef.current.startX - event.clientX;
      const nextWidth = resizeStateRef.current.startWidth + delta;
      setChatWidth(clampChatWidth(nextWidth, window.innerWidth));
    };

    const onPointerUp = () => {
      if (!resizeStateRef.current.active) return;
      clearResizeState();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      clearResizeState();
    };
  }, []);

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!isDesktop) return;
    event.preventDefault();
    resizeStateRef.current.active = true;
    resizeStateRef.current.startX = event.clientX;
    resizeStateRef.current.startWidth = chatWidth;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: Message[] = [...messages, { role: "user", text }];
    setMessages([...next, { role: "model", text: "" }]);
    setInput("");
    setSending(true);

    let assistantText = "";
    let assistantCitations: Citation[] | undefined;

    const updateAssistantMessage = () => {
      setMessages((curr) => {
        if (curr.length === 0) return curr;
        const nextMessages = [...curr];
        const lastIndex = nextMessages.length - 1;
        const lastMessage = nextMessages[lastIndex];
        if (lastMessage.role !== "model") return curr;
        nextMessages[lastIndex] = {
          ...lastMessage,
          text: assistantText,
          citations: assistantCitations,
        };
        return nextMessages;
      });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeIds: [storeId],
          messages: next.map((m) => ({ role: m.role, text: m.text })),
          model,
          stream: true,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!res.body || !contentType.includes("text/event-stream")) {
        const data = await res.json();
        assistantText = data.text || "(resposta vazia)";
        assistantCitations = data.citations;
        updateAssistantMessage();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r/g, "");
        let eventBoundary = buffer.indexOf("\n\n");

        while (eventBoundary !== -1) {
          const rawEvent = buffer.slice(0, eventBoundary);
          buffer = buffer.slice(eventBoundary + 2);
          eventBoundary = buffer.indexOf("\n\n");

          const payload = parseSseData(rawEvent);
          if (!payload) continue;

          const nextText = extractChunkText(payload);
          if (nextText) {
            assistantText = mergeStreamText(assistantText, nextText);
          }

          const nextCitations = extractChunkCitations(payload);
          if (nextCitations && nextCitations.length > 0) {
            assistantCitations = nextCitations;
          }

          if (nextText || nextCitations) {
            updateAssistantMessage();
          }
        }
      }
      buffer += decoder.decode();
      buffer = buffer.replace(/\r/g, "");

      const trailingPayload = parseSseData(buffer);
      if (trailingPayload) {
        const nextText = extractChunkText(trailingPayload);
        if (nextText) {
          assistantText = mergeStreamText(assistantText, nextText);
        }
        const nextCitations = extractChunkCitations(trailingPayload);
        if (nextCitations && nextCitations.length > 0) {
          assistantCitations = nextCitations;
        }
      }

      if (!assistantText.trim()) {
        assistantText = "(resposta vazia)";
      }
      updateAssistantMessage();
    } catch (err) {
      toast.error("Erro no chat: " + String(err));
      setMessages((curr) => {
        if (curr.length === 0) return curr;
        const nextMessages = [...curr];
        const lastIndex = nextMessages.length - 1;
        const lastMessage = nextMessages[lastIndex];
        if (lastMessage.role !== "model") {
          nextMessages.push({ role: "model", text: "❌ Erro: " + String(err) });
        } else {
          nextMessages[lastIndex] = { role: "model", text: "❌ Erro: " + String(err) };
        }
        return nextMessages;
      });
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
      <SheetContent
        side="right"
        style={
          isDesktop
            ? {
                width: `${chatWidth}px`,
                maxWidth: "calc(100vw - 0.75rem)",
              }
            : undefined
        }
        className={`w-full sm:w-auto sm:max-w-none flex flex-col p-0 overflow-hidden ${
          isResizing
            ? ""
            : "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        }`}
      >
        <div
          onPointerDown={startResize}
          aria-label="Redimensionar chat"
          role="separator"
          aria-orientation="vertical"
          className="absolute left-0 top-0 z-10 hidden h-full w-4 -translate-x-1/2 cursor-col-resize touch-none sm:flex items-center justify-center group"
        >
          <div
            className={`rounded-full transition-all duration-200 ${
              isResizing
                ? "h-24 w-1.5 bg-primary shadow-[0_0_18px_rgba(59,130,246,0.5)]"
                : "h-14 w-1 bg-border/70 group-hover:h-20 group-hover:bg-primary/80"
            }`}
          />
        </div>
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
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`flex-1 max-w-[82%] ${m.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block text-left rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                      : "bg-muted/70 border border-border/60"
                  }`}
                >
                  {m.role === "user" ? (
                    m.text
                  ) : (
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-semibold mb-2">{children}</h2>,
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                        pre: ({ children }) => (
                          <pre className="bg-background border rounded-md px-3 py-2 text-xs overflow-x-auto mb-2">
                            {children}
                          </pre>
                        ),
                        code: ({ className, children }) => {
                          if (className) return <code className={className}>{children}</code>;
                          return (
                            <code className="bg-background border border-border/50 px-1 py-0.5 rounded text-[12px]">
                              {children}
                            </code>
                          );
                        },
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="underline decoration-dotted underline-offset-2"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  )}
                  {sending && i === messages.length - 1 && m.role === "model" && (
                    <span className="inline-block h-4 w-1 bg-foreground/80 ml-1 align-middle animate-pulse rounded-sm" />
                  )}
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
          {sending &&
            messages[messages.length - 1]?.role === "model" &&
            !messages[messages.length - 1]?.text && (
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
