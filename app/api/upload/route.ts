import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseUpload } from "@/lib/attachments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAuth();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    return NextResponse.json({ attachment: await parseUpload(file) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
