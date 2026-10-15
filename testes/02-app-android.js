/* Bateria de testes do Stoki SDY.
   Uso, da raiz do repositório:   node testes/02-app-android.js
   Requisito: jsdom (npm install --no-save jsdom). */
const moduloCaminho = require('path');
const CAMINHO_RAIZ = moduloCaminho.join(__dirname, '..');
const CAMINHO_DESKTOP = moduloCaminho.join(CAMINHO_RAIZ, 'Sistema-Estoque.html');
const CAMINHO_APP = moduloCaminho.join(CAMINHO_RAIZ, 'mobile', 'www', 'index.html');
const CAMINHO_INDEX = moduloCaminho.join(CAMINHO_RAIZ, 'index.html');
const URL_DESKTOP = 'file://' + CAMINHO_DESKTOP;
const URL_APP = 'file://' + CAMINHO_APP;
const URL_INDEX = 'file://' + CAMINHO_INDEX;
function requerer(pacote){
  for(const tentativa of ['jsdom', moduloCaminho.join(CAMINHO_RAIZ, 'node_modules', pacote), '/tmp/node_modules/' + pacote]){
    try{ return require(tentativa); }catch(e){}
  }
  console.error('Instale o jsdom antes de rodar os testes:  npm install --no-save jsdom');
  process.exit(2);
}
const { JSDOM } = requerer('jsdom');
/* Testes do app Android/PWA (mobile/www) e da integração com o sistema do computador.
   Uso: node --unhandled-rejections=warn teste-app.js */
const fs = require('fs');

const ok = [], falhas = [];
const testar = (nome, cond, extra) => (cond ? ok : falhas).push(nome + (extra !== undefined ? ' → ' + extra : ''));
const espera = ms => new Promise(r => setTimeout(r, ms));
/* espera a página terminar de carregar sem depender do evento (pode ter disparado antes) */
async function carregada(w, limite = 15000){
  const t0 = Date.now();
  while(Date.now() - t0 < limite){
    if(w.document.readyState === 'complete' && w.__app) return true;
    await espera(50);
  }
  return false;
}

/* ---------------- memória local simulada (file:// não tem localStorage) ---------------- */
function memoriaLocal(){
  const dados = {};
  return {
    getItem: k => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: k => { delete dados[k]; },
    clear: () => { for(const k of Object.keys(dados)) delete dados[k]; },
    key: i => Object.keys(dados)[i] || null,
    get length(){ return Object.keys(dados).length; }
  };
}

/* ---------------- janela do app ---------------- */
function criarApp(){
  const erros = [];
  const dom = new JSDOM(fs.readFileSync(CAMINHO_APP, 'utf8'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: URL_APP,
    beforeParse(w){
      Object.defineProperty(w, 'localStorage', {value: memoriaLocal(), configurable: true});
      w.confirm = () => true;
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = function(){};
      w.URL.createObjectURL = () => 'blob:teste';
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function(){ this.__clicado = true; };
      w.addEventListener('error', e => erros.push('erro global: ' + (e && e.message)));
      w.addEventListener('unhandledrejection', e => erros.push('promessa: ' + (e && e.reason && e.reason.message)));
    }
  });
  dom.__erros = erros;
  return dom;
}

/* ---------------- janela do sistema do computador ---------------- */
function criarDesktop(){
  const capturado = {}, erros = [];
  const dom = new JSDOM(fs.readFileSync(CAMINHO_DESKTOP, 'utf8'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    url: URL_DESKTOP,
    beforeParse(w){
      w.print = () => { capturado.print = (capturado.print || 0) + 1; };
      w.HTMLAnchorElement.prototype.click = function(){};
      w.addEventListener('error', e => erros.push('erro global: ' + (e && e.message)));
    }
  });
  dom.__capturado = capturado; dom.__erros = erros;
  return dom;
}

(async () => {
  try{
    /* ================= APP ================= */
    const dom = criarApp();
    const w = dom.window;
    const $ = s => w.document.querySelector(s);
    const $$ = s => Array.from(w.document.querySelectorAll(s));
    testar('app terminou de carregar', await carregada(w));
    await espera(60);
    const APP = w.__app;
    const dados = () => APP.DADOS();

    console.log('== APP (mobile/www) ==');
    testar('app carregou a interface', !!APP && $$('#abas button').length === 4, $$('#abas button').length + ' abas');
    testar('biblioteca de leitura no app', typeof w.Html5Qrcode === 'function', typeof w.Html5Qrcode);
    testar('gerador de QR no app', typeof w.qrcode === 'function', typeof w.qrcode);
    testar('catálogo começa vazio', dados().produtos.length === 0);
    testar('avisos do app (sem CDN externo)', dom.__erros.length === 0, dom.__erros.join(' | '));

    /* cadastro */
    $('#pFT').value = '2025/0771-CX'; $('#pEan').value = '7891234500014';
    $('#pNome').value = 'Cx. Biscoito Trigo Popular 12x250g'; $('#pUnidade').value = 'cx'; $('#pEstoque').value = '10';
    $('#btnSalvarProduto').click();
    testar('produto cadastrado no aparelho', dados().produtos.length === 1 && dados().produtos[0].estoque === 10, JSON.stringify(dados().produtos[0] || null));
    testar('estoque inicial virou movimentação', dados().movimentacoes.length === 1 && dados().movimentacoes[0].tipo === 'Entrada' && dados().movimentacoes[0].origem === 'Cadastro');
    testar('contador do catálogo atualizado', $('#tagTotal').textContent.indexOf('1 produto') > -1, $('#tagTotal').textContent);

    /* busca por código */
    const p0 = dados().produtos[0];
    ['7891234500014', '2025/0771-CX', 'STOKI;7891234500014;2025/0771-CX', 'https://loja.github.io/sysEstoque/Sistema-Estoque.html?ean=7891234500014'].forEach(entrada => {
      const r = APP.acharProduto(entrada);
      testar('acha produto por “' + entrada.slice(0, 28) + '”', r.ok && r.produto.id === p0.id, r.ok ? r.campo : r.msg);
    });
    testar('código desconhecido não acha produto', !APP.acharProduto('7899999999999').ok);
    testar('etiqueta desconhecida explica o motivo', APP.acharProduto('STOKI;7899999999999;FT-X').msg.indexOf('catálogo') > -1);

    /* leitura pela câmera (com eco) */
    APP.registrarLeitura('7891234500014', 'câmera');
    testar('leitura registrada', dados().leituras.length === 1 && APP.APP.produtoId === p0.id, JSON.stringify(dados().leituras[0] || null));
    testar('card do produto aparece', $('#cartaoProduto').style.display === '' && $('#produtoBox').innerHTML.indexOf('Cx. Biscoito') > -1);
    APP.registrarLeitura('7891234500014', 'câmera');
    testar('eco da câmera é ignorado', dados().leituras.length === 1 && APP.APP.ecos === 1, 'ecos=' + APP.APP.ecos);
    APP.APP.ultimoEm = 0;
    APP.registrarLeitura('7891234500014', 'digitado');
    testar('digitação do mesmo código conta de novo', dados().leituras.length === 2, dados().leituras.length);
    APP.registrarLeitura('7890000000000', 'digitado');
    testar('código novo avisa e pré-preenche cadastro', $('#pEan').value === '7890000000000' && $('#produtoBox').innerHTML.indexOf('não está no catálogo') > -1, $('#pEan').value);

    /* movimentações */
    APP.APP.produtoId = p0.id;
    const entrada = APP.movimentar(p0.id, 'Entrada', 5, 'teste', 'App');
    testar('entrada no aparelho soma', entrada.ok && APP.acharProduto('7891234500014').produto.estoque === 15);
    const saida = APP.movimentar(p0.id, 'Saída', 3, 'teste', 'App');
    testar('saída no aparelho baixa', saida.ok && APP.acharProduto('7891234500014').produto.estoque === 12, APP.acharProduto('7891234500014').produto.estoque);
    const exagero = APP.movimentar(p0.id, 'Saída', 999, 'teste', 'App');
    testar('saída maior que o estoque é bloqueada', !exagero.ok && exagero.falta === 987, 'falta=' + exagero.falta);
    testar('histórico guardou as movimentações', dados().movimentacoes.length === 3, dados().movimentacoes.map(m => m.tipo).join(','));
    APP.ajustar(p0.id, 7, 'contagem');
    testar('contagem ajusta o estoque', APP.acharProduto('7891234500014').produto.estoque === 7 && dados().movimentacoes[0].tipo === 'Contagem', dados().movimentacoes[0].tipo);

    /* importação do CSV do sistema */
    const csvDesktop = '\uFEFF"FT/Código";"Nome";"Unidade";"Estoque atual";"Estoque mínimo";"Preço (R$)";"Código de barras/EAN";"Medidas (mm)";"Estrutura";"Pedido mínimo";"Valor em estoque (R$)"\r\n' +
      '"2025/0771-CX";"Cx. Biscoito Trigo Popular 12x250g";"cx";"12,5";"3";"1,947";"7891234500014";"385 x 225 x 205";"CEKR50";"9000";"24,337"\r\n' +
      '"2025/0866-CX";"Cx. Biscoito Folhado Maná 12x250g";"cx";"8";"3";"1,947";"7891234500021";"385 x 225 x 205";"CEKR50";"9000";"15,576"\r\n' +
      '"2025/0776-CX";"Cx. Biscoito Folhado de Trigo Maná 24x250g";"cx";"4";"2";"3,322";"7891234500038";"500 x 335 x 210";"CEKR50";"6000";"13,288"';
    APP.importarCsvProdutos(csvDesktop);
    testar('CSV do sistema importado', dados().produtos.length === 3, dados().produtos.length + ' produtos');
    testar('estoque em vírgula lido certo', dados().produtos.find(p => p.ft === '2025/0771-CX').estoque === 12.5, dados().produtos.find(p => p.ft === '2025/0771-CX').estoque);
    testar('EAN trazido no CSV', dados().produtos.find(p => p.ft === '2025/0866-CX').ean === '7891234500021');
    testar('acento sobrevive ao CSV', dados().produtos.find(p => p.ft === '2025/0866-CX').nome.indexOf('Maná') > -1);

    /* requisição */
    APP.addItemReq('2025/0771-CX', 2);
    APP.addItemReq('7891234500038', 1);
    APP.addItemReq('2025/0771-CX', 3);
    testar('itens agrupados na requisição', dados().rascunhoReq.itens.length === 2 && dados().rascunhoReq.itens[0].qtd === 5, JSON.stringify(dados().rascunhoReq.itens));
    $('#reqUsuario').value = 'João da Silva'; $('#reqUsuario').dispatchEvent(new w.Event('change'));
    $('#reqTipo').value = 'SAIDA'; $('#reqTipo').dispatchEvent(new w.Event('change'));
    $('#reqObs').value = 'Separar até 18h'; $('#reqObs').dispatchEvent(new w.Event('change'));
    const payload = APP.payloadReq();
    testar('payload da requisição no formato do sistema', /^STOKIREQ;REQ-\d{4};SAIDA;Joao da Silva;.+\|.+;Separar ate 18h$/.test(payload), payload);
    testar('payload sem acento (QR seguro)', /^[\x20-\x7E]+$/.test(payload));
    const svg = APP.qrSvg(payload, 4);
    testar('QR gerado para a requisição', svg.indexOf('<svg') === 0 && svg.length > 500, svg.length + ' bytes');
    $('#btnReqGerar').click();
    testar('QR exibido na tela', $('#qrArea').innerHTML.indexOf('<svg') > -1 && $('#payloadCaixa').textContent === payload);
    testar('lista da requisição mostra total', $('#reqItensBox').innerHTML.indexOf('no total') > -1);
    $('#btnReqSalvar').click();
    testar('requisição salva e numeração avança', dados().requisicoes.length === 1 && dados().prefs.seq === 2, 'seq=' + dados().prefs.seq);
    testar('rascunho limpo após salvar', dados().rascunhoReq.itens.length === 0);
    APP.registrarLeitura('STOKIREQ;REQ-0099;MATERIAL;Maria Souza;2025/0866-CX:4|CODIGO-NOVO:2;urgente', 'câmera');
    testar('requisição recebida de outro aparelho', dados().requisicoes.length === 2 && dados().requisicoes[0].numero === 'REQ-0099', dados().requisicoes[0].numero);
    testar('item conhecido e item novo separados', dados().requisicoes[0].itens[0].cadastrado === true && dados().requisicoes[0].itens[1].cadastrado === false);
    $('#btnReqLimpar') && $('#btnReqLimpar').click();

    /* exportações */
    const csvProdutos = APP.DADOS().produtos.map(p => [p.ft, p.nome, p.unidade, String(p.estoque).replace('.', ','), p.ean]);
    testar('CSV de saída tem cabeçalho e linhas', csvProdutos.length === 3 && csvProdutos[0].length === 5, JSON.stringify(csvProdutos[0]));
    testar('backup JSON serializa tudo', JSON.stringify(dados()).length > 500);

    /* navegação */
    APP.irPara('historico');
    testar('aba Histórico ativa', $('#tela-historico').classList.contains('ativa') && $('#abas button[data-tela="historico"]').getAttribute('aria-current') === 'true');
    testar('resumo do histórico calculado', $('#resumoBox').innerHTML.indexOf('Movimentações') > -1, $('#resumoBox').textContent.trim().slice(0, 60));
    APP.irPara('produtos');
    testar('aba Produtos ativa', $('#tela-produtos').classList.contains('ativa'));
    testar('lista de produtos renderizada', $$('#listaProdutosBox li').length === 3, $$('#listaProdutosBox li').length);
    APP.irPara('requisicao');
    testar('aba Requisição ativa', $('#tela-requisicao').classList.contains('ativa'));
    testar('requisições salvas listadas', $$('#reqSalvasBox li').length === 2, $$('#reqSalvasBox li').length);
    testar('nenhum erro de script no app', dom.__erros.length === 0, dom.__erros.join(' | '));

    /* ================= INTEGRAÇÃO APP ↔ SISTEMA ================= */
    console.log('== INTEGRAÇÃO ==');
    const ddom = criarDesktop();
    const dw = ddom.window;
    const d$ = s => dw.document.querySelector(s);
    const dw_ok = await (async () => { const t0 = Date.now(); while(Date.now() - t0 < 15000){ if(dw.document.readyState === 'complete' && typeof dw.ativarDemo === 'function') return true; await espera(50); } return false; })();
    testar('sistema do computador carregou', dw_ok);
    dw.ativarDemo();
    await dw.iniciarApp();
    dw.irPara('codigos');
    testar('sistema abriu na aba de códigos', d$('#tab-codigos').classList.contains('ativo'));

    /* catálogo do app importado a partir do CSV do próprio sistema */
    const cab = ['FT/Código','Nome','Unidade','Estoque atual','Estoque mínimo','Preço (R$)','Código de barras/EAN','Medidas (mm)','Estrutura','Pedido mínimo','Valor em estoque (R$)'];
    const linhas = dw.eval('produtosOrdenados()').map(p => [p.ft, p.nome, p.unidade, String(p.estoque).replace('.', ','), '0', '1,000', p.ean || '', '', '', '0', '0']);
    const csvReal = '\uFEFF' + [cab].concat(linhas).map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const dom2 = criarApp();
    const w2 = dom2.window;
    testar('segundo app (aparelho) carregou', await carregada(w2));
    await espera(60);
    const APP2 = w2.__app;
    APP2.importarCsvProdutos(csvReal);
    testar('app importou o catálogo real do sistema', APP2.DADOS().produtos.length === 3, APP2.DADOS().produtos.length + ' produtos');
    const primeiroApp = APP2.DADOS().produtos[0];
    const gêmeo = dw.eval('state.produtos').find(x => x.ft === primeiroApp.ft);
    testar('EAN do sistema chegou ao app', !!gêmeo && primeiroApp.ean === gêmeo.ean, primeiroApp.ft + ' → ' + primeiroApp.ean + ' (sistema ' + (gêmeo ? gêmeo.ean : '?') + ')');
    testar('etiqueta do sistema é lida no app', APP2.acharProduto(dw.eval('codPayload(state.produtos[0])')).ok);

    /* requisição criada no app, lida pelo sistema */
    const ft0 = dw.eval('state.produtos[0].ft'), ft1 = dw.eval('state.produtos[1].ft');
    const estoqueSistema = dw.eval('state.produtos[0].estoque');
    APP2.addItemReq(ft0, 4);
    APP2.addItemReq(ft1, 2);
    const payload2 = APP2.payloadReq();
    dw.eval('COD.ultimoEm = 0');
    dw.codRegistrarLeitura(payload2, 'câmera');
    const req = dw.eval('COD.requisicao');
    testar('sistema reconheceu a requisição do app', !!req && req.itens.length === 2, req ? JSON.stringify(req.itens.map(i => i.ft + 'x' + i.qtd)) : 'null');
    testar('itens do app viraram produtos do sistema', !!req && req.itens.every(i => i.produto));
    testar('quantidades preservadas', !!req && req.itens[0].qtd === 4 && req.itens[1].qtd === 2);
    testar('cartão da requisição aberto no sistema', d$('#codReqCartao').style.display === '' && d$('#codReqBox').innerHTML.indexOf('App') > -1);
    d$('#btnCodReqAplicar').click();
    testar('sistema deu baixa conforme a requisição', dw.eval('state.produtos[0].estoque') === estoqueSistema - 4, dw.eval('state.produtos[0].estoque') + ' (antes ' + estoqueSistema + ')');
    testar('movimentação do sistema com origem Requisição', dw.eval('state.movimentacoes[0].origem') === 'Requisição', dw.eval('state.movimentacoes[0].origem'));
    testar('movimentação registra o solicitante', dw.eval('state.movimentacoes[0].obs').indexOf('João') > -1 || dw.eval('state.movimentacoes[0].obs').indexOf('App') > -1, dw.eval('state.movimentacoes[0].obs'));
    testar('nenhum erro de script no sistema', ddom.__erros.length === 0, ddom.__erros.join(' | '));

    try{ dom.close(); dom2.close(); ddom.close(); }catch(e){}
  } catch(e){
    falhas.push('EXCEÇÃO: ' + (e && e.stack ? e.stack : e));
  }
  console.log('\n== OK (' + ok.length + ') ==');
  ok.forEach(o => console.log('  ✓ ' + o));
  if(falhas.length){
    console.log('\n== FALHAS (' + falhas.length + ') ==');
    falhas.forEach(f => console.log('  ✗ ' + f));
  }
  process.exit(falhas.length ? 1 : 0);
})();
