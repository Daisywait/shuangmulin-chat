create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table conversations add column if not exists user_id uuid references users(id) on delete cascade;

create index if not exists users_email_idx on users(email);
create index if not exists conversations_user_updated_at_idx on conversations(user_id, updated_at desc);
