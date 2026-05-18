import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listGeminiModels } from "@/lib/google-file-search";

export async function GET(): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const models = await listGeminiModels();
    return NextResponse.json(models);
  } catch (error) {
    console.error("[MODELS GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch models", details: String(error) },
      { status: 500 }
    );
  }
}
