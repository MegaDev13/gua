-- GAU — Supabase Schema
-- Rode no SQL Editor do Supabase Dashboard: https://ebjjxncnlddzfgkqegpa.supabase.co

-- Tabela de personagens
create table if not exists personagens (
  id text primary key,
  owner_id text not null,
  nome text,
  conceito text,
  pontos_totais int default 150,
  dados jsonb not null,
  criado_em timestamp with time zone default now(),
  atualizado_em timestamp with time zone default now()
);

-- Índices
create index if not exists idx_personagens_owner on personagens(owner_id);
create index if not exists idx_personagens_atualizado on personagens(atualizado_em desc);
create index if not exists idx_personagens_dados_gin on personagens using gin (dados);

-- RLS: desabilitado para teste anônimo (em produção habilite e crie policies)
alter table personagens disable row level security;

-- Ou se quiser RLS habilitado com policy permissiva para anon:
-- alter table personagens enable row level security;
-- drop policy if exists "allow anon all" on personagens;
-- create policy "allow anon all" on personagens for all using (true) with check (true);

-- Tabela opcional para catálogos custom (usuários podem criar vantagens custom)
create table if not exists catalogos_custom (
  id text primary key,
  owner_id text not null,
  tipo text not null, -- vantagem, desvantagem, pericia, magia, poder, peculiaridade
  dados jsonb not null,
  criado_em timestamp with time zone default now()
);
create index if not exists idx_catalogos_owner_tipo on catalogos_custom(owner_id, tipo);
alter table catalogos_custom disable row level security;

-- Função para atualizar atualizado_em
create or replace function update_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_personagens_atualizado on personagens;
create trigger trg_personagens_atualizado
  before update on personagens
  for each row execute function update_atualizado_em();
