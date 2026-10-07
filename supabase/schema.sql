-- =====================================================================
--  Sistema de Estoque e Carregamento — banco de dados (Supabase)
--  Como usar: Supabase > SQL Editor > New query > cole TODO este arquivo > Run.
--  Pode ser executado mais de uma vez (é idempotente).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) TABELAS
-- ---------------------------------------------------------------------

-- Perfis de acesso (1 linha por usuário do Supabase Auth)
create table if not exists public.perfis (
  id        uuid primary key references auth.users(id) on delete cascade,
  login     text not null unique check (login ~ '^[a-z0-9._-]{3,30}$'),
  nome      text not null,
  perfil    text not null check (perfil in ('administrador','conferente')),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.produtos (
  id            text primary key,
  ft            text not null default '',
  nome          text not null default '',
  unidade       text not null default 'un',
  minimo        numeric not null default 0,
  estoque       numeric not null default 0,
  preco         numeric not null default 0,
  ean           text not null default '',
  medidas       text not null default '',
  estrutura     text not null default '',
  pedido_minimo numeric not null default 0,
  criado_em     timestamptz,
  atualizado_em timestamptz,
  extra         jsonb not null default '{}'::jsonb,
  modificado_por uuid,
  modificado_em  timestamptz
);

-- Histórico de movimentações (somente inclusão: nunca é alterado nem apagado)
create table if not exists public.movimentacoes (
  id          text primary key,
  data        timestamptz not null default now(),
  produto_id  text,
  ft          text,
  nome        text,
  unidade     text,
  tipo        text not null,
  quantidade  numeric not null default 0,
  antes       numeric,
  depois      numeric,
  obs         text not null default '',
  extra       jsonb not null default '{}'::jsonb,
  registrado_por uuid default auth.uid()
);
create index if not exists movimentacoes_data_idx    on public.movimentacoes (data desc);
create index if not exists movimentacoes_produto_idx on public.movimentacoes (produto_id);

create table if not exists public.carregamentos (
  id            text primary key,
  numero        text not null default '',
  data          date,
  destino       text not null default '',
  veiculo       text not null default '',
  motorista     text not null default '',
  obs           text not null default '',
  status        text not null default 'Pendente',
  itens         jsonb not null default '[]'::jsonb,
  conferencia   jsonb,
  criado_em     timestamptz,
  confirmado_em timestamptz,
  extra         jsonb not null default '{}'::jsonb,
  modificado_por uuid,
  modificado_em  timestamptz
);
create index if not exists carregamentos_status_idx on public.carregamentos (status);

create table if not exists public.recebimentos (
  id            text primary key,
  numero        text not null default '',
  nf            text not null default '',
  fornecedor    text not null default '',
  inicio        timestamptz,
  fim           timestamptz,
  itens         jsonb not null default '[]'::jsonb,
  divergencias  jsonb not null default '[]'::jsonb,
  total_entrada numeric not null default 0,
  extra         jsonb not null default '{}'::jsonb,
  modificado_por uuid,
  modificado_em  timestamptz
);

-- Contadores compartilhados (próximo nº de carga / recebimento)
create table if not exists public.configuracoes (
  chave     text primary key,
  valor     jsonb not null,
  modificado_por uuid,
  modificado_em  timestamptz
);

-- Registra quem alterou e quando
create or replace function public.marcar_autor() returns trigger
language plpgsql as $$
begin
  new.modificado_por := auth.uid();
  new.modificado_em  := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['produtos','carregamentos','recebimentos','configuracoes'] loop
    execute format('drop trigger if exists trg_autor on public.%I', t);
    execute format('create trigger trg_autor before insert or update on public.%I
                    for each row execute function public.marcar_autor()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) FUNÇÕES DE APOIO À SEGURANÇA
-- ---------------------------------------------------------------------
create or replace function public.usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and ativo)
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis
                 where id = auth.uid() and ativo and perfil = 'administrador')
$$;

-- ---------------------------------------------------------------------
-- 3) ROW LEVEL SECURITY (a regra de acesso vale no servidor, não só na tela)
-- ---------------------------------------------------------------------
alter table public.perfis         enable row level security;
alter table public.produtos       enable row level security;
alter table public.movimentacoes  enable row level security;
alter table public.carregamentos  enable row level security;
alter table public.recebimentos   enable row level security;
alter table public.configuracoes  enable row level security;

-- perfis: cada um lê o próprio; administrador lê todos. Escrita só pelas funções admin_*.
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
  using (id = auth.uid() or public.eh_admin());

-- dados operacionais: qualquer usuário ATIVO (administrador ou conferente)
drop policy if exists produtos_all on public.produtos;
create policy produtos_all on public.produtos for all to authenticated
  using (public.usuario_ativo()) with check (public.usuario_ativo());
-- Para que SOMENTE o administrador cadastre/altere/exclua produtos, troque a linha acima por:
--   using (public.eh_admin()) with check (public.eh_admin());
-- e crie outra policy "for select ... using (public.usuario_ativo())" (e ajuste CONFERENTE_EDITA_PRODUTOS no HTML).

drop policy if exists carregamentos_all on public.carregamentos;
create policy carregamentos_all on public.carregamentos for all to authenticated
  using (public.usuario_ativo()) with check (public.usuario_ativo());

drop policy if exists recebimentos_all on public.recebimentos;
create policy recebimentos_all on public.recebimentos for all to authenticated
  using (public.usuario_ativo()) with check (public.usuario_ativo());

drop policy if exists configuracoes_sel on public.configuracoes;
drop policy if exists configuracoes_ins on public.configuracoes;
drop policy if exists configuracoes_upd on public.configuracoes;
create policy configuracoes_sel on public.configuracoes for select to authenticated using (public.usuario_ativo());
create policy configuracoes_ins on public.configuracoes for insert to authenticated with check (public.usuario_ativo());
create policy configuracoes_upd on public.configuracoes for update to authenticated
  using (public.usuario_ativo()) with check (public.usuario_ativo());

-- movimentações: ler e incluir; nunca alterar/excluir
drop policy if exists mov_sel on public.movimentacoes;
drop policy if exists mov_ins on public.movimentacoes;
drop policy if exists mov_upd on public.movimentacoes;
create policy mov_sel on public.movimentacoes for select to authenticated using (public.usuario_ativo());
create policy mov_ins on public.movimentacoes for insert to authenticated with check (public.usuario_ativo());
-- (sem policy de update/delete: o histórico é imutável; o app envia com "ignore-duplicates")

-- permissões de tabela (anon não acessa nada)
revoke all on public.perfis, public.produtos, public.movimentacoes,
              public.carregamentos, public.recebimentos, public.configuracoes from anon;
revoke all on public.perfis, public.produtos, public.movimentacoes,
              public.carregamentos, public.recebimentos, public.configuracoes from authenticated;
grant select on public.perfis to authenticated;
grant select, insert, update, delete on public.produtos, public.carregamentos, public.recebimentos to authenticated;
grant select, insert on public.movimentacoes to authenticated;
grant select, insert, update on public.configuracoes to authenticated;

-- ---------------------------------------------------------------------
-- 4) GESTÃO DE USUÁRIOS (somente administrador)
--    O login (ex.: "maria") vira o e-mail interno maria@sysestoque.app
-- ---------------------------------------------------------------------
create or replace function public._criar_usuario(p_login text, p_nome text, p_senha text, p_perfil text)
returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_id    uuid := gen_random_uuid();
  v_login text := lower(trim(coalesce(p_login, '')));
  v_email text;
begin
  if v_login !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'Login inválido: use de 3 a 30 caracteres (letras minúsculas, números, ponto, hífen ou sublinhado).';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome do usuário.'; end if;
  if length(coalesce(p_senha, '')) < 6 then raise exception 'A senha deve ter ao menos 6 caracteres.'; end if;
  if p_senha = 'TROQUE_ESTA_SENHA' then raise exception 'Defina uma senha própria.'; end if;
  if p_perfil not in ('administrador', 'conferente') then raise exception 'Perfil inválido.'; end if;
  if exists (select 1 from public.perfis where login = v_login) then
    raise exception 'Já existe um usuário com o login "%".', v_login;
  end if;

  v_email := v_login || '@sysestoque.app';

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(p_senha, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());

  insert into public.perfis (id, login, nome, perfil, ativo)
  values (v_id, v_login, trim(p_nome), p_perfil, true);

  return v_id;
end $$;

create or replace function public.admin_criar_usuario(p_login text, p_nome text, p_senha text, p_perfil text)
returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.eh_admin() then raise exception 'Acesso negado: somente administrador.'; end if;
  return public._criar_usuario(p_login, p_nome, p_senha, p_perfil);
end $$;

create or replace function public.admin_alterar_usuario(
  p_id uuid, p_nome text, p_perfil text, p_ativo boolean, p_nova_senha text default null)
returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_alvo public.perfis;
begin
  if not public.eh_admin() then raise exception 'Acesso negado: somente administrador.'; end if;
  select * into v_alvo from public.perfis where id = p_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome do usuário.'; end if;
  if p_perfil not in ('administrador', 'conferente') then raise exception 'Perfil inválido.'; end if;
  if p_id = auth.uid() and (p_perfil <> v_alvo.perfil or p_ativo <> v_alvo.ativo) then
    raise exception 'Você não pode alterar o próprio perfil nem desativar a si mesmo.';
  end if;

  update public.perfis set nome = trim(p_nome), perfil = p_perfil, ativo = p_ativo where id = p_id;

  if p_nova_senha is not null and p_nova_senha <> '' then
    if length(p_nova_senha) < 6 then raise exception 'A senha deve ter ao menos 6 caracteres.'; end if;
    update auth.users set encrypted_password = crypt(p_nova_senha, gen_salt('bf')), updated_at = now()
     where id = p_id;
  end if;
end $$;

create or replace function public.admin_excluir_usuario(p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.eh_admin() then raise exception 'Acesso negado: somente administrador.'; end if;
  if p_id = auth.uid() then raise exception 'Você não pode excluir o próprio usuário.'; end if;
  if not exists (select 1 from public.perfis where id = p_id) then raise exception 'Usuário não encontrado.'; end if;
  delete from auth.users where id = p_id;   -- apaga também perfis e identidades (cascade)
end $$;

-- _criar_usuario é interna (só o dono do banco / SQL Editor a executa)
revoke execute on function public._criar_usuario(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_criar_usuario(text, text, text, text) from public, anon;
revoke execute on function public.admin_alterar_usuario(uuid, text, text, boolean, text) from public, anon;
revoke execute on function public.admin_excluir_usuario(uuid) from public, anon;
grant  execute on function public.admin_criar_usuario(text, text, text, text) to authenticated;
grant  execute on function public.admin_alterar_usuario(uuid, text, text, boolean, text) to authenticated;
grant  execute on function public.admin_excluir_usuario(uuid) to authenticated;
revoke execute on function public.usuario_ativo(), public.eh_admin() from public, anon;
grant  execute on function public.usuario_ativo(), public.eh_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 5) PRIMEIRO ADMINISTRADOR  (execute UMA vez, depois de trocar login/nome/senha)
--    Apague a senha deste arquivo depois de usar.
-- ---------------------------------------------------------------------
-- select public._criar_usuario('admin', 'Administrador', 'TROQUE_ESTA_SENHA', 'administrador');

-- Alternativa caso a função acima falhe no seu projeto: Authentication > Users > Add user
--   e-mail: admin@sysestoque.app  + uma senha (marque "Auto Confirm User"), e então:
-- insert into public.perfis (id, login, nome, perfil)
--   select id, 'admin', 'Administrador', 'administrador' from auth.users where email = 'admin@sysestoque.app';
