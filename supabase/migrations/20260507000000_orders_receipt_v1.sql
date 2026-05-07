-- 주문접수 v1: 거래처 B2B 포털 + 직원 주문 관리
-- 신규 customer_orders / customer_order_items + customers 직송 컬럼 추가
-- 참고: users.customer_id, customers.login_id/password_hash, customers.price_grade 는 이미 존재

-- 1. customers — 직송 단가등급 + 활성 플래그
alter table public.customers add column if not exists
  dropship_price_grade text check (dropship_price_grade in ('in','out','pallet'));
alter table public.customers add column if not exists
  dropship_enabled boolean default false;

-- 2. customer_orders — 주문 헤더
create table if not exists public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,                       -- 'DH-YYYYMMDD-NNN'
  customer_id   bigint not null references public.customers(id),
  customer_code text not null,                         -- ERP CODE2 캐시
  customer_name text not null,
  status text not null default 'waiting'
    check (status in ('waiting','confirmed','shipped','done','canceled')),
  ship_type text not null default 'normal'
    check (ship_type in ('normal','direct')),
  -- 직송 (ship_type='direct')
  ship_recipient_name   text,
  ship_recipient_phone  text,
  ship_zip    text,
  ship_addr1  text,
  ship_addr2  text,
  ship_addr_verified boolean default false,            -- Daum API 통과
  ship_note   text,
  ship_carrier      text,
  ship_tracking_no  text,
  ship_excel_printed_at timestamptz,
  -- 합계
  price_grade   text not null check (price_grade in ('in','out','pallet')),
  total_amount  numeric(14,2) not null default 0,
  total_qty     integer not null default 0,
  customer_note text,
  internal_note text,
  -- 연계
  erp_order_no     text,
  erp_confirmed_at timestamptz,
  transaction_id   uuid references public.dh_transactions(id),
  -- 타임스탬프
  shipped_at   timestamptz,
  completed_at timestamptz,
  canceled_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_customer_orders_status_created
  on public.customer_orders(status, created_at desc);
create index if not exists idx_customer_orders_customer
  on public.customer_orders(customer_id);

-- 3. customer_order_items — 품목 라인
create table if not exists public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  line_no  integer not null,
  product_code text not null,
  product_name text not null,
  brand    text not null,                               -- '콜라보' | '비트맨' (확장 가능)
  category text,
  unit_price numeric(12,2) not null,                    -- 등급가 스냅샷
  quantity   integer not null default 1,
  amount numeric(14,2) generated always as (unit_price * quantity) stored,
  stock_at_order text,                                  -- 'plenty'|'low'|'out' 스냅샷
  note text
);
create index if not exists idx_customer_order_items_order
  on public.customer_order_items(order_id);

-- 4. RLS — service role(서버) 전용. 프론트는 모두 API 경유
alter table public.customer_orders      enable row level security;
alter table public.customer_order_items enable row level security;

drop policy if exists "service role full" on public.customer_orders;
create policy "service role full" on public.customer_orders for all using (true);

drop policy if exists "service role full" on public.customer_order_items;
create policy "service role full" on public.customer_order_items for all using (true);

-- 5. updated_at 자동 갱신
create or replace function public.tg_set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_updated_at_customer_orders on public.customer_orders;
create trigger set_updated_at_customer_orders
  before update on public.customer_orders
  for each row execute function public.tg_set_updated_at();
