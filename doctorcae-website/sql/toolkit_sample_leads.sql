-- Toolkit sample leads table for therapist-focused funnel.
-- Run in Supabase SQL Editor.

create table if not exists public.toolkit_sample_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  source text not null default 'toolkit_sample',
  product_interest text not null default 'Body First Framework Manual and Toolkit',
  created_at timestamptz not null default now(),
  download_sent boolean not null default false,
  email_sent_at timestamptz,
  resend_message_id text,
  error_message text
);

create unique index if not exists toolkit_sample_leads_email_key
  on public.toolkit_sample_leads (lower(email));

create index if not exists toolkit_sample_leads_created_at_idx
  on public.toolkit_sample_leads (created_at desc);

comment on table public.toolkit_sample_leads is
  'Lead captures for Body First Framework Manual & Toolkit sample downloads.';
