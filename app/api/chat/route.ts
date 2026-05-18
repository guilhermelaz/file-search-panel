import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { chatWithStores, ChatMessage } from "@/lib/google-file-search";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { storeIds, messages, model } = body;

    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      return NextResponse.json({ error: "storeIds required" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const history: ChatMessage[] = messages.map((m: { role: string; text: string }) => ({
      role: m.role === "model" ? "model" : "user",
      text: String(m.text || ""),
    }));

    const response = await chatWithStores(
      storeIds,
      history,
      typeof model === "string" ? model : "gemini-2.5-flash"
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[CHAT POST]", error);
    return NextResponse.json(
      { error: "Chat failed", details: String(error) },
      { status: 500 }
    );
  }
}
