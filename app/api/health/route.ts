import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { testConnection } from "@/lib/google-file-search";

export async function GET(): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
