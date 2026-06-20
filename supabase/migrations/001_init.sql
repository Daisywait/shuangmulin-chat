create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
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

alter table conversations add column if not exists user_id uuid references users(id) on delete cascade;
alter table users add column if not exists password_hash text;

create index if not exists users_email_idx on users(email);
create index if not exists conversations_user_updated_at_idx on conversations(user_id, updated_at desc);
create index if not exists conversations_updated_at_idx on conversations(updated_at desc);
create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at asc);
