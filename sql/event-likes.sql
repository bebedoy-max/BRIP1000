-- Like publik untuk event (tanpa login, dibatasi per visitor_id).
create table if not exists public.event_likes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (event_id, visitor_id)
);

grant select on public.event_likes to anon;
grant select, insert, delete on public.event_likes to authenticated;
grant all on public.event_likes to service_role;

alter table public.event_likes enable row level security;

drop policy if exists "event_likes readable by everyone" on public.event_likes;
create policy "event_likes readable by everyone"
on public.event_likes for select
to anon, authenticated
using (true);

create index if not exists event_likes_event_id_idx on public.event_likes (event_id);
