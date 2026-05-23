import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listDocuments,
  uploadToFileSearchStore,
  CustomMetadata,
  deleteDocument,
} from "@/lib/google-file-search";

function parseLimit(value: string | null): { value?: number; invalid: boolean } {
  if (!value || value.toLowerCase() === "all") return { invalid: false };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { invalid: true };
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return { invalid: true };
  return { value: normalized, invalid: false };
}

// GET /api/files?storeId=xxx -> list documents
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    const limitResult = parseLimit(request.nextUrl.searchParams.get("limit"));
    if (limitResult.invalid) {
      return NextResponse.json(
        { error: "limit deve ser inteiro positivo ou 'all'" },
        { status: 400 }
      );
    }
    const documents = await listDocuments(storeId, limitResult.value);
    return NextResponse.json(documents);
  } catch (error) {
    console.error("[FILES GET]", error);
    return NextResponse.json(
      { error: "Failed to list documents", details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/files - upload file. Body: { storeId, name, mimeType, content (base64), metadata? }
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { storeId, name, mimeType, content, metadata } = body;

    if (!storeId || !name || !content) {
      return NextResponse.json(
        { error: "storeId, name and content required" },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(content, "base64");

    let googleMetadata: CustomMetadata[] | undefined;
    if (metadata && typeof metadata === "object") {
      googleMetadata = Object.entries(metadata)
        .filter(([k, v]) => k && v !== "" && v != null)
        .map(([key, value]) => ({ key, stringValue: String(value) }));
    }

    const result = await uploadToFileSearchStore(
      storeId,
      fileBuffer,
      name,
      mimeType || "application/octet-stream",
      googleMetadata
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[FILES POST]", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/files - delete batch.
// Body: { storeId, documentIds?: string[], documentNames?: string[] }
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { storeId, documentIds, documentNames } = body ?? {};

    if (!storeId || typeof storeId !== "string") {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }

    const validIds = Array.isArray(documentIds)
      ? documentIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];

    const storePrefix = `fileSearchStores/${storeId}/documents/`;
    const validNames = Array.isArray(documentNames)
      ? documentNames.filter(
          (name): name is string =>
            typeof name === "string" && name.startsWith(storePrefix)
        )
      : [];

    const fullNames = Array.from(
      new Set([
        ...validIds.map((id) => `${storePrefix}${id}`),
        ...validNames,
      ])
    );

    if (fullNames.length === 0) {
      return NextResponse.json(
        { error: "documentIds ou documentNames required" },
        { status: 400 }
      );
    }

    let deletedCount = 0;
    const failed: Array<{ documentName: string; error: string }> = [];

    for (const documentName of fullNames) {
      try {
        await deleteDocument(documentName);
        deletedCount += 1;
      } catch (error) {
        failed.push({ documentName, error: String(error) });
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      total: fullNames.length,
      deletedCount,
      failedCount: failed.length,
      failed,
    });
  } catch (error) {
    console.error("[FILES DELETE BATCH]", error);
    return NextResponse.json(
      { error: "Failed to delete documents", details: String(error) },
      { status: 500 }
    );
  }
}
