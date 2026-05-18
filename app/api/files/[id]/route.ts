import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deleteDocument } from "@/lib/google-file-search";

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
