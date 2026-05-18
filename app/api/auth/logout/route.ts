import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  try {
    await logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}
