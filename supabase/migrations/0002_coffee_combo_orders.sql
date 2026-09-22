-- Redesign orders for the shop's actual business: single-product (coffee)
-- "buy X get X free" combo deals, priced in Lao Kip. Replaces the generic
-- multi-line-item model — order_items is no longer written to by the app
-- (left in place rather than dropped, since dropping it is not reversible
-- and nothing currently depends on removing it).

alter table public.orders
  add column if not exists order_date date not null default current_date,
  add column if not exists paid_qty numeric(10, 2) not null default 0,
  add column if not exists free_qty numeric(10, 2) not null default 0,
  add column if not exists total_amount numeric(12, 2) not null default 0,
  add column if not exists bill_number text;

alter table public.orders
  rename column delivery_address to destination;
