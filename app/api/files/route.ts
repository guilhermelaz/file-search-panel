import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { uploadToFileSearchStore, CustomMetadata } from "@/lib/google-file-search";

// GET /api/files?fileStoreId=xxx&folderId=yyy - Listar arquivos
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileStoreId = searchParams.get("fileStoreId");
    const folderId = searchParams.get("folderId");

    if (!fileStoreId) {
      return NextResponse.json({ error: "fileStoreId is required" }, { status: 400 });
    }

    const where: { fileStoreId: string; folderId?: string | null } = { fileStoreId };

    if (folderId === "null" || folderId === "") {
      where.folderId = null;
    } else if (folderId) {
      where.folderId = folderId;
    }

    const files = await prisma.file.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(files);
  } catch (error) {
    console.error("[FILES GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch files", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/files - Upload arquivo para Google + salvar referência local
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, size, mimeType, folderId, fileStoreId, metadataJson, content } = body;

    if (!name || !fileStoreId) {
      return NextResponse.json(
        { error: "Name and fileStoreId are required" },
        { status: 400 }
      );
    }

    // Buscar o file store para obter googleCorpusId
    const fileStore = await prisma.fileStore.findUnique({
      where: { id: fileStoreId },
    });

    if (!fileStore) {
      return NextResponse.json({ error: "File store not found" }, { status: 404 });
    }

    if (!fileStore.googleCorpusId) {
      return NextResponse.json(
        { error: "File store não está sincronizado com Google. Recrie o store." },
        { status: 400 }
      );
    }

    // Converter custom metadata para formato do Google
    let googleMetadata: CustomMetadata[] | undefined;
    if (metadataJson) {
      try {
        const parsed = JSON.parse(metadataJson);
        googleMetadata = Object.entries(parsed).map(([key, value]) => ({
          key,
          stringValue: String(value),
        }));
      } catch {
        // ignore invalid JSON
      }
    }

    // Adicionar folder path como metadata para filtragem
    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (folder) {
        googleMetadata = googleMetadata || [];
        googleMetadata.push({ key: "_folder", stringValue: folder.path });
      }
    }

    // Decodificar conteúdo base64
    let fileBuffer: Buffer;
    if (content) {
      fileBuffer = Buffer.from(content, "base64");
    } else {
      return NextResponse.json({ error: "File content required" }, { status: 400 });
    }

    // Upload para Google File Search
    console.log("[FILES POST] Uploading to Google store:", fileStore.googleCorpusId);
    let googleDocName: string | null = null;
    try {
      const result = await uploadToFileSearchStore(
        fileStore.googleCorpusId,
        fileBuffer,
        name,
        mimeType || "application/octet-stream",
        googleMetadata
      );
      console.log("[FILES POST] Upload success:", result);
      // Result is an Operation - the document name will be in metadata after processing
      googleDocName = result.name || null;
    } catch (err) {
      console.error("[FILES POST] Upload failed:", err);
      return NextResponse.json(
        { error: "Falha no upload para Google", details: String(err) },
        { status: 500 }
      );
    }

    // Salvar referência no banco local (apenas metadados, não o conteúdo)
    const file = await prisma.file.create({
      data: {
        name,
        size: size || fileBuffer.length,
        mimeType: mimeType || "application/octet-stream",
        folderId: folderId || null,
        fileStoreId,
        metadataJson: metadataJson || null,
        googleFileId: googleDocName,
        status: "uploaded",
      },
    });

    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    console.error("[FILES POST]", error);
    return NextResponse.json(
      { error: "Failed to create file", details: String(error) },
      { status: 500 }
    );
  }
}
