"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload,
  Trash2,
  FileIcon,
  Plus,
  X,
  ArrowLeft,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import {
  shortDocId,
  formatBytes,
  formatDate,
} from "@/lib/google-utils";
import { ChatPanel } from "@/components/chat/chat-panel";

interface Document {
  name: string;
  displayName?: string;
  createTime?: string;
  state?: string;
  sizeBytes?: string;
  mimeType?: string;
  customMetadata?: Array<{ key: string; stringValue?: string; numericValue?: number }>;
}

interface StoreInfo {
  name: string;
  displayName: string;
  activeDocumentsCount?: string;
  sizeBytes?: string;
}

interface FileManagerProps {
  storeId: string; // short id, ex: "teste-xxx"
}

export function FileManager({ storeId }: FileManagerProps) {
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" },
  ]);
  const [uploading, setUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [storeRes, docsRes] = await Promise.all([
        fetch(`/api/file-stores/${storeId}`),
        fetch(`/api/files?storeId=${storeId}`),
      ]);
      if (storeRes.ok) setStoreInfo(await storeRes.json());
      if (docsRes.ok) setDocs(await docsRes.json());
    } catch (err) {
      toast.error("Erro ao carregar: " + String(err));
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function addMetaField() {
    setMetadata([...metadata, { key: "", value: "" }]);
  }
  function removeMetaField(i: number) {
    setMetadata(metadata.filter((_, idx) => idx !== i));
  }
  function updateMetaField(i: number, field: "key" | "value", v: string) {
    setMetadata(metadata.map((m, idx) => (idx === i ? { ...m, [field]: v } : m)));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      // Read as base64
      const buffer = await file.arrayBuffer();
      const b64 = Buffer.from(buffer).toString("base64");

      const meta: Record<string, string> = {};
      metadata.forEach((m) => {
        if (m.key && m.value) meta[m.key] = m.value;
      });

      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          content: b64,
          metadata: Object.keys(meta).length > 0 ? meta : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }
      toast.success("Arquivo enviado com sucesso!");
      setUploadOpen(false);
      setFile(null);
      setMetadata([{ key: "", value: "" }]);
      fetchAll();
    } catch (err) {
      toast.error("Erro no upload: " + String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Deletar "${doc.displayName || shortDocId(doc.name)}"?`)) return;
    try {
      const docId = shortDocId(doc.name);
      const res = await fetch(`/api/files/${docId}?storeId=${storeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Arquivo deletado!");
      fetchAll();
    } catch (err) {
      toast.error("Erro ao deletar: " + String(err));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (window.location.href = "/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{storeInfo?.displayName || storeId}</h1>
            <p className="text-xs text-muted-foreground font-mono">
              {storeInfo?.name || `fileSearchStores/${storeId}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchAll} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setChatOpen(true)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Button>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger
              render={
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              }
            />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload de arquivo</DialogTitle>
                <DialogDescription>
                  O arquivo será enviado direto ao Google File Search com seus metadados.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpload}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">Arquivo</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Metadados (chave/valor)</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addMetaField}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                    {metadata.map((m, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="chave"
                          value={m.key}
                          onChange={(e) => updateMetaField(i, "key", e.target.value)}
                        />
                        <Input
                          placeholder="valor"
                          value={m.value}
                          onChange={(e) => updateMetaField(i, "value", e.target.value)}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeMetaField(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setUploadOpen(false)}
                    disabled={uploading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={uploading || !file}>
                    {uploading ? "Enviando..." : "Enviar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="border border-dashed rounded-lg py-16 flex flex-col items-center justify-center text-muted-foreground">
          <FileIcon className="h-10 w-10 mb-3" />
          <p>Nenhum documento no store.</p>
          <p className="text-sm">Use &quot;Upload&quot; para adicionar arquivos.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Metadados</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.name}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    {doc.displayName || shortDocId(doc.name)}
                  </div>
                </TableCell>
                <TableCell>{formatBytes(doc.sizeBytes)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {doc.mimeType || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {doc.customMetadata && doc.customMetadata.length > 0 ? (
                    <div className="flex gap-1 flex-wrap max-w-xs">
                      {doc.customMetadata.map((m, i) => (
                        <span
                          key={i}
                          className="bg-muted px-1.5 py-0.5 rounded text-[10px]"
                        >
                          {m.key}={m.stringValue ?? m.numericValue}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(doc.createTime)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        storeId={storeId}
        storeName={storeInfo?.displayName || storeId}
      />
    </div>
  );
}
