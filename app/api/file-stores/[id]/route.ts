import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

// DELETE /api/file-stores/[id] - Deletar File Store
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

    // Deletar do banco (cascade vai remover pastas e arquivos)
    await prisma.fileStore.delete({
      where: { id },
    });

    // TODO: Deletar Corpus do Google File Search quando tiver API key

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete file store" },
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
      return NextResponse.json(
        { error: "File store not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(fileStore);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch file store" },
      { status: 500 }
    );
  }
}
