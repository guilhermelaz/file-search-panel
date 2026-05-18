import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

// DELETE /api/files/[id] - Deletar arquivo
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

    // Buscar arquivo para obter googleFileId
    const file = await prisma.file.findUnique({
      where: { id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Deletar do banco
    await prisma.file.delete({
      where: { id },
    });

    // TODO: Deletar do Google File Search quando tiver googleFileId

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

// PATCH /api/files/[id] - Atualizar arquivo (metadados, mover pasta)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, folderId, metadataJson } = body;

    const updateData: { name?: string; folderId?: string | null; metadataJson?: string } = {};
    if (name) updateData.name = name;
    if (folderId !== undefined) updateData.folderId = folderId || null;
    if (metadataJson) updateData.metadataJson = metadataJson;

    const file = await prisma.file.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  }
}
