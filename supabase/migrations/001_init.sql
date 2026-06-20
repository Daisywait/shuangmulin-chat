create extension if not exists "pgcrypto";

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default '新会话',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null default '',
  provider text check (provider in ('openai', 'anthropic')),
  model text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_updated_at_idx on conversations(updated_at desc);
create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at asc);
