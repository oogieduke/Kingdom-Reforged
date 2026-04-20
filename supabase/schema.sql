-- Kingdom Reforged cloud storage
-- Paste this file in Supabase SQL Editor, then deploy the Edge Function in
-- supabase/functions/kingdom-sync.

create table if not exists public.kr_projects (
  id text primary key,
  name text not null default 'Kingdom Reforged',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.kr_assets (
  project_id text not null references public.kr_projects(id) on delete cascade,
  kind text not null check (kind in ('image', 'icon')),
  asset_id text not null,
  name text not null,
  category text check (category in ('resource', 'bonus') or category is null),
  storage_path text not null,
  public_url text not null,
  mime_type text,
  size_bytes bigint,
  updated_at timestamptz not null default now(),
  primary key (project_id, kind, asset_id)
);

alter table public.kr_projects enable row level security;
alter table public.kr_assets enable row level security;

drop policy if exists "Public can read Kingdom projects" on public.kr_projects;
create policy "Public can read Kingdom projects"
on public.kr_projects
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read Kingdom assets" on public.kr_assets;
create policy "Public can read Kingdom assets"
on public.kr_assets
for select
to anon, authenticated
using (true);

-- Writes are intentionally not opened through RLS. The kingdom-sync Edge
-- Function writes with the service role key after checking KINGDOM_EDIT_PASSWORD.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kingdom-assets',
  'kingdom-assets',
  true,
  10485760,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
