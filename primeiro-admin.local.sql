
-- =====================================================================
--  PRIMEIRO ADMINISTRADOR  (login "adStoki" é gravado em minúsculas: adstoki)
--  ARQUIVO LOCAL: contém senha, por isso NÃO vai para o GitHub (.gitignore).
--  Depois do primeiro acesso, troque a senha em Usuários › Editar.
-- =====================================================================
select public._criar_usuario('adStoki', 'Administrador Stoki', 'Stokilog', 'administrador')
 where not exists (select 1 from public.perfis where login = 'adstoki');
