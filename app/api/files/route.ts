import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listDocuments,
  uploadToFileSearchStore,
  CustomMetadata,
} from "@/lib/google-file-search";

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
    const documents = await listDocuments(storeId);
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
