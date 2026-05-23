import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listFileSearchStores,
  createFileSearchStore,
} from "@/lib/google-file-search";

function parseLimit(value: string | null): { value?: number; invalid: boolean } {
  if (!value || value.toLowerCase() === "all") return { invalid: false };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { invalid: true };
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return { invalid: true };
  return { value: normalized, invalid: false };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const limitResult = parseLimit(request.nextUrl.searchParams.get("limit"));
    if (limitResult.invalid) {
      return NextResponse.json(
        { error: "limit deve ser inteiro positivo ou 'all'" },
        { status: 400 }
      );
    }
    const stores = await listFileSearchStores(limitResult.value);
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
