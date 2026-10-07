# Stoki SDY — Sistema de Carregamento e Estoque

## O que foi adicionado
- **Login** (usuário e senha) antes de qualquer tela. Sem login, o sistema fica oculto.
- **Dois perfis**
  | | Administrador | Conferente |
  |---|---|---|
  | Cadastrar / alterar / excluir usuários | ✅ | ❌ (a aba nem aparece) |
  | Restaurar backup (substitui tudo) | ✅ | ❌ |
  | Produtos, estoque, carregamentos, receber, conferir | ✅ | ✅ |
- **Banco de dados no Supabase**: produtos, movimentações, carregamentos, recebimentos e contadores são gravados na nuvem e compartilhados entre os usuários (atualiza sozinho a cada 30 s).
- O controle de acesso vale **no servidor** (RLS + funções `admin_*`), não só na tela.

## Acesso Demo
Na tela de login, **“Entrar no acesso Demo”** abre o sistema com dados de exemplo, **sem usar o Supabase** e sem gravar nada (nem no navegador). Serve para apresentar o sistema.

## Link de acesso (GitHub Pages)
Depois do push: repositório › **Settings › Pages › Deploy from a branch › main / (root)**. O endereço será:
**https://lojamkv-ui.github.io/sysEstoque/** (o repositório precisa ser público, ou o plano permitir Pages privado).

## Configuração (uma vez)
1. **Criar as tabelas** — Supabase › SQL Editor › cole `supabase/schema.sql` › Run.
2. **Criar o 1º administrador** — no fim do `schema.sql` há um `select public._criar_usuario(...)` comentado. Descomente, troque login/nome/senha, rode e depois apague a senha do arquivo. (Os arquivos `supabase/*.local.sql`, que trazem a senha, ficam fora do Git.)
3. **Chave anon** — Supabase › Project Settings › API › *anon public*. A chave *anon* deste projeto já está na constante `SUPABASE_ANON_KEY` do `Sistema-Estoque.html` (ela é pública por desenho; quem protege os dados são as regras RLS). **Nunca** use a `service_role` no navegador.
4. Abra `index.html` (ou `Sistema-Estoque.html`), entre como administrador e cadastre os conferentes na aba **Usuários**.

> Ao entrar pela 1ª vez num computador que já tem dados do sistema antigo (localStorage) e com o banco vazio, o administrador recebe a opção **“Enviar dados deste computador ao banco”**.

## Publicar no GitHub
```bash
git clone https://github.com/lojamkv-ui/sysEstoque.git
cd sysEstoque
# copie para cá: index.html, Sistema-Estoque.html, README.md, .gitignore e as pastas supabase/ e assets/
git add .
git commit -m "Stoki SDY: novo nome e logo, tema azul, controle de acesso e Supabase"
git push origin HEAD
```
Use um **token novo** (fine-grained, só neste repositório, permissão *Contents: Read and write*) ou o `gh auth login`. Nunca coloque o token em arquivos do projeto.

## Pontos de atenção
- Dois usuários mexendo **no mesmo produto ao mesmo tempo** (dentro de ~1 min) seguem “último a gravar vence”. Para estoque 100 % atômico, o próximo passo é mover a baixa/entrada para uma função no banco.
- Os dados também ficam em cache no navegador (como antes). Em computador compartilhado, use **Sair** e não marque “Manter conectado”.
- Se o conferente também **não** deve cadastrar/editar/excluir produtos: ponha `CONFERENTE_EDITA_PRODUTOS = false` no HTML e use a policy alternativa comentada no `schema.sql`.
- Conferente não troca a própria senha (só o administrador, em *Usuários › Editar*).
