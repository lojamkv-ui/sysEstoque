/* Bateria de testes do Stoki SDY.
   Uso, da raiz do repositório:   node testes/05-validacao-telas.js
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
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, url:'https://loja.github.io/x/',
  beforeParse(w){ w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL=()=>{}; w.print=()=>{}; w.HTMLAnchorElement.prototype.click=function(){}; w.addEventListener('error', e => erros.push(e.message)); }});
const w = dom.window;
setTimeout(async () => {
  const falhas = [], ok = [];
  try{
    w.ativarDemo();
    await w.iniciarApp();
    for(const aba of ['produtos','estoque','cargas','receber','conferir','codigos','relatorios']){
      w.irPara(aba);
      const ativo = w.document.querySelector('#tab-' + aba);
      const visivel = ativo && ativo.classList.contains('ativo') && ativo.getAttribute('aria-hidden') === 'false';
      (visivel ? ok : falhas).push('aba ' + aba + (visivel ? ' ok' : ' NÃO ativou'));
      const outros = Array.from(w.document.querySelectorAll('.painel.ativo')).length;
      if(outros !== 1) falhas.push('aba ' + aba + ': ' + outros + ' painéis ativos');
    }
    /* a aba Usuários é exclusiva do administrador — no acesso demo ela fica escondida */
    /* o bloco de administração (Usuários + Restaurar) fica escondido para o conferente do Demo */
    const bloqueado = w.document.querySelector('#navAdmin').style.display === 'none';
    (bloqueado && w.eval("pode('usuarios')") === false ? ok : falhas).push('administração escondida para quem não é administrador');
    (w.eval("pode('produtos.editar')") === w.eval('CONFERENTE_EDITA_PRODUTOS') ? ok : falhas).push('edição de produtos segue CONFERENTE_EDITA_PRODUTOS');
    /* a aba de conferência por QR Code / EAN precisa existir e abrir */
    const tabCod = w.document.querySelector('#tab-codigos');
    (tabCod ? ok : falhas).push('aba de conferência por QR Code / EAN presente');
    // comandos extras que dependem das novas funções
    w.document.querySelector('#btnRelTopo').click();
    falhas.push(...[]);
    (w.document.querySelector('#navRelatorios').getAttribute('aria-current') === 'page' ? ok : falhas).push('botão do topo abre o relatório');
    const cnt = w.document.querySelector('#cntRel').textContent;
    (Number(cnt) > 30 ? ok : falhas).push('contador do menu = ' + cnt);
    (erros.length === 0 ? ok : falhas).push('erros de script: ' + (erros.join(' | ') || 'nenhum'));
  }catch(e){ falhas.push('EXCEÇÃO: ' + (e.stack || e)); }
  console.log('\n== OK (' + ok.length + ') =='); ok.forEach(o=>console.log('  ✓ ' + o));
  if(falhas.length){ console.log('\n== FALHAS (' + falhas.length + ') =='); falhas.forEach(f=>console.log('  ✗ ' + f)); }
  process.exit(falhas.length ? 1 : 0);
  w.close();
}, 300);
