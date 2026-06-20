export type Provider = "openai" | "anthropic";

export type ModelConfig = {
  id: string;
  label: string;
  provider: Provider;
  supportsImages?: boolean;
  contextWindow?: number;
  wireApi?: "chat_completions" | "responses";
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  store?: boolean;
};

export type Attachment = {
  id?: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  dataUrl?: string;
};

export type ChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider: Provider | null;
  model: string | null;
  attachments: Attachment[] | null;
  created_at: string;
};
