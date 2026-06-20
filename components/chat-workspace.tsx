"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LogOut, MessageSquarePlus, Paperclip, Send, Trash2, UserRound, X } from "lucide-react";
import { Attachment, Conversation, ModelConfig, StoredMessage } from "@/lib/types";

type DraftMessage = StoredMessage & { pending?: boolean };

export function ChatWorkspace({ adminEmail }: { adminEmail: string }) {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState<DraftMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeModel = useMemo(() => models.find((model) => model.id === selectedModel), [models, selectedModel]);
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [conversations, activeConversationId]
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (activeConversationId) void loadMessages(activeConversationId);
  }, [activeConversationId]);

  async function bootstrap() {
    setError("");
    const [modelResult, conversationResult] = await Promise.all([
      fetchJson<{ models: ModelConfig[] }>("/api/models"),
      fetchJson<{ conversations: Conversation[] }>("/api/conversations")
    ]);
    setModels(modelResult.models);
    setSelectedModel(modelResult.models[0]?.id ?? "");
    setConversations(conversationResult.conversations);

    if (conversationResult.conversations[0]) {
      setActiveConversationId(conversationResult.conversations[0].id);
      return;
    }

    await createConversation({ force: true });
  }

  async function loadMessages(conversationId: string) {
    const result = await fetchJson<{ messages: StoredMessage[] }>(`/api/conversations/${conversationId}/messages`);
    setMessages(result.messages);
  }

  async function createConversation(options?: { force?: boolean }) {
    const currentIsEmpty = activeConversationId && messages.length === 0 && !input.trim() && attachments.length === 0;
    if (!options?.force && currentIsEmpty) {
      return;
    }

    const result = await fetchJson<{ conversation: Conversation }>("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新会话" })
    });

    setConversations((items) => [result.conversation, ...items.filter((item) => item.id !== result.conversation.id)]);
    setActiveConversationId(result.conversation.id);
    setMessages([]);
    setInput("");
    setAttachments([]);
  }

  async function deleteConversation(id: string) {
    await fetchJson(`/api/conversations/${id}`, { method: "DELETE" });
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);

    if (activeConversationId !== id) return;
    if (remaining[0]) {
      setActiveConversationId(remaining[0].id);
      return;
    }

    setActiveConversationId("");
    setMessages([]);
    await createConversation({ force: true });
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || !selectedModel || !activeConversationId || isSending) return;

    if (attachments.some((attachment) => attachment.dataUrl) && activeModel && !activeModel.supportsImages) {
      setError("当前模型不支持图片附件。");
      return;
    }

    const userMessage = {
      role: "user" as const,
      content: input.trim(),
      attachments
    };
    const optimisticUser: DraftMessage = {
      id: `user-${Date.now()}`,
      conversation_id: activeConversationId,
      role: "user",
      content: userMessage.content,
      provider: activeModel?.provider ?? null,
      model: selectedModel,
      attachments,
      created_at: new Date().toISOString(),
      pending: true
    };
    const assistantId = `assistant-${Date.now()}`;
    const optimisticAssistant: DraftMessage = {
      id: assistantId,
      conversation_id: activeConversationId,
      role: "assistant",
      content: "",
      provider: activeModel?.provider ?? null,
      model: selectedModel,
      attachments: [],
      created_at: new Date().toISOString(),
      pending: true
    };

    const requestMessages = [...messages, optimisticUser]
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content,
        attachments: message.attachments ?? []
      }));

    setMessages((items) => [...items, optimisticUser, optimisticAssistant]);
    setInput("");
    setAttachments([]);
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          model: selectedModel,
          systemPrompt: "",
          messages: requestMessages,
          userMessage
        })
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "请求失败。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((items) =>
          items.map((message) =>
            message.id === assistantId ? { ...message, content: `${message.content}${chunk}` } : message
          )
        );
      }

      setTimeout(() => void loadMessages(activeConversationId), 450);
      void refreshConversations();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发送失败。");
      setMessages((items) => items.filter((message) => message.id !== assistantId));
    } finally {
      setIsSending(false);
    }
  }

  async function refreshConversations() {
    const result = await fetchJson<{ conversations: Conversation[] }>("/api/conversations");
    setConversations(result.conversations);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");

    try {
      const parsed: Attachment[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const result = await fetchJson<{ attachment: Attachment }>("/api/upload", {
          method: "POST",
          body: formData
        });
        parsed.push(result.attachment);
      }
      setAttachments((items) => [...items, ...parsed]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "上传失败。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <h1 className="brand-title">双木林-chat</h1>
          <button className="new-chat-button" title="新建会话" onClick={() => void createConversation()}>
            <MessageSquarePlus size={18} />
            <span>新建</span>
          </button>
        </div>

        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              className={`conversation-item ${conversation.id === activeConversationId ? "active" : ""}`}
              key={conversation.id}
              onClick={() => setActiveConversationId(conversation.id)}
            >
              <span className="conversation-title">{conversation.title}</span>
              <span
                className="delete-chat-button"
                role="button"
                title="删除会话"
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteConversation(conversation.id);
                }}
              >
                <Trash2 size={15} />
              </span>
            </button>
          ))}
        </div>

        <div className="account-panel">
          <div className="account-avatar">
            <UserRound size={17} />
          </div>
          <div className="account-meta">
            <span className="account-label">管理员</span>
            <span className="account-email">{adminEmail}</span>
          </div>
        </div>

        <button className="logout-button" onClick={() => void logout()}>
          <LogOut size={16} />
          退出登录
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <select className="model-select" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          {error ? <span className="error-line">{error}</span> : null}
        </header>

        <section className="messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>{activeConversation?.title || "今天想聊什么？"}</h2>
            </div>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
        </section>

        <section className="composer-wrap">
          <form className="composer" onSubmit={sendMessage}>
            {attachments.length ? (
              <div className="attachments composer-attachments">
                {attachments.map((attachment, index) => (
                  <span className="attachment-pill" key={`${attachment.name}-${index}`}>
                    {attachment.name}
                    <button
                      type="button"
                      title="移除附件"
                      onClick={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <textarea
              className="message-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="给双木林-chat发送消息"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />

            <div className="composer-footer">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept="text/*,.txt,.md,.csv,.json,.pdf,image/*"
                onChange={(event) => void uploadFiles(event.target.files)}
              />
              <button className="icon-button" type="button" title="上传附件" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={18} />
              </button>
              <button className="send-button" disabled={isSending || !input.trim()} type="submit" title="发送">
                <Send size={18} />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: DraftMessage }) {
  return (
    <article className={`message ${message.role}`}>
      <div className="bubble">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || "..."}</ReactMarkdown>
        {message.attachments?.length ? (
          <div className="attachments">
            {message.attachments.map((attachment, index) => (
              <span className="attachment-pill" key={`${attachment.name}-${index}`}>
                {attachment.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }
  return body as T;
}
