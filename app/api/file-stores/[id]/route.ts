import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { deleteFileSearchStore } from "@/lib/google-file-search";

// DELETE /api/file-stores/[id] - Deletar File Store do Google + DB
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const fileStore = await prisma.fileStore.findUnique({ where: { id } });
    if (!fileStore) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 1. Deletar no Google (force=true remove documentos também)
    if (fileStore.googleCorpusId) {
      try {
        console.log("[FILE-STORE DELETE] Deleting Google store:", fileStore.googleCorpusId);
        await deleteFileSearchStore(fileStore.googleCorpusId);
      } catch (err) {
        console.error("[FILE-STORE DELETE] Google delete failed (continuing):", err);
        // Continue mesmo se falhar no Google (pode ter sido deletado manualmente)
      }
    }

    // 2. Deletar local (cascade remove pastas e arquivos)
    await prisma.fileStore.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FILE-STORE DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete file store", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/file-stores/[id] - Detalhes do File Store
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const fileStore = await prisma.fileStore.findUnique({
      where: { id },
      include: {
        _count: {
          select: { files: true, folders: true },
        },
      },
    });

    if (!fileStore) {
      return NextResponse.json({ error: "File store not found" }, { status: 404 });
    }

    return NextResponse.json(fileStore);
  } catch (error) {
    console.error("[FILE-STORE GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch file store", details: String(error) },
      { status: 500 }
    );
  }
}
