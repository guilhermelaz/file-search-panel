"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FolderOpen, Plus, Trash2, Copy, FileText } from "lucide-react";
import { shortStoreId, formatBytes, formatDate } from "@/lib/google-utils";

interface FileStore {
  name: string; // fileSearchStores/xxx
  displayName: string;
  createTime: string;
  updateTime: string;
  activeDocumentsCount?: string;
  sizeBytes?: string;
  embeddingModel?: string;
}

export function FileStoresList() {
  const [stores, setStores] = useState<FileStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function fetchStores() {
    setLoading(true);
    try {
      const res = await fetch("/api/file-stores");
      if (!res.ok) throw new Error(await res.text());
      setStores(await res.json());
    } catch (err) {
      toast.error("Erro ao carregar stores: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStores();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/file-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Store criado!");
      setDialogOpen(false);
      setNewName("");
      fetchStores();
    } catch (err) {
      toast.error("Erro ao criar: " + String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(store: FileStore) {
    if (
      !confirm(
        `Deletar "${store.displayName}"? Todos os documentos serão removidos do Google.`
      )
    )
      return;
    try {
      const id = shortStoreId(store.name);
      const res = await fetch(`/api/file-stores/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Store deletado!");
      fetchStores();
    } catch (err) {
      toast.error("Erro ao deletar: " + String(err));
    }
  }

  function copyId(name: string) {
    navigator.clipboard.writeText(name);
    toast.success("Nome copiado!");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
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
            Stores do Google File Search (sincronizado em tempo real)
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Store
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar File Store</DialogTitle>
              <DialogDescription>
                O store será criado no Google File Search.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome (display)</Label>
                  <Input
                    id="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Meu Store"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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

      {stores.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum store no Google File Search ainda.
              <br />
              Clique em &quot;Novo Store&quot; para criar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((store) => {
            const id = shortStoreId(store.name);
            return (
              <Card key={store.name} className="group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {store.displayName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {formatDate(store.createTime)}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDelete(store)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      <FileText className="mr-1 h-3 w-3" />
                      {store.activeDocumentsCount || 0} docs
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {formatBytes(store.sizeBytes)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                      {store.name}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyId(store.name)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => (window.location.href = `/store/${id}`)}
                  >
                    Abrir
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
