import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { createFileSearchStore } from "@/lib/google-file-search";

// GET /api/file-stores - Listar todos os File Stores
export async function GET(): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fileStores = await prisma.fileStore.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { files: true, folders: true },
        },
      },
    });

    return NextResponse.json(fileStores);
  } catch (error) {
    console.error("[FILE-STORES GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch file stores", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/file-stores - Criar novo File Store no Google + DB local
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // 1. Criar no Google File Search
    console.log("[FILE-STORES POST] Creating store in Google:", name);
    const googleStore = await createFileSearchStore(name);
    console.log("[FILE-STORES POST] Google store created:", googleStore.name);

    // 2. Salvar no banco local com o nome do Google
    const fileStore = await prisma.fileStore.create({
      data: {
        name,
        description,
        googleCorpusId: googleStore.name, // ex: fileSearchStores/myname-xxx
      },
    });

    return NextResponse.json(fileStore, { status: 201 });
  } catch (error) {
    console.error("[FILE-STORES POST]", error);
    return NextResponse.json(
      { error: "Failed to create file store", details: String(error) },
      { status: 500 }
    );
  }
}
