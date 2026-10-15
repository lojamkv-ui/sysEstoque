# sysEstoque
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
- **Conferência por QR Code / EAN** (aba *Conferência QR/EAN*): leia o código de barras (EAN-13, EAN-8, UPC-A) ou o QR Code do produto pela câmera, por foto ou digitando; dê entrada/saída/ajuste na hora, faça contagem (checklist) e gere etiquetas com QR + código de barras. Ver detalhes abaixo.
- **App Android instalável** (`mobile/`): mesmo recurso de leitura no celular, com **requisição de material** — o QR gerado no celular é lido pelo sistema do computador e dá baixa/entrada no estoque. Instala **por link** (PWA) ou pelo APK. Ver abaixo.
- **Relatório de movimentação** (aba *Relatórios*): filtros por período (data **e hora**), produto, tipo, origem, usuário e busca livre; dashboard com indicadores, gráficos, **curva do produto (ABC)**; download em **Excel (.xlsx)**, CSV e impressão/PDF. Ver detalhes abaixo.
- O controle de acesso vale **no servidor** (RLS + funções `admin_*`), não só na tela.

## Relatório de movimentação (aba *Relatórios*)

Aba **Análise › Relatórios** — traz **toda a movimentação de estoque**, sempre com **data e hora**.

**Filtros** (aplicam na tela, no Excel, no CSV e na impressão)
- Período: data/hora inicial e data/hora final + atalhos (Hoje, 7 dias, 30 dias, Este mês, Este ano, Tudo).
- Produto, tipo (entrada/saída/ajuste), **origem** (Manual, Leitura, Requisição, Ajuste, Carregamento, Conferência, Recebimento, Cadastro inicial) e usuário.
- Busca livre por nome, FT, observação, origem ou usuário.

**Dashboard**
- Indicadores: movimentações, entradas, saídas, ajustes, saldo líquido e valor movimentado (R$).
- Gráficos: movimentações por dia/semana/mês (barras empilhadas por tipo) e por hora do dia; **curva do produto (ABC)** em gráfico de Pareto + tabela com classe A/B/C, % do total e % acumulado (critério: valor em R$, quantidade ou nº de movimentações).
- Tabelas: totais por período e a lista completa das movimentações (Data, Hora, Produto, Tipo, Origem, Qtd., Antes, Depois, Valor, Observação, Usuário).

**Download**
- **Excel .xlsx** com 5 abas: *Resumo* (indicadores, destaques e filtros usados), *Movimentações* (todas as linhas, com data, hora e data/hora em formatos de data do Excel, filtro automático e cabeçalho congelado), *Curva ABC*, *Por dia* e *Por hora*.
- **CSV** (`;` + BOM UTF-8) e **Imprimir / PDF**.

> As movimentações passam a gravar automaticamente **origem** e **operador** (quem estava logado). Registros antigos, sem esses campos, têm a origem deduzida pela observação (ex.: “Saída — Carga nº …” ⇒ Carregamento) e o usuário aparece como “—”.

## Conferência por QR Code / EAN (aba *Conferência QR/EAN*)

**Como ler**
- **Câmera** — botão *Ligar câmera*: lê EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, CODE-39, ITF, QR Code, Data Matrix e PDF417.
  - *Observação:* navegador só libera a câmera em **https** (GitHub Pages, por exemplo) ou em *localhost*. Em `file://`/http use *Ler de uma foto* ou a digitação.
  - Lanterna no botão 🔆 quando o aparelho oferece.
- **Foto** — *Ler de uma foto*: escolhe uma imagem (ou abre a câmera no celular) e extrai o código dela.
- **Digitado** — aceita EAN, FT/Código, ID interno, link com `?ean=` / `&codigo=`, etiqueta `STOKI;<EAN>;<FT>` e requisição `STOKIREQ;...` do app.

**O que dá para fazer com o produto lido**
- **Entrada / Saída / Ajuste** na hora (origem *Leitura*), com data, hora e operador gravados no relatório.
- **Contagem / checklist**: cada bipe soma 1 (ou a quantidade do campo) no produto; ao final, *Aplicar* faz o ajuste (estoque passa a ser o contado) ou lança só a diferença — gera **Excel** com *Resumo*, *Leituras* e *Contagem*.
- **Conferir carga**: no modo *Carga*, cada leitura marca o item do romaneio (mesma conferência da aba Carregamentos).
- **Recebimento**: no modo *Recebimento*, as leituras entram como itens da nota em andamento.
- **Etiquetas**: gera etiquetas com **QR Code** (`STOKI;<EAN>;<FT>`) + **código de barras** desenhado em EAN-13/EAN-8/UPC-A (sem biblioteca de imagem: SVG puro). Imprime na impressora comum ou salva em PDF.
- **Eco da câmera**: a mesma leitura repetida em 2,5 s é ignorada (a câmera repete o mesmo código várias vezes por segundo); outra leitura conta normalmente.

**Requisição vinda do app** — o QR gerado no celular usa o formato
`STOKIREQ;<número>;<SAIDA|ENTRADA|MATERIAL>;<solicitante>;<FT>:<qtd>|<FT>:<qtd>;<observação>`.
Ao ler esse QR (ou receber o texto por WhatsApp e colar no campo digitado), o sistema abre o cartão **Requisição recebida do app**, mostra o que existe em estoque, imprime a **lista de separação** e, com um clique, aplica a entrada/saída (origem *Requisição*).

## App Android (celular) — leitura por QR/EAN

O app fica em **`mobile/`** (projeto *Capacitor 6* + `www/`). Ele é **100 % offline**: guarda o catálogo no próprio aparelho (importe o *CSV de produtos* exportado pelo sistema), faz leitura por QR/EAN, entrada/saída/contagem e monta a **requisição** com QR para o sistema do computador ler.

### Instalar por link (mais rápido, sem loja)
O app é uma **PWA**: abra no celular
`https://lojamkv-ui.github.io/sysEstoque/mobile/www/index.html`
(ou `mobile/www/index.html` em qualquer servidor **https**) e use **Instalar app** / *Adicionar à tela inicial*. O service worker (`sw.js`) deixa o app abrir sem internet depois da 1ª visita. Os ícones e o manifest (`manifest.webmanifest`) já estão no repositório.

### Gerar o APK (Android Studio ou linha de comando)
Não é preciso loja: o APK pode ser enviado direto para o celular (WhatsApp, Drive…) e instalado (o Android pede para permitir “instalar de fontes desconhecidas”).
```bash
cd mobile
npm install                 # baixa o @capacitor (só na 1ª vez)
npx cap sync android        # copia www/ para dentro do projeto Android
cd android
./gradlew assembleDebug     # ou: ./gradlew assembleRelease (assinado)
```
- APK gerado em `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- Também dá para abrir `mobile/android` no **Android Studio** e rodar ▶ / *Generate Signed Bundle/APK*.
- Requisitos no computador: **JDK 17** e **Android SDK** (Android Studio já traz os dois). O projeto já define: `compileSdk 34`, `minSdk 22`, AGP 8.2.1, Gradle 8, pacote **`br.com.stokisdy.app`**, nome **Stoki SDY**, permissão de **câmera** e `usesCleartextTraffic` (para http interno).
- Ícones, ícone adaptativo e telas de abertura do app são gerados por `python3 mobile/scripts/gerar-icones.py` (Pillow).

### Bibliotecas incluídas (funcionam offline)
As duas bibliotecas usadas na leitura ficam **dentro do repositório** (nada de CDN):
| Arquivo | Versão | Licença |
|---|---|---|
| `assets/html5-qrcode.min.js` | html5-qrcode 2.3.8 | Apache-2.0 (`assets/html5-qrcode.LICENSE.txt`) |
| `assets/qrcode-generator.js` | qrcode-generator 2.0.4 (Kazuhiko Arase) | MIT (`assets/qrcode-generator.LICENSE.txt`) |
O app usa as mesmas bibliotecas em `mobile/www/vendor/`.

> No Android, a leitura usa a API nativa `BarcodeDetector` (quando disponível) — mais rápida que a leitura por JavaScript puro.

## Testes automatizados
```bash
npm install --no-save jsdom     # só na primeira vez
bash testes/rodar.sh
```
| Bateria | O que confere |
|---|---|
| `testes/01-conferencia-codigos.js` | busca nos 10 formatos de código, dígito verificador, padrão de barras conferido com `python-barcode`, QR, etiquetas, contagem, cargas, recebimento, câmera, requisição |
| `testes/02-app-android.js` | app do celular (catálogo, importação do CSV do sistema, leituras, movimentações, requisição) e o **ciclo completo** app → QR → sistema do computador → baixa no estoque |
| `testes/03-relatorio-movimentacao.js` | filtros, dashboard, curva ABC e Excel do relatório |
| `testes/04-origem-movimentacoes.js` | origem/operador em cada tipo de movimentação |
| `testes/05-validacao-telas.js` | todas as abas abrem, permissões do perfil conferente |

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
# copie para cá: index.html, Sistema-Estoque.html, README.md, .gitignore e as pastas supabase/, assets/, mobile/ e testes/
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
- **Câmera**: o navegador só libera em **https** ou *localhost*. Em `file://`/http continue usando *Ler de uma foto* ou a digitação. No app Android a câmera funciona sempre (permissão pedida na 1ª leitura).
- **Catálogo do app**: o celular guarda a própria cópia dos produtos (funciona offline). Ele não lê o banco do computador sozinho — para o estoque oficial, exporte o *CSV de produtos* no sistema e importe no app, e mande as baixas por **requisição (QR)**.
- **Sem JDK/Android SDK** na máquina de build: o APK não compila. Instale o Android Studio (JDK 17 + SDK) ou use só a **instalação por link** (PWA).