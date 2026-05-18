import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  getFileSearchStore,
  deleteFileSearchStore,
} from "@/lib/google-file-search";

// id = short store name (ex: "teste-06ghd5vwldpp")
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const store = await getFileSearchStore(id);
    return NextResponse.json(store);
  } catch (error) {
    console.error("[FILE-STORE GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch store", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    await deleteFileSearchStore(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[FILE-STORE DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete store", details: String(error) },
      { status: 500 }
    );
  }
}
