import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { deleteDocument } from "@/lib/google-file-search";

// DELETE /api/files/[id] - Deletar arquivo no Google + DB
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

    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Deletar no Google PRIMEIRO. Só remove do DB se Google confirmou (ou 404).
    if (file.googleFileId) {
      try {
        console.log("[FILE DELETE] Deleting Google document:", file.googleFileId);
        await deleteDocument(file.googleFileId);
        console.log("[FILE DELETE] Google document deleted");
      } catch (err) {
        const errStr = String(err);
        // Se documento já não existe no Google (404), prosseguir com delete local
        if (errStr.includes("404") || errStr.includes("NOT_FOUND")) {
          console.warn("[FILE DELETE] Document not found on Google, removing local ref");
        } else {
          // Qualquer outro erro: ABORTAR para evitar disparidade
          console.error("[FILE DELETE] Google delete FAILED, aborting:", err);
          return NextResponse.json(
            {
              error: "Falha ao deletar no Google. Arquivo NÃO foi removido.",
              details: errStr,
            },
            { status: 500 }
          );
        }
      }
    }

    await prisma.file.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FILE DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete file", details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/files/[id] - Atualizar metadados locais
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
    console.error("[FILE PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update file", details: String(error) },
      { status: 500 }
    );
  }
}
