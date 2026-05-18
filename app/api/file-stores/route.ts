import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listFileSearchStores,
  createFileSearchStore,
} from "@/lib/google-file-search";

export async function GET(): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const stores = await listFileSearchStores();
    return NextResponse.json(stores);
  } catch (error) {
    console.error("[FILE-STORES GET]", error);
    return NextResponse.json(
      { error: "Failed to list stores", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const store = await createFileSearchStore(name);
    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error("[FILE-STORES POST]", error);
    return NextResponse.json(
      { error: "Failed to create store", details: String(error) },
      { status: 500 }
    );
  }
}
