"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, FileText, Folder, FolderPlus, Home, Trash2, Upload, FileUp, Plus, X } from "lucide-react";

interface Folder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  fileStoreId: string;
  createdAt: string;
  _count?: {
    files: number;
  };
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
  fileStoreId: string;
  metadataJson: string | null;
  status: string;
  createdAt: string;
}

interface FileStore {
  id: string;
  name: string;
}

interface MetadataField {
  key: string;
  value: string;
}

export function FileManager({ fileStoreId }: { fileStoreId: string }) {
  const [fileStore, setFileStore] = useState<FileStore | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([{ key: "", value: "" }]);

  async function fetchFileStore() {
    try {
      const response = await fetch(`/api/file-stores/${fileStoreId}`);
      if (response.ok) {
        const data = await response.json();
        setFileStore(data);
      }
    } catch (error) {
      console.error("Erro ao buscar file store:", error);
    }
  }

  async function fetchFolders() {
    try {
      const response = await fetch(`/api/folders?fileStoreId=${fileStoreId}`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error("Erro ao buscar pastas:", error);
    }
  }

  async function fetchFiles() {
    try {
      const folderParam = currentFolderId ? `&folderId=${currentFolderId}` : "&folderId=null";
      const response = await fetch(`/api/files?fileStoreId=${fileStoreId}${folderParam}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (error) {
      console.error("Erro ao buscar arquivos:", error);
    }
  }

  async function fetchBreadcrumb() {
    if (!currentFolderId) {
      setBreadcrumb([]);
      return;
    }

    const path: Folder[] = [];
    let current = folders.find((f) => f.id === currentFolderId);

    while (current) {
      path.unshift(current);
      current = folders.find((f) => f.id === current?.parentId);
    }

    setBreadcrumb(path);
  }

  useEffect(() => {
    Promise.all([fetchFileStore(), fetchFolders()]).then(() => setLoading(false));
  }, [fileStoreId]);

  useEffect(() => {
    fetchFiles();
    fetchBreadcrumb();
  }, [currentFolderId, folders]);

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName,
          fileStoreId,
          parentId: currentFolderId,
        }),
      });

      if (response.ok) {
        toast.success("Pasta criada com sucesso!");
        setCreateFolderOpen(false);
        setNewFolderName("");
        fetchFolders();
      } else {
        toast.error("Erro ao criar pasta");
      }
    } catch (error) {
      toast.error("Erro ao criar pasta");
    }
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Tem certeza que deseja deletar esta pasta? Todos os arquivos e subpastas serão perdidos.")) {
      return;
    }

    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Pasta deletada com sucesso!");
        fetchFolders();
      } else {
        toast.error("Erro ao deletar pasta");
      }
    } catch (error) {
      toast.error("Erro ao deletar pasta");
    }
  }

  async function handleDeleteFile(id: string) {
    if (!confirm("Tem certeza que deseja deletar este arquivo?")) {
      return;
    }

    try {
      const response = await fetch(`/api/files/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Arquivo deletado com sucesso!");
        fetchFiles();
      } else {
        toast.error("Erro ao deletar arquivo");
      }
    } catch (error) {
      toast.error("Erro ao deletar arquivo");
    }
  }

  function addMetadataField() {
    setMetadataFields([...metadataFields, { key: "", value: "" }]);
  }

  function removeMetadataField(index: number) {
    setMetadataFields(metadataFields.filter((_, i) => i !== index));
  }

  function updateMetadataField(index: number, field: "key" | "value", value: string) {
    const newFields = [...metadataFields];
    newFields[index][field] = value;
    setMetadataFields(newFields);
  }

  function buildMetadataJson(): string | null {
    const validFields = metadataFields.filter(f => f.key.trim() !== "");
    if (validFields.length === 0) return null;
    
    const metadata: Record<string, string> = {};
    validFields.forEach(f => {
      metadata[f.key] = f.value;
    });
    
    return JSON.stringify(metadata);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result?.toString().split(",")[1];
        const metadataJson = buildMetadataJson();

        const response = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedFile.name,
            size: selectedFile.size,
            mimeType: selectedFile.type,
            folderId: currentFolderId,
            fileStoreId,
            metadataJson: metadataJson,
            content: base64,
          }),
        });

        if (response.ok) {
          toast.success("Arquivo enviado com sucesso!");
          setUploadOpen(false);
          setSelectedFile(null);
          setMetadataFields([{ key: "", value: "" }]);
          fetchFiles();
        } else {
          toast.error("Erro ao enviar arquivo");
        }
      } catch (error) {
        toast.error("Erro ao enviar arquivo");
      }
    };
    reader.readAsDataURL(selectedFile);
  }

  const currentFolders = folders.filter((f) => f.parentId === currentFolderId);

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => window.location.href = "/"}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{fileStore?.name || "File Store"}</h1>
          <p className="text-sm text-muted-foreground">ID: {fileStoreId}</p>
        </div>
      </div>

      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => setCurrentFolderId(null)} className="cursor-pointer">
              <Home className="h-4 w-4 mr-1" />
              Raiz
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumb.map((folder) => (
            <BreadcrumbItem key={folder.id}>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbLink onClick={() => setCurrentFolderId(folder.id)} className="cursor-pointer">
                {folder.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex gap-2 mb-6">
        <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
          <DialogTrigger
            render={
              <Button variant="outline">
                <FolderPlus className="mr-2 h-4 w-4" />
                Nova Pasta
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Pasta</DialogTitle>
              <DialogDescription>Crie uma nova pasta neste diretório</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFolder}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="folderName">Nome da Pasta</Label>
                  <Input
                    id="folderName"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Minha Pasta"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateFolderOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
              <DialogTitle>Enviar Arquivo</DialogTitle>
              <DialogDescription>Envie um arquivo para este diretório</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Metadados (opcional)</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addMetadataField}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar campo
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {metadataFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <Input
                          placeholder="Campo (ex: autor)"
                          value={field.key}
                          onChange={(e) => updateMetadataField(index, "key", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Valor (ex: John)"
                          value={field.value}
                          onChange={(e) => updateMetadataField(index, "value", e.target.value)}
                          className="flex-1"
                        />
                        {metadataFields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMetadataField(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!selectedFile}>
                  Enviar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tamanho</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentFolders.map((folder) => (
            <TableRow key={folder.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell onClick={() => setCurrentFolderId(folder.id)}>
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-primary" />
                  <span>{folder.name}</span>
                </div>
              </TableCell>
              <TableCell onClick={() => setCurrentFolderId(folder.id)}>-</TableCell>
              <TableCell onClick={() => setCurrentFolderId(folder.id)}>Pasta</TableCell>
              <TableCell onClick={() => setCurrentFolderId(folder.id)}>
                {new Date(folder.createdAt).toLocaleDateString("pt-BR")}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteFolder(folder.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{file.name}</span>
                </div>
              </TableCell>
              <TableCell>{formatFileSize(file.size)}</TableCell>
              <TableCell>{file.mimeType}</TableCell>
              <TableCell>{new Date(file.createdAt).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteFile(file.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {currentFolders.length === 0 && files.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <FileUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum arquivo ou pasta neste diretório</p>
                <p className="text-sm">Use "Nova Pasta" ou "Upload" para adicionar conteúdo</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
