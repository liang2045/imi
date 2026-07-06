create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'member');
create type public.user_status as enum ('active', 'pending', 'disabled');
create type public.collaboration_status as enum ('样品寄送中','达人初稿脚本中','初稿脚本审核中','达人修改中','品牌最终审核中','待达人发布','笔记已发布','合作延期','合作已完成');
create type public.shipping_status as enum ('待寄出','已寄出','已签收');
create type public.payment_status as enum ('未申请','审批中','已付款');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  dingtalk_union_id text unique,
  dingtalk_user_id text,
  name text not null,
  avatar_url text,
  mobile text,
  role public.user_role not null default 'member',
  status public.user_status not null default 'pending',
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default '待分类',
  city text,
  phone text,
  followers integer not null default 0 check (followers >= 0),
  quote_cents integer not null default 0 check (quote_cents >= 0),
  tags text[] not null default '{}',
  notes text,
  created_by uuid references public.users(id),
  owner_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_accounts (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  platform text not null,
  handle text not null,
  profile_url text,
  unique(influencer_id, platform, handle)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(), name text not null, month char(7) not null,
  budget_cents integer not null default 0 check (budget_cents >= 0), created_by uuid references public.users(id), created_at timestamptz not null default now()
);

create table public.collaborations (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id), owner_id uuid references public.users(id),
  status public.collaboration_status not null default '样品寄送中', fee_cents integer not null default 0 check (fee_cents >= 0),
  cooperation_intent text, influencer_reject_reason text, brand_result text, brand_reject_reason text,
  planned_publish_date date, created_by uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(campaign_id, influencer_id)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  courier text, tracking_no text, status public.shipping_status not null default '待寄出', shipped_at timestamptz, signed_at timestamptz, created_at timestamptz not null default now()
);
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade,
  event_time timestamptz not null, description text not null, raw_payload jsonb, created_at timestamptz not null default now()
);
create table public.settlements (
  id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  amount_cents integer not null default 0, status public.payment_status not null default '未申请', requested_at timestamptz, approved_at timestamptz, paid_at timestamptz
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns(id) on delete cascade,
  collaboration_id uuid references public.collaborations(id) on delete set null, category text not null, amount_cents integer not null check (amount_cents >= 0), occurred_on date not null
);
create table public.content_deliverables (
  id uuid primary key default gen_random_uuid(), collaboration_id uuid not null references public.collaborations(id) on delete cascade,
  kind text not null, url text, submitted_at timestamptz, approved_at timestamptz, published_at timestamptz
);
create table public.attachments (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, storage_path text not null,
  file_name text not null, mime_type text, size_bytes bigint, uploaded_by uuid references public.users(id), created_at timestamptz not null default now()
);
create table public.activity_logs (
  id bigint generated always as identity primary key, actor_id uuid references public.users(id), entity_type text not null,
  entity_id uuid, action text not null, changes jsonb, created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.influencers enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.collaborations enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.settlements enable row level security;
alter table public.expenses enable row level security;
alter table public.content_deliverables enable row level security;
alter table public.attachments enable row level security;
alter table public.activity_logs enable row level security;

create or replace function public.is_team_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and status = 'active');
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create policy "users read team" on public.users for select using (public.is_team_member());
create policy "admins manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());
create policy "team influencers" on public.influencers for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team platform accounts" on public.platform_accounts for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team campaigns" on public.campaigns for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team collaborations" on public.collaborations for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team shipments" on public.shipments for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team shipment events" on public.shipment_events for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team settlements" on public.settlements for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team expenses" on public.expenses for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team deliverables" on public.content_deliverables for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team attachments" on public.attachments for all using (public.is_team_member()) with check (public.is_team_member());
create policy "team logs read" on public.activity_logs for select using (public.is_team_member());
create policy "team logs insert" on public.activity_logs for insert with check (actor_id = auth.uid());

insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false) on conflict do nothing;
create policy "team attachment files read" on storage.objects for select using (bucket_id = 'attachments' and public.is_team_member());
create policy "team attachment files write" on storage.objects for insert with check (bucket_id = 'attachments' and public.is_team_member());
