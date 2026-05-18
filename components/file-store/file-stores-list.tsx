"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FolderOpen, Plus, Trash2, Copy, Terminal, FileText, Folder } from "lucide-react";

interface FileStore {
  id: string;
  name: string;
  description: string | null;
  googleCorpusId: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    files: number;
    folders: number;
  };
}

export function FileStoresList() {
  const [fileStores, setFileStores] = useState<FileStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreDescription, setNewStoreDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [curlDialogOpen, setCurlDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<FileStore | null>(null);
  const [curlQuery, setCurlQuery] = useState("sua pergunta aqui");

  async function fetchFileStores() {
    try {
      const response = await fetch("/api/file-stores");
      if (response.ok) {
        const data = await response.json();
        setFileStores(data);
      } else {
        toast.error("Erro ao carregar File Stores");
      }
    } catch (error) {
      toast.error("Erro ao carregar File Stores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFileStores();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch("/api/file-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStoreName,
          description: newStoreDescription,
        }),
      });

      if (response.ok) {
        toast.success("File Store criado com sucesso!");
        setCreateDialogOpen(false);
        setNewStoreName("");
        setNewStoreDescription("");
        fetchFileStores();
      } else {
        toast.error("Erro ao criar File Store");
      }
    } catch (error) {
      toast.error("Erro ao criar File Store");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja deletar este File Store? Todos os arquivos serão perdidos.")) {
      return;
    }

    try {
      const response = await fetch(`/api/file-stores/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("File Store deletado com sucesso!");
        fetchFileStores();
      } else {
        toast.error("Erro ao deletar File Store");
      }
    } catch (error) {
      toast.error("Erro ao deletar File Store");
    }
  }

  function openCurlDialog(store: FileStore) {
    setSelectedStore(store);
    setCurlDialogOpen(true);
  }

  function copyCurlCommand() {
    if (!selectedStore) return;

    const command = `curl -X POST https://api.google.com/vertex-ai/file-search \\\n  -H "Authorization: Bearer \${GOOGLE_API_KEY}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"corpus_id": "${selectedStore.googleCorpusId || selectedStore.id}", "query": "${curlQuery}"}'`;

    navigator.clipboard.writeText(command);
    toast.success("Comando CURL copiado!");
  }

  function copyStoreId(id: string) {
    navigator.clipboard.writeText(id);
    toast.success("ID copiado para a área de transferência!");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">File Stores</h1>
          <p className="text-muted-foreground">
            Gerencie seus repositórios de arquivos para RAG
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo File Store
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar File Store</DialogTitle>
              <DialogDescription>
                Crie um novo repositório para armazenar seus arquivos
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="Meu File Store"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={newStoreDescription}
                    onChange={(e) => setNewStoreDescription(e.target.value)}
                    placeholder="Descrição do repositório..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {fileStores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum File Store criado ainda.
              <br />
              Clique em "Novo File Store" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fileStores.map((store) => (
            <Card key={store.id} className="group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{store.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(store.createdAt).toLocaleDateString("pt-BR")}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(store.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {store.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {store.description}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <FileText className="mr-1 h-3 w-3" />
                    {store._count.files} arquivos
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <Folder className="mr-1 h-3 w-3" />
                    {store._count.folders} pastas
                  </Badge>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                      ID: {store.id}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyStoreId(store.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => window.location.href = `/store/${store.id}`}>
                      Abrir
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openCurlDialog(store)}
                    >
                      <Terminal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para gerar comando CURL */}
      <Dialog open={curlDialogOpen} onOpenChange={setCurlDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comando CURL para Integração</DialogTitle>
            <DialogDescription>
              Use este comando para integrar este File Store em seus agentes de IA
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="curl-query">Query de exemplo</Label>
              <Input
                id="curl-query"
                value={curlQuery}
                onChange={(e) => setCurlQuery(e.target.value)}
                placeholder="Digite sua pergunta..."
              />
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <code className="text-xs whitespace-pre-wrap break-all">
                {selectedStore && `curl -X POST https://api.google.com/vertex-ai/file-search \\
  -H "Authorization: Bearer \${GOOGLE_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"corpus_id": "${selectedStore.googleCorpusId || selectedStore.id}", "query": "${curlQuery}"}'`}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurlDialogOpen(false)}
            >
              Fechar
            </Button>
            <Button onClick={copyCurlCommand}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar Comando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
