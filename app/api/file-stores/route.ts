import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

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
    return NextResponse.json(
      { error: "Failed to fetch file stores" },
      { status: 500 }
    );
  }
}

// POST /api/file-stores - Criar novo File Store
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Criar no banco local primeiro
    const fileStore = await prisma.fileStore.create({
      data: {
        name,
        description,
      },
    });

    // TODO: Criar Corpus no Google File Search quando tiver API key configurada

    return NextResponse.json(fileStore, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create file store" },
      { status: 500 }
    );
  }
}
