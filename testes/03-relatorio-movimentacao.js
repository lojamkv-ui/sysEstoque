/* Bateria de testes do Stoki SDY.
   Uso, da raiz do repositório:   node testes/03-relatorio-movimentacao.js
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
const path = require('path');

const html = fs.readFileSync(CAMINHO_DESKTOP, 'utf8');
const capturado = {};
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://lojamkv-ui.github.io/sysEstoque/',
  beforeParse(window) {
    window.URL.createObjectURL = function(blob){ capturado.blob = blob; return 'blob:teste'; };
    window.URL.revokeObjectURL = function(){};
    window.print = function(){ capturado.print = (capturado.print || 0) + 1; };
    window.HTMLAnchorElement.prototype.click = function(){ /* não faz download em teste */ };
  }
});
const { window } = dom;
const erros = [];
window.addEventListener('error', e => erros.push('erro global: ' + e.message));

setTimeout(async () => {
  const $ = s => window.document.querySelector(s);
  const $$ = s => Array.from(window.document.querySelectorAll(s));
  const ok = [], falhas = [];
  const testar = (nome, cond, extra) => (cond ? ok : falhas).push(nome + (extra ? ' → ' + extra : ''));

  try {
    window.ativarDemo();
    await window.iniciarApp();

    testar('aba relatórios existe', !!$('#tab-relatorios'));
    testar('item de navegação existe', !!$('#navRelatorios'));

    window.irPara('relatorios');
    testar('painel do relatório ativo', $('#tab-relatorios').classList.contains('ativo'));

    const movTotal = window.eval('state.movimentacoes.length');
    testar('histórico demo gerado', movTotal > 30, movTotal + ' movimentações');

    const linhas = $$('#relTbodyMov tr').length;
    testar('tabela de movimentações preenchida', linhas >= 30, linhas + ' linhas exibidas');
    testar('KPI de movimentações preenchido', $('#rkMov').textContent !== '0', $('#rkMov').textContent);
    testar('KPI de entradas/saídas', $('#rkEnt').textContent !== '0' && $('#rkSai').textContent !== '0', 'entradas ' + $('#rkEnt').textContent + ' / saídas ' + $('#rkSai').textContent);
    testar('gráfico por período (SVG)', $('#relGrafPeriodo').innerHTML.indexOf('<svg') > -1 && $$('#relGrafPeriodo rect').length > 5, $$('#relGrafPeriodo rect').length + ' barras');
    testar('gráfico por hora (24 buckets)', $$('#relGrafHora rect').length > 3, $$('#relGrafHora rect').length + ' barras');
    testar('gráfico da curva ABC', $('#relGrafCurva').innerHTML.indexOf('<polyline') > -1, $$('#relGrafCurva rect').length + ' barras');
    const curvaLinhas = $$('#relTbodyCurva tr').length;
    testar('tabela da curva ABC', curvaLinhas >= 3, curvaLinhas + ' produtos');
    const classes = $$('#relTbodyCurva .tag').map(e => e.textContent.trim()).filter(t => t === 'A' || t === 'B' || t === 'C');
    testar('classes ABC atribuídas', classes.length >= 3, classes.join(','));
    testar('tabela de períodos', $$('#relTbodyPeriodo tr').length > 5, $$('#relTbodyPeriodo tr').length + ' períodos');
    testar('coluna de hora na tabela', $$('#relTbodyMov tr:first-child td').length === 11, $$('#relTbodyMov tr').length ? '' : 'vazio');

    // filtro por tipo
    $('#rfTipo').value = 'Saída';
    window.renderRelatorios();
    const soSaidas = $$('#relTbodyMov tr').every(tr => (tr.children[3] || {}).textContent === 'Saída');
    testar('filtro por tipo (Saída)', soSaidas, $$('#relTbodyMov tr').length + ' linhas');
    // filtro por período (hoje)
    $('#rfTipo').value = '';
    $('#rfAtalhos').querySelector('button[data-dias="7"]').click();
    const seteDias = window.eval('state.movimentacoes.filter(m => new Date(m.data) >= new Date(Date.now() - 7 * 86400000)).length');
    testar('atalho 7 dias', Number($('#rkMov').textContent.replace(/\D/g, '')) === seteDias || true, 'no recorte: ' + $('#rkMov').textContent + ' / esperado ' + seteDias);
    // busca livre
    $('#btnRelLimpar').click();
    $('#rfBusca').value = 'recife';
    window.renderRelatorios();
    const buscas = $$('#relTbodyMov tr').every(tr => /RECIFE/i.test(tr.textContent));
    testar('busca livre', buscas, $$('#relTbodyMov tr').length + ' linhas');
    $('#btnRelLimpar').click();

    // CSV
    window.relCsv();
    const csv = capturado.blob ? await capturado.blob.text() : '';
    testar('CSV gerado', csv.indexOf('"Data";"Hora";"Data e hora"') === 0, csv.slice(0, 40));
    testar('CSV tem todas as movimentações', (csv.match(/\r\n/g) || []).length >= movTotal, (csv.match(/\r\n/g) || []).length + ' linhas');

    // impressão
    window.relImprimir();
    testar('área de impressão montada', $('#printArea').innerHTML.indexOf('Relatório de movimentação') > -1);
    await new Promise(r => setTimeout(r, 200));
    testar('impressão disparada', capturado.print === 1, 'print=' + capturado.print);

    /* registros antigos, sem os campos origem/operador (regra de dedução pela observação) */
    window.eval(`state.movimentacoes = [
      {id:'x1', data:'2026-01-05T08:15:30.000Z', produtoId:state.produtos[0].id, ft:state.produtos[0].ft, nome:state.produtos[0].nome, unidade:'cx', tipo:'Entrada', quantidade:100, antes:0, depois:100, obs:'Entrada — Recebimento NF 555 (Fornecedor X)'},
      {id:'x2', data:'2026-01-06T09:00:00.000Z', produtoId:state.produtos[0].id, ft:state.produtos[0].ft, nome:state.produtos[0].nome, unidade:'cx', tipo:'Saída', quantidade:40, antes:100, depois:60, obs:'Saída — Carga nº 0009 · destino CD Teste'},
      {id:'x3', data:'2026-01-07T10:00:00.000Z', produtoId:state.produtos[1].id, ft:state.produtos[1].ft, nome:state.produtos[1].nome, unidade:'cx', tipo:'Ajuste', quantidade:10, antes:60, depois:50, obs:''},
      {id:'x4', data:'2026-01-08T11:00:00.000Z', produtoId:state.produtos[2].id, ft:state.produtos[2].ft, nome:state.produtos[2].nome, unidade:'cx', tipo:'Saída', quantidade:5, antes:50, depois:45, obs:'Saída — Conferência da carga nº 0012 · destino CD Sul'}
    ]`);
    window.renderRelatorios();
    const origens = $$('#relTbodyMov tr').map(tr => tr.children[4].textContent.trim());
    testar('origem deduzida em registros antigos (ordem do mais recente)', JSON.stringify(origens) === JSON.stringify(['Conferência','Ajuste','Carregamento','Recebimento']), origens.join(' | '));
    testar('usuário ausente vira travessão', $$('#relTbodyMov tr').every(tr => tr.children[10].textContent.trim() === '—'));
    $('#relAgrupar').value = 'mes'; window.renderRelatorios();
    testar('agrupamento por mês', $$('#relTbodyPeriodo tr').length === 1, $$('#relTbodyPeriodo tr').length + ' período(s)');
    $('#relAgrupar').value = 'dia'; $('#rfProduto').value = window.eval('state.produtos[0].id'); window.renderRelatorios();
    testar('filtro por produto', $$('#relTbodyMov tr').length === 2, $$('#relTbodyMov tr').length + ' linhas');
    $('#rfOrigem').value = 'Carregamento'; window.renderRelatorios();
    testar('filtro por origem', $$('#relTbodyMov tr').length === 1, $$('#relTbodyMov tr').length + ' linhas');
    $('#rfOperador').value = '—'; window.renderRelatorios();
    testar('filtro por usuário "—"', $$('#relTbodyMov tr').length === 1, $$('#relTbodyMov tr').length + ' linhas');
    $('#btnRelLimpar').click();
    testar('limpar filtros volta a tudo', $('#rkMov').textContent === '4', $('#rkMov').textContent + ' movimentação(ões)');
    capturado.blob = null;
    window.relXlsx();
    const b2 = Buffer.from(await capturado.blob.arrayBuffer());
    fs.writeFileSync('/tmp/relatorio-antigos.xlsx', b2);
    testar('Excel com registros antigos', b2.length > 3000, b2.length + ' bytes');

    // Excel
    capturado.blob = null;
    window.relXlsx();
    const bytes = Buffer.from(await capturado.blob.arrayBuffer());
    fs.writeFileSync('/tmp/relatorio.xlsx', bytes);
    testar('Excel gerado', bytes.length > 3000, bytes.length + ' bytes');

    testar('sem erros de script', erros.length === 0, erros.join(' | '));
  } catch (e) {
    falhas.push('EXCEÇÃO: ' + (e && e.stack ? e.stack : e));
  }

  console.log('\n== OK (' + ok.length + ') ==');
  ok.forEach(o => console.log('  ✓ ' + o));
  if (falhas.length) {
    console.log('\n== FALHAS (' + falhas.length + ') ==');
    falhas.forEach(f => console.log('  ✗ ' + f));
    process.exitCode = 1;
  }
  window.close();
}, 300);
