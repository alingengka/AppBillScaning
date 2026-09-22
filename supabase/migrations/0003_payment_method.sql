-- Payment terms shown as checkboxes on the printed bill: COD, pay at
-- destination, or pay at origin — matching the shop's paper label template.

alter table public.orders
  add column if not exists payment_method text
    check (payment_method in ('cod', 'destination', 'origin'));
