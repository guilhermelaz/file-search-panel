import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

// GET /api/folders?fileStoreId=xxx - Listar pastas de um File Store
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileStoreId = searchParams.get("fileStoreId");

    if (!fileStoreId) {
      return NextResponse.json(
        { error: "fileStoreId is required" },
        { status: 400 }
      );
    }

    const folders = await prisma.folder.findMany({
      where: { fileStoreId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { files: true },
        },
      },
    });

    return NextResponse.json(folders);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

// POST /api/folders - Criar nova pasta
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, fileStoreId, parentId } = body;

    if (!name || !fileStoreId) {
      return NextResponse.json(
        { error: "Name and fileStoreId are required" },
        { status: 400 }
      );
    }

    // Calcular o path
    let path = name;
    if (parentId) {
      const parent = await prisma.folder.findUnique({
        where: { id: parentId },
      });
      if (parent) {
        path = `${parent.path}/${name}`;
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        path,
        fileStoreId,
        parentId,
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
