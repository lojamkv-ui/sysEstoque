/* Bateria de testes do Stoki SDY.
   Uso, da raiz do repositório:   node testes/04-origem-movimentacoes.js
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
const fs = require('fs');
const html = fs.readFileSync(CAMINHO_DESKTOP, 'utf8');
const erros = [];
const capturado = {};
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://loja.github.io/x/',
  beforeParse(w){
    w.URL.createObjectURL = b => (capturado.blob = b, 'blob:x');
    w.URL.revokeObjectURL = () => {};
    w.print = () => {};
    w.HTMLAnchorElement.prototype.click = function(){};
    w.addEventListener('error', e => erros.push(e.message));
  }
});
const w = dom.window;
const $ = s => w.document.querySelector(s);
const $$ = s => Array.from(w.document.querySelectorAll(s));
setTimeout(async () => {
  const ok = [], falhas = [];
  const testar = (n, c, e) => (c ? ok : falhas).push(n + (e ? ' → ' + e : ''));
  try {
    w.ativarDemo();
    await w.iniciarApp();

    /* 1. movimentação manual pela interface ganha origem + operador */
    $('#mProduto').value = w.eval('state.produtos[0].id');
    $('#mTipo').querySelector('button[data-tipo="Entrada"]').click();
    $('#mQtd').value = '25';
    $('#mObs').value = 'conferência de inventário';
    $('#formMov').dispatchEvent(new w.Event('submit', {cancelable:true, bubbles:true}));
    const mov = w.eval('state.movimentacoes[0]');
    testar('movimentação manual registrada', mov && mov.tipo === 'Entrada' && mov.quantidade === 25, JSON.stringify({tipo:mov && mov.tipo, q:mov && mov.quantidade}));
    testar('origem automática = Manual', mov.origem === 'Manual', mov.origem);
    testar('operador preenchido', mov.operador === 'Usuário Demo', mov.operador);
    testar('data/hora ISO presente', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(mov.data || ''), mov.data);

    /* 2. ajuste */
    $('#mTipo').querySelector('button[data-tipo="Ajuste"]').click();
    $('#mQtd').value = '777';
    $('#formMov').dispatchEvent(new w.Event('submit', {cancelable:true, bubbles:true}));
    const aj = w.eval('state.movimentacoes[0]');
    testar('ajuste registrado com origem Ajuste', aj.tipo === 'Ajuste' && aj.origem === 'Ajuste', aj.tipo + '/' + aj.origem);

    /* 3. cadastro de produto com quantidade inicial */
    $('#pFt').value = '2026/0001-CX';
    $('#pNome').value = 'Cx. Teste Relatório 12x100g';
    $('#pQtdInicial').value = '50';
    $('#pPreco').value = '2,50';
    $('#formProduto').dispatchEvent(new w.Event('submit', {cancelable:true, bubbles:true}));
    const movSel = w.eval("state.movimentacoes[0]");
    testar('entrada inicial com origem própria', movSel.origem === 'Cadastro inicial', movSel.origem + ' / ' + movSel.tipo);

    /* 4. persistência na nuvem: campos extras (origem/operador) sobrevivem ao mapeamento */
    const linha = w.eval("paraLinha(ENTIDADES.movimentacoes, state.movimentacoes[0])");
    testar('origem/operador vão para a coluna extra (jsonb)', linha.extra && linha.extra.origem === 'Cadastro inicial' && linha.extra.operador === 'Usuário Demo',
      JSON.stringify(linha.extra));
    linha.coluna_inexistente = 'x';
    const volta = w.eval("(function(row){ return deLinha(ENTIDADES.movimentacoes, row); })")(linha);
    testar('extra volta ao ler do banco', volta.origem === 'Cadastro inicial' && volta.operador === 'Usuário Demo', JSON.stringify({o:volta.origem, u:volta.operador}));
    testar('campos conhecidos preservados', volta.tipo === 'Entrada' && volta.quantidade === 50 && !!volta.data, JSON.stringify({t:volta.tipo, q:volta.quantidade}));

    /* 5. relatório em modo não-demo (dados do localStorage) */
    w.eval(`
      Auth.demo = false;
      Auth.perfil = {id:'u1', nome:'Ana Prado', perfil:'administrador'};
      state.produtos = [{id:'p1', ft:'FT-1', nome:'Produto Um', unidade:'cx', estoque:80, minimo:10, preco:3.5}];
      state.movimentacoes = [
        {id:'m1', data:'2026-03-01T10:00:00.000Z', produtoId:'p1', ft:'FT-1', nome:'Produto Um', unidade:'cx', tipo:'Entrada', quantidade:100, antes:0, depois:100, obs:'Entrada manual', origem:'Manual', operador:'Ana Prado'},
        {id:'m2', data:'2026-03-02T15:30:00.000Z', produtoId:'p1', ft:'FT-1', nome:'Produto Um', unidade:'cx', tipo:'Saída', quantidade:20, antes:100, depois:80, obs:'Saída — Carga nº 0002 · destino CD Norte', origem:'Carregamento', operador:'Ana Prado'}
      ];
      salvar(true); renderTudo(); irPara('relatorios');
    `);
    testar('relatório com dados próprios', $('#rkMov').textContent === '2', $('#rkMov').textContent);
    testar('linha mostra data e hora', /^\d{2}\/\d{2}\/\d{4}$/.test($$('#relTbodyMov tr')[0].children[0].textContent) && /^\d{2}:\d{2}:\d{2}$/.test($$('#relTbodyMov tr')[0].children[1].textContent),
      $$('#relTbodyMov tr')[0].children[0].textContent + ' ' + $$('#relTbodyMov tr')[0].children[1].textContent);
    testar('usuário do registro exibido', $$('#relTbodyMov tr')[0].children[10].textContent === 'Ana Prado', $$('#relTbodyMov tr')[0].children[10].textContent);
    /* filtro por hora */
    $('#rfDe').value = '2026-03-02'; $('#rfAte').value = '2026-03-02'; w.renderRelatorios();
    testar('filtro por dia', $('#rkMov').textContent === '1', $('#rkMov').textContent);
    $('#rfDeHora').value = '16:00'; w.renderRelatorios();
    testar('filtro por hora inicial', $('#rkMov').textContent === '0', $('#rkMov').textContent);
    $('#rfDeHora').value = '15:00'; w.renderRelatorios();
    testar('filtro por hora incluindo o registro', $('#rkMov').textContent === '1', $('#rkMov').textContent);
    $('#btnRelLimpar').click();
    testar('sem erro de script', erros.length === 0, erros.join(' | '));
  } catch(e){
    falhas.push('EXCEÇÃO: ' + (e && e.stack ? e.stack : e));
  }
  console.log('\n== OK (' + ok.length + ') =='); ok.forEach(o => console.log('  ✓ ' + o));
  if(falhas.length){ console.log('\n== FALHAS (' + falhas.length + ') =='); falhas.forEach(f => console.log('  ✗ ' + f)); process.exitCode = 1; }
  w.close();
}, 300);
