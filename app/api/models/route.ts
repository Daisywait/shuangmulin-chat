import { NextResponse } from "next/server";
import { getModelConfig } from "@/lib/config";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({ models: getModelConfig() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}
