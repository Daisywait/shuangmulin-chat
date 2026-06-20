import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getModelById } from "@/lib/config";
import { normalizeProviderStream, streamProvider } from "@/lib/providers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Attachment, ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = (await request.json()) as {
      conversationId?: string;
      model: string;
      messages: ChatMessage[];
      systemPrompt?: string;
      userMessage?: ChatMessage;
    };

    if (!body.conversationId || !body.model || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "conversationId, model, and messages are required." }, { status: 400 });
    }

    const model = getModelById(body.model);
    const supabase = getSupabaseAdmin();
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", body.conversationId)
      .eq("user_id", user.id)
      .single();
    if (conversationError || !conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const providerResponse = await streamProvider({
      model,
      messages: body.messages,
      systemPrompt: body.systemPrompt
    });
    const normalized = await normalizeProviderStream(providerResponse, model.provider);
    const [clientStream, persistStream] = normalized.tee();

    void persistAssistantMessage({
      supabase,
      conversationId: body.conversationId,
      model: model.id,
      provider: model.provider,
      userMessage: body.userMessage,
      stream: persistStream
    });

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed." },
      { status: 500 }
    );
  }
}

async function persistAssistantMessage(options: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  conversationId: string;
  model: string;
  provider: "openai" | "anthropic";
  userMessage?: ChatMessage;
  stream: ReadableStream<Uint8Array>;
}) {
  const decoder = new TextDecoder();
  let assistantText = "";
  const reader = options.stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    assistantText += decoder.decode(value, { stream: true });
  }

  if (options.userMessage) {
    await options.supabase.from("messages").insert({
      conversation_id: options.conversationId,
      role: "user",
      content: options.userMessage.content,
      provider: options.provider,
      model: options.model,
      attachments: (options.userMessage.attachments ?? []) as Attachment[]
    });
  }

  await options.supabase.from("messages").insert({
    conversation_id: options.conversationId,
    role: "assistant",
    content: assistantText,
    provider: options.provider,
    model: options.model,
    attachments: []
  });

  await options.supabase
    .from("conversations")
    .update({
      title: deriveTitle(options.userMessage?.content),
      updated_at: new Date().toISOString()
    })
    .eq("id", options.conversationId);
}

function deriveTitle(content?: string) {
  if (!content) return "新会话";
  return content.replace(/\s+/g, " ").trim().slice(0, 42) || "新会话";
}
