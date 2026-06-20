import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    await requireAuth();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ conversations: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load conversations." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conversations")
      .insert({ title: body.title || "新会话" })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ conversation: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create conversation." },
      { status: 500 }
    );
  }
}
