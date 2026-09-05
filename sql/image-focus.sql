-- Cache titik fokus (wajah) gambar carousel.
create table if not exists public.image_focus (
  image_key text primary key,
  focus_x real not null default 0.5,
  focus_y real not null default 0.5,
  has_face boolean not null default false,
  updated_at timestamptz not null default now()
);

grant select on public.image_focus to anon;
grant select on public.image_focus to authenticated;
grant all on public.image_focus to service_role;

alter table public.image_focus enable row level security;

drop policy if exists "image_focus readable" on public.image_focus;
create policy "image_focus readable"
  on public.image_focus for select
  to anon, authenticated
  using (true);
