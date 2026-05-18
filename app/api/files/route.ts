import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

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
      return NextResponse.json(
        { error: "fileStoreId is required" },
        { status: 400 }
      );
    }

    const where: { fileStoreId: string; folderId?: string | null } = {
      fileStoreId,
    };

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
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

// POST /api/files - Criar registro de arquivo
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, size, mimeType, folderId, fileStoreId, metadataJson } = body;

    if (!name || !fileStoreId) {
      return NextResponse.json(
        { error: "Name and fileStoreId are required" },
        { status: 400 }
      );
    }

    const file = await prisma.file.create({
      data: {
        name,
        size: size || 0,
        mimeType: mimeType || "application/octet-stream",
        folderId: folderId || null,
        fileStoreId,
        metadataJson: metadataJson || null,
        status: "uploaded",
      },
    });

    // TODO: Fazer upload para Google File Search quando tiver API key

    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    );
  }
}
