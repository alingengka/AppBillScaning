-- BillScan schema: shop settings, orders, order items.
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- 1. Shop settings (one row per user) --------------------------------------

create table if not exists public.shop_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shop_name text not null default 'ร้านของฉัน',
  shop_phone text,
  shop_address text,
  updated_at timestamptz not null default now()
);

alter table public.shop_settings enable row level security;

create policy "shop_settings_select_own" on public.shop_settings
  for select using (auth.uid() = user_id);
create policy "shop_settings_upsert_own" on public.shop_settings
  for insert with check (auth.uid() = user_id);
create policy "shop_settings_update_own" on public.shop_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Orders -----------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_name text,
  customer_phone text,
  delivery_address text,
  note text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'delivered', 'cancelled')),
  delivery_fee numeric(10, 2) not null default 0,
  source_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);
create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "orders_update_own" on public.orders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders_delete_own" on public.orders
  for delete using (auth.uid() = user_id);

-- 3. Order items --------------------------------------------------------------

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  name text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

create policy "order_items_select_own" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );
create policy "order_items_insert_own" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );
create policy "order_items_update_own" on public.order_items
  for update using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );
create policy "order_items_delete_own" on public.order_items
  for delete using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- 4. Keep orders.updated_at fresh -------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists shop_settings_set_updated_at on public.shop_settings;
create trigger shop_settings_set_updated_at
  before update on public.shop_settings
  for each row execute function public.set_updated_at();

-- 5. Storage bucket for scanned screenshots ----------------------------------

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

create policy "screenshots_select_own" on storage.objects
  for select using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "screenshots_insert_own" on storage.objects
  for insert with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "screenshots_delete_own" on storage.objects
  for delete using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
