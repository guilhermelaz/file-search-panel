import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";

// GET /api/settings - Buscar configurações
export async function GET(): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: {},
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[SETTINGS GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Atualizar configurações
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { googleApiKey } = body;

    console.log("[SETTINGS PUT] Updating settings, apiKey length:", googleApiKey?.length || 0);

    let settings = await prisma.settings.findFirst();
    console.log("[SETTINGS PUT] Current settings found:", !!settings);

    const updateData: { googleApiKey?: string } = {};
    if (googleApiKey !== undefined) updateData.googleApiKey = googleApiKey;

    if (settings) {
      console.log("[SETTINGS PUT] Updating existing settings, id:", settings.id);
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: updateData,
      });
    } else {
      console.log("[SETTINGS PUT] Creating new settings");
      settings = await prisma.settings.create({
        data: updateData,
      });
    }

    console.log("[SETTINGS PUT] Success");
    return NextResponse.json(settings);
  } catch (error) {
    console.error("[SETTINGS PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update settings", details: String(error) },
      { status: 500 }
    );
  }
}
