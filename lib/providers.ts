import { ChatMessage, ModelConfig } from "./types";
import { requireEnv } from "./config";

type StreamOptions = {
  model: ModelConfig;
  messages: ChatMessage[];
  systemPrompt?: string;
  signal?: AbortSignal;
};

function withAttachmentText(message: ChatMessage) {
  const textParts = message.attachments
    ?.filter((attachment) => attachment.text)
    .map((attachment) => `\n\n[Attachment: ${attachment.name}]\n${attachment.text}`)
    .join("");

  return `${message.content}${textParts ?? ""}`;
}

function imageAttachments(message: ChatMessage) {
  return message.attachments?.filter((attachment) => attachment.dataUrl) ?? [];
}

function assertImageSupport(options: StreamOptions) {
  const hasImages = options.messages.some((message) => imageAttachments(message).length > 0);
  if (hasImages && !options.model.supportsImages) {
    throw new Error(`${options.model.label} does not support image attachments.`);
  }
}

async function streamOpenAI(options: StreamOptions) {
  assertImageSupport(options);
  const baseUrl = requireEnv("OPENAI_COMPAT_BASE_URL").replace(/\/$/, "");
  const apiKey = requireEnv("OPENAI_COMPAT_API_KEY");

  if (options.model.wireApi === "responses") {
    return streamOpenAIResponses(options, baseUrl, apiKey);
  }

  const messages = options.messages.map((message) => {
    const images = imageAttachments(message);
    if (images.length === 0) {
      return { role: message.role, content: withAttachmentText(message) };
    }

    return {
      role: message.role,
      content: [
        { type: "text", text: withAttachmentText(message) },
        ...images.map((attachment) => ({ type: "image_url", image_url: { url: attachment.dataUrl } }))
      ]
    };
  });

  if (options.systemPrompt) {
    messages.unshift({ role: "system", content: options.systemPrompt });
  }

  const endpointBase = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  return fetch(`${endpointBase}/chat/completions`, {
    method: "POST",
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model.id,
      messages,
      stream: true,
      store: options.model.store ?? false
    })
  });
}

async function streamOpenAIResponses(options: StreamOptions, baseUrl: string, apiKey: string) {
  const input = options.messages.map((message) => {
    const images = imageAttachments(message);
    const role = message.role === "system" ? "developer" : message.role;
    const text = withAttachmentText(message);

    if (images.length === 0) {
      return { role, content: text };
    }

    return {
      role: role === "assistant" ? "assistant" : "user",
      content: [
        { type: "input_text", text },
        ...images.map((attachment) => ({ type: "input_image", image_url: attachment.dataUrl }))
      ]
    };
  });

  const endpointBase = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  return fetch(`${endpointBase}/responses`, {
    method: "POST",
    signal: options.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model.id,
      input,
      instructions: options.systemPrompt || undefined,
      reasoning: options.model.reasoningEffort ? { effort: options.model.reasoningEffort } : undefined,
      store: options.model.store ?? false,
      stream: true
    })
  });
}

async function streamAnthropic(options: StreamOptions) {
  assertImageSupport(options);
  const baseUrl = requireEnv("ANTHROPIC_COMPAT_BASE_URL").replace(/\/$/, "");
  const apiKey = requireEnv("ANTHROPIC_COMPAT_API_KEY");
  const messages = options.messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const images = imageAttachments(message);
      const content: Array<Record<string, unknown>> = [{ type: "text", text: withAttachmentText(message) }];
      for (const attachment of images) {
        const [mediaTypePart, dataPart] = (attachment.dataUrl ?? "").split(";base64,");
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaTypePart.replace("data:", ""),
            data: dataPart
          }
        });
      }
      return { role: message.role === "assistant" ? "assistant" : "user", content };
    });

  return fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    signal: options.signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model.id,
      system: options.systemPrompt || undefined,
      messages,
      max_tokens: 4096,
      stream: true
    })
  });
}

export async function streamProvider(options: StreamOptions) {
  if (options.model.provider === "openai") return streamOpenAI(options);
  return streamAnthropic(options);
}

export async function normalizeProviderStream(response: Response, provider: ModelConfig["provider"]) {
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gateway request failed: ${response.status} ${detail.slice(0, 500)}`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const json = JSON.parse(payload);
              const text = extractTextDelta(json, provider);
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              continue;
            }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    }
  });
}

function extractTextDelta(json: Record<string, any>, provider: ModelConfig["provider"]) {
  if (provider === "anthropic") {
    return json.delta?.text ?? json.content_block?.text;
  }

  if (typeof json.delta === "string") return json.delta;
  if (typeof json.output_text === "string") return json.output_text;
  if (json.type === "response.output_text.delta") return json.delta;
  if (json.type === "response.refusal.delta") return json.delta;
  return json.choices?.[0]?.delta?.content;
}
