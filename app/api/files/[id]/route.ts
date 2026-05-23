import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  deleteDocument,
  uploadToFileSearchStore,
  CustomMetadata,
} from "@/lib/google-file-search";

// DELETE /api/files/[id]?storeId=xxx -> id is short doc id, storeId is short store id
// Reconstructs full path: fileSearchStores/{storeId}/documents/{id}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }
    const fullName = `fileSearchStores/${storeId}/documents/${id}`;
    await deleteDocument(fullName);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FILE DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete document", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/files/[id]?storeId=xxx -> replace document
// Flow: upload new document first, then delete old one
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return NextResponse.json({ error: "storeId required" }, { status: 400 });
    }

    const body = await request.json();
    const { name, mimeType, content, metadata } = body ?? {};
    if (!name || !content) {
      return NextResponse.json(
        { error: "name and content required" },
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

    const uploadResult = await uploadToFileSearchStore(
      storeId,
      fileBuffer,
      String(name),
      typeof mimeType === "string" && mimeType
        ? mimeType
        : "application/octet-stream",
      googleMetadata
    );

    const oldFullName = `fileSearchStores/${storeId}/documents/${id}`;

    try {
      await deleteDocument(oldFullName);
    } catch (deleteError) {
      // Upload succeeded, old delete failed: keep response explicit.
      return NextResponse.json(
        {
          success: false,
          uploaded: true,
          deletedOld: false,
          oldDocumentName: oldFullName,
          newDocumentName: uploadResult.documentName,
          deleteError: String(deleteError),
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      uploaded: true,
      deletedOld: true,
      oldDocumentName: oldFullName,
      newDocumentName: uploadResult.documentName,
      operationName: uploadResult.operationName,
    });
  } catch (error) {
    console.error("[FILE REPLACE PUT]", error);
    return NextResponse.json(
      { error: "Failed to replace document", details: String(error) },
      { status: 500 }
    );
  }
}
