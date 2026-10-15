/* Bateria de testes do Stoki SDY.
   Uso, da raiz do repositório:   node testes/01-conferencia-codigos.js
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

/* padrões de módulos (barras) esperados, conferidos com a biblioteca python-barcode */
const PADROES_BARRAS = {
  "789123450001": "10101101110010111001100100110110111101001110101010100111011100101110010111001011001101011100101",
  "590123412345": "10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101",
  "400638133393": "10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101"
};
const html = fs.readFileSync(CAMINHO_DESKTOP, 'utf8');
const capturado = {};
const erros = [];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  url: URL_DESKTOP,
  beforeParse(w) {
    w.URL.createObjectURL = b => (capturado.blob = b, 'blob:teste');
    w.URL.revokeObjectURL = () => {};
    w.print = () => { capturado.print = (capturado.print || 0) + 1; };
    w.HTMLAnchorElement.prototype.click = function() {};
    w.addEventListener('error', e => erros.push('erro global: ' + e.message));
  }
});
const w = dom.window;
const $ = s => w.document.querySelector(s);
const $$ = s => Array.from(w.document.querySelectorAll(s));
const ok = [], falhas = [];
const testar = (nome, cond, extra) => (cond ? ok : falhas).push(nome + (extra !== undefined ? ' → ' + extra : ''));
const espera = ms => new Promise(r => setTimeout(r, ms));
/* extrai o padrão de módulos (barras) de um SVG gerado por codBarrasSvg */
function bitsDoSvg(svg) {
  const bits = new Array(95).fill('0');
  const re = /<rect x="(\d+)" y="0" width="(\d+)" height="\d+" fill="#000"\/>/g;
  let m;
  while ((m = re.exec(svg))) {
    const x = Number(m[1]), largura = Number(m[2]);
    for (let k = 0; k < largura; k++) bits[x + k] = '1';
  }
  return bits.join('');
}

w.addEventListener('load', async () => {
  try {
    testar('biblioteca html5-qrcode carregada', typeof w.Html5Qrcode === 'function', typeof w.Html5Qrcode);
    testar('biblioteca qrcode-generator carregada', typeof w.qrcode === 'function', typeof w.qrcode);

    w.ativarDemo();
    await w.iniciarApp();

    /* ---------- navegação ---------- */
    w.irPara('codigos');
    testar('painel de códigos ativo', $('#tab-codigos').classList.contains('ativo'));
    testar('produtos semente têm EAN', w.eval('state.produtos.filter(p => p.ean).length') === 3, w.eval('state.produtos.map(p => p.ean).join(",")'));
    testar('contador do menu mostra produtos com EAN', $('#cntEan').textContent === '3', $('#cntEan').textContent);

    /* ---------- busca por código em vários formatos ---------- */
    const p0 = w.eval('state.produtos[0]');
    const casos = [
      ['EAN direto', p0.ean],
      ['EAN com espaços', '789 1234 50001 4'],
      ['FT/Código', p0.ft],
      ['URL com ?ean=', 'https://loja.github.io/sysEstoque/Sistema-Estoque.html?ean=' + p0.ean],
      ['URL com &codigo=', 'https://exemplo.com/ver?loja=1&codigo=' + p0.ft],
      ['etiqueta STOKI;EAN;FT', 'STOKI;' + p0.ean + ';' + p0.ft],
      ['etiqueta sem EAN', 'STOKI;-;' + p0.ft],
      ['minúsculas com prefixo', 'stoki;' + p0.ean],
      ['ID interno', p0.id],
      ['texto ao redor', 'SKU: ' + p0.ean + ' lote 3']
    ];
    casos.forEach(([nome, entrada]) => {
      const r = w.codBuscarProduto(entrada);
      testar('busca — ' + nome, r.ok && r.produto.id === p0.id, r.ok ? r.campo : (r.msg || ''));
    });
    const semAcha = w.codBuscarProduto('7899999999999');
    testar('código desconhecido não encontra', !semAcha.ok && semAcha.codigo === '7899999999999', semAcha.codigo);

    /* ---------- dígito verificador e código de barras ---------- */
    testar('EAN válido reconhecido', w.codEanValido('7891234500014') && w.codEanValido('7891234500038'));
    testar('EAN inválido rejeitado', !w.codEanValido('7891234500015') && !w.codEanValido('123'));
    testar('EAN-8 e UPC-A aceitos', w.codEanValido('96385074') && w.codEanValido('036000291452'), 'EAN-8 96385074 / UPC-A 036000291452');
    const svgInvalido = w.codBarrasSvg('12345');
    testar('código de barras recusa EAN inválido', svgInvalido === '', JSON.stringify(svgInvalido));
    /* comparação com implementação independente (python-barcode) */
    [['789123450001', '7891234500014'], ['590123412345', '5901234123457'], ['400638133393', '4006381333931']].forEach(([base, completo]) => {
      const svg = w.codBarrasSvg(completo, 40);
      testar('EAN-13 ' + completo + ' tem dígito verificador correto', String(w.codEanDigitoVerificador(base)) === completo.slice(12), completo.slice(12));
      const esperado = PADROES_BARRAS[base];
      testar('padrão de barras igual ao python-barcode (' + completo + ')', bitsDoSvg(svg) === esperado, bitsDoSvg(svg).slice(0, 24) + ' vs ' + esperado.slice(0, 24));
    });

    /* ---------- QR Code e etiquetas ---------- */
    const payload = w.codPayload(p0);
    testar('conteúdo da etiqueta', payload === 'STOKI;' + p0.ean + ';' + p0.ft, payload);
    testar('payload volta a encontrar o produto', (() => { const r = w.codBuscarProduto(payload); return r.ok && r.produto.id === p0.id; })());
    const qr = w.codQrSvg(payload, 4);
    testar('QR gerado em SVG', qr.indexOf('<svg') === 0 && qr.length > 400, qr.length + ' bytes');
    const grade = $('#codEtiquetasGrade');
    testar('etiquetas renderizadas', $$('#codEtiquetasGrade .etiqueta').length === 3, $$('#codEtiquetasGrade .etiqueta').length + ' etiquetas');
    testar('etiqueta tem QR e código de barras', grade.innerHTML.indexOf('et-qr') > -1 && grade.innerHTML.indexOf('et-barra') > -1);
    w.codImprimirEtiquetas();
    await espera(120);
    testar('impressão de etiquetas montada', $('#printArea').innerHTML.indexOf('Etiquetas de produto') > -1 && $('#printArea').innerHTML.indexOf('et-barra') > -1);
    testar('impressão disparada', capturado.print === 1, 'print=' + capturado.print);

    /* ---------- leitura: produto encontrado, não encontrado, eco ---------- */
    w.codRegistrarLeitura(p0.ean, 'câmera');
    testar('leitura registrada na sessão', w.eval('COD.sessao.leituras.length') === 1, w.eval('COD.sessao.leituras.length'));
    testar('card do produto lido', $('#codProdutoBox').innerHTML.indexOf(p0.ft) > -1 && $('#codProdutoBox').innerHTML.indexOf('Entrada rápida') > -1);
    testar('tabela da sessão com hora', $$('#codSessaoTbody tr').length === 1 && /^\d{2}:\d{2}:\d{2}$/.test($$('#codSessaoTbody tr')[0].children[0].textContent), $$('#codSessaoTbody tr')[0].children[0].textContent);
    w.codAoLer(p0.ean); /* eco imediato da câmera (mesma leitura na sequência) */
    testar('leitura repetida ignorada (eco)', w.eval('COD.sessao.leituras.length') === 1 && w.eval('COD.ecos') === 1, 'ecos=' + w.eval('COD.ecos'));
    w.codRegistrarLeitura('7890000000000', 'câmera');
    w.eval('COD.ultimoEm = 0');
    w.codRegistrarLeitura(p0.ean, 'digitado');
    testar('digitação do mesmo código soma de novo (sem eco)', w.eval('COD.sessao.leituras.length') === 2, w.eval('COD.sessao.leituras.length'));
    w.codRegistrarLeitura('7890000000000', 'câmera');
    testar('produto não encontrado', w.eval('COD.naoEncontrado') === '7890000000000' && $('#codProdutoBox').innerHTML.indexOf('Cadastrar produto com este código') > -1);
    $('#btnCodCadastrar').click();
    testar('cadastro pré-preenchido com o EAN lido', $('#pEan').value === '7890000000000' && $('#tab-produtos').classList.contains('ativo'), $('#pEan').value);
    w.irPara('codigos');

    /* ---------- modo contagem ---------- */
    $('#codModo').value = 'contagem';
    $('#codQtdLeitura').value = '3';
    $$('#codSessaoTbody tr').length; /* noop */
    w.eval('COD.sessao = {inicio:null, leituras:[], contagem:new Map()}; COD.ecos = 0;');
    $('#btnCodManual').click();
    w.codRegistrarLeitura(p0.ean, 'câmera');
    w.codRegistrarLeitura(p0.ean, 'câmera'); /* dentro de 2,5s → eco, não soma */
    testar('eco não soma duas vezes', w.eval('COD.sessao.contagem.get(state.produtos[0].id)') === 3, w.eval('COD.sessao.contagem.get(state.produtos[0].id)'));
    w.eval('COD.ultimoEm = 0'); /* simula tempo passado */
    w.codRegistrarLeitura(p0.ean, 'câmera');
    testar('nova leitura soma de novo', w.eval('COD.sessao.contagem.get(state.produtos[0].id)') === 6, w.eval('COD.sessao.contagem.get(state.produtos[0].id)'));
    const p1 = w.eval('state.produtos[1]');
    w.eval('COD.ultimoEm = 0');
    w.codRegistrarLeitura(p1.ean, 'câmera');
    testar('dois produtos contados', w.eval('COD.sessao.contagem.size') === 2, w.eval('COD.sessao.contagem.size'));
    testar('divergências destacadas', $('#codSessaoBox').innerHTML.indexOf('Produtos com contagem diferente do estoque') > -1);
    const estoqueAntesP0 = w.eval('state.produtos[0].estoque');
    const movAntes = w.eval('state.movimentacoes.length');
    await (async () => {
      const promessa = w.codAplicarContagem();
      await espera(60);
      const sel = w.document.getElementById('codAplicarModo');
      sel.value = 'ajuste';
      sel.dispatchEvent(new w.Event('change'));
      w.document.querySelector('.modal-overlay [data-act="ok"]').click();
      await promessa;
    })();
    testar('contagem aplicada como ajuste', w.eval('state.produtos[0].estoque') === 6, w.eval('state.produtos[0].estoque') + ' (antes ' + estoqueAntesP0 + ')');
    testar('movimentação gerada com origem Leitura', w.eval('state.movimentacoes[0].origem') === 'Leitura' && w.eval('state.movimentacoes[0].tipo') === 'Ajuste', w.eval('state.movimentacoes[0].tipo + "/" + state.movimentacoes[0].origem'));
    testar('usuário gravado na movimentação', w.eval('state.movimentacoes[0].operador') === 'Usuário Demo', w.eval('state.movimentacoes[0].operador'));
    testar('relatório mostra a origem Leitura', (() => { w.relSelectsAssinatura = ''; w.irPara('relatorios'); $('#rfOrigem').value = 'Leitura'; w.renderRelatorios(); const n = $$('#relTbodyMov tr').length; w.irPara('codigos'); return n > 0; })(), 'linhas no relatório filtrado por Leitura');
    /* diferença em vez de ajuste */
    w.eval('COD.sessao = {inicio:null, leituras:[], contagem:new Map()}; COD.ultimoEm = 0;');
    $('#codModo').value = 'contagem';
    w.codRegistrarLeitura(p0.ean, 'câmera');
    const estoqueAgora = w.eval('state.produtos[0].estoque');
    await (async () => {
      const promessa = w.codAplicarContagem();
      await espera(60);
      const sel = w.document.getElementById('codAplicarModo');
      sel.value = 'diferenca';
      sel.dispatchEvent(new w.Event('change'));
      w.document.querySelector('.modal-overlay [data-act="ok"]').click();
      await promessa;
    })();
    testar('aplicação por diferença registra Saída', w.eval('state.movimentacoes[0].tipo') === 'Saída' && w.eval('state.movimentacoes[0].quantidade') === estoqueAgora - 3,
      w.eval('state.movimentacoes[0].tipo + " " + state.movimentacoes[0].quantidade'));

    /* ---------- Excel da sessão ---------- */
    capturado.blob = null;
    w.codSessaoXlsx();
    const xlsx = Buffer.from(await capturado.blob.arrayBuffer());
    fs.writeFileSync('/tmp/conferencia-codigos.xlsx', xlsx);
    testar('Excel da conferência gerado', xlsx.length > 3000, xlsx.length + ' bytes');

    /* ---------- integração com a conferência de carga ---------- */
    $('#codQtdLeitura').value = '1';
    w.eval("state.carregamentos = [{id:'cg1', numero:'0007', data:'2026-10-10', destino:'CD Norte', veiculo:'Truck · ABC1D23', motorista:'Ana', status:'Pendente', itens:[{produtoId:state.produtos[0].id, qtd:10, esperado:10, conferido:null}], criadoEm:agora()}]; state.rascunhoConferencia = null;");
    $('#codModo').value = 'carga';
    w.codRender();
    testar('seletor de carga aparece no modo carga', $('#wrapCodCarga').style.display !== 'none' && $('#codCarga').options.length === 1, $('#codCarga').innerHTML.slice(0, 60));
    $('#codCarga').value = 'cg1';
    w.eval('COD.ultimoEm = 0');
    w.codRegistrarLeitura(w.eval('state.produtos[0].ean'), 'câmera');
    const conf = w.eval('state.rascunhoConferencia');
    testar('leitura inicia a conferência da carga', !!conf && conf.carregamentoId === 'cg1', JSON.stringify(conf && conf.itens));
    testar('conferido somado no romaneio', conf && conf.itens[0].conferido === 1, conf && conf.itens[0].conferido);
    testar('código EAN salvo no item', conf && !!conf.itens[0].codigo, conf && conf.itens[0].codigo);
    w.eval('COD.ultimoEm = 0');
    w.codRegistrarLeitura(w.eval('state.produtos[1].ean'), 'câmera');
    testar('produto fora do romaneio é avisado', $('#codSessaoTbody').innerHTML.indexOf('não aplicado') > -1, '');
    testar('aba Conferir carga reflete o bipe', (() => { w.irPara('conferir'); const txt = $('#tbodyConf') ? $('#tbodyConf').textContent : ''; w.irPara('codigos'); return txt.indexOf('1') > -1; })());

    /* ---------- integração com o recebimento ---------- */
    w.eval("state.rascunhoRecebimento = {id:'rc1', nf:'NF 555', fornecedor:'Fornecedor X', inicio:agora(), data:hoje(), itens:[], seq:9};");
    $('#codModo').value = 'recebimento';
    w.codRender();
    w.eval('COD.ultimoEm = 0');
    w.codRegistrarLeitura(w.eval('state.produtos[2].ean'), 'câmera');
    const rec = w.eval('state.rascunhoRecebimento');
    testar('leitura cria linha no recebimento', rec.itens.length === 1 && rec.itens[0].conferido === 1, JSON.stringify(rec.itens));

    /* ---------- câmera: caminho de erro e caminho de sucesso (stub) ---------- */
    await w.codIniciarCamera();
    await espera(200);
    testar('câmera indisponível tratada sem exceção', w.eval('COD.rodando') === false && $('#codLeitorAviso').style.display !== 'none', $('#codLeitorAviso').textContent.slice(0, 60));
    testar('mensagem orienta usar foto/digitação', /Ler de uma foto|digite o código|Nenhuma câmera|Permissão/i.test($('#codLeitorAviso').textContent), '');
    /* stub da biblioteca para o caminho feliz */
    const chamadas = {start: 0, stop: 0, torce: 0};
    w.Html5Qrcode = function(id, opts){
      this.id = id; this.opts = opts;
      this.start = (cam, cfg, sucesso) => { chamadas.start++; this.sucesso = sucesso; this.cfg = cfg; return Promise.resolve(); };
      this.stop = () => { chamadas.stop++; return Promise.resolve(); };
      this.clear = () => {};
      this.getRunningTrackCameraCapabilities = () => ({torchFeature: () => ({isSupported: () => true, apply: () => { chamadas.torce++; }})});
    };
    w.Html5Qrcode.getCameras = () => Promise.resolve([{id: 'cam1', label: 'Camera traseira'}, {id: 'cam2', label: 'Camera frontal'}]);
    w.eval('COD.scanner = null; COD.cameras = [];');
    await w.codIniciarCamera();
    testar('câmera iniciada (stub)', w.eval('COD.rodando') === true && chamadas.start === 1, 'start=' + chamadas.start);
    testar('botões alternam', $('#btnCamDesligar').style.display === '' && $('#btnCamLigar').style.display === 'none');
    testar('status da câmera', $('#codTagStatus').textContent === 'câmera ligada', $('#codTagStatus').textContent);
    testar('lanterna detectada', $('#btnCodLuz').style.display === '', $('#btnCodLuz').style.display);
    $('#btnCodLuz').click();
    testar('lanterna acionada', chamadas.torce === 1, chamadas.torce);
    testar('qrbox e formatos configurados', typeof w.eval('COD.scanner.cfg.qrbox') === 'function' && w.eval('COD.scanner.opts.formatsToSupport.length') >= 10,
      w.eval('COD.scanner.opts.formatsToSupport.length') + ' formatos');
    /* simula a câmera encontrando o código do produto 1 */
    w.eval('COD.ultimoEm = 0');
    w.eval('COD.scanner.sucesso(state.produtos[1].ean)');
    testar('leitura simulada da câmera entra na sessão', w.eval('COD.sessao.leituras[0].via') === 'câmera' && w.eval('COD.sessao.leituras[0].codigo') === w.eval('state.produtos[1].ean'), w.eval('COD.sessao.leituras[0].via'));
    await w.codPararCamera(true);
    testar('câmera parada', w.eval('COD.rodando') === false && chamadas.stop === 1, 'stop=' + chamadas.stop);
    /* sair da aba desliga a câmera */
    w.eval('COD.scanner = null;');
    await w.codIniciarCamera();
    w.irPara('estoque');
    await espera(30);
    testar('sair da aba desliga a câmera', w.eval('COD.rodando') === false && $('#btnCamLigar').style.display === '');
    w.irPara('codigos');

    /* ---------- ações rápidas ---------- */
    w.eval('COD.ultimoEm = 0');
    w.codRegistrarLeitura(w.eval('state.produtos[0].ean'), 'câmera');
    const est0 = w.eval('state.produtos[0].estoque');
    const digitarQtd = v => { $('#codQtdRapida').value = String(v); $('#codQtdRapida').dispatchEvent(new w.Event('input')); };
    digitarQtd(5);
    $('#btnCodEntrada').click();
    testar('entrada rápida soma no estoque', w.eval('state.produtos[0].estoque') === est0 + 5, w.eval('state.produtos[0].estoque') + ' (antes ' + est0 + ')');
    digitarQtd(5);
    $('#btnCodSaida').click();
    testar('saída rápida devolve o estoque', w.eval('state.produtos[0].estoque') === est0, w.eval('state.produtos[0].estoque'));
    digitarQtd(9999);
    const movsAntes = w.eval('state.movimentacoes.length');
    $('#btnCodSaida').click();
    testar('saída maior que o estoque é bloqueada', w.eval('state.movimentacoes.length') === movsAntes && w.eval('state.produtos[0].estoque') === est0, w.eval('state.produtos[0].estoque'));
    digitarQtd(1);
    /* ---------- formatos de leitura e recuo do leitor nativo ---------- */
    const enumD = w.Html5QrcodeSupportedFormats;
    const formatosD = w.eval('codFormatos()');
    testar('formatos do sistema são os números do enum', Array.isArray(formatosD) && formatosD.length > 5 &&
      formatosD.every(x => typeof x === 'number') && formatosD.indexOf(enumD.EAN_13) > -1, JSON.stringify(formatosD));
    testar('sem BarcodeDetector o sistema não pede o leitor nativo', (await w.eval('codFormatosNativos()')) === null);
    w.BarcodeDetector = function(){};
    w.BarcodeDetector.getSupportedFormats = () => Promise.resolve(['qr_code','ean_13','ean_8','upc_a','itf']);
    const nativosD = await w.eval('codFormatosNativos()');
    testar('só os formatos aceitos pelo navegador', Array.isArray(nativosD) && nativosD.length === 5 &&
      nativosD.indexOf(enumD.DATA_MATRIX) === -1 && nativosD.indexOf(enumD.EAN_8) > -1, JSON.stringify(nativosD));
    w.BarcodeDetector.getSupportedFormats = () => Promise.resolve([]);
    testar('lista vazia cai para o leitor em JavaScript', (await w.eval('codFormatosNativos()')) === null);

    /* erro real do Android/Chrome: o leitor nativo pode ser recusado na construção */
    await w.codPararCamera(true);
    w.BarcodeDetector.getSupportedFormats = () => Promise.resolve(['qr_code','ean_13']);
    const tentativas = [];
    w.Html5Qrcode = function(id, cfg){
      tentativas.push(cfg);
      const nativo = !!(cfg && (cfg.useBarCodeDetectorIfSupported || (cfg.experimentalFeatures || {}).useBarCodeDetectorIfSupported));
      const f = cfg && cfg.formatsToSupport;
      if(nativo){
        if(!f || !f.length || f.some(x => typeof x !== 'number')) throw new TypeError("Failed to construct 'BarcodeDetector': Hint option provided, but is empty.");
        throw new TypeError("Failed to construct 'BarcodeDetector': Unsupported format.");
      }
      this.opts = cfg;
      this.start = () => Promise.resolve();
      this.stop = () => Promise.resolve();
      this.clear = () => {};
      this.getRunningTrackCameraCapabilities = () => null;
    };
    w.Html5Qrcode.getCameras = () => Promise.resolve([{id:'cam1', label:'Camera traseira'}]);
    w.eval('COD.scanner = null; COD.cameras = [];');
    await w.codIniciarCamera();
    testar('câmera liga mesmo com o leitor nativo recusando', w.eval('COD.rodando') === true && tentativas.length === 2, 'tentativas=' + tentativas.length);
    testar('2ª tentativa vai sem o leitor nativo', tentativas[1] && tentativas[1].useBarCodeDetectorIfSupported !== true);
    testar('formatos enviados são números nas duas tentativas', tentativas.every(c => Array.isArray(c.formatsToSupport) && c.formatsToSupport.every(x => typeof x === 'number')));
    testar('sem aviso de erro quando o recuo funciona', w.eval("$('#codLeitorAviso').textContent") === '', w.eval("$('#codLeitorAviso').textContent"));
    w.eval("$('#codLeitorAviso').textContent = ''");
    await w.codPararCamera(true);
    delete w.BarcodeDetector;

    testar('movimentações rápidas com origem Leitura', w.eval('state.movimentacoes[0].origem') === 'Leitura', w.eval('state.movimentacoes[0].origem'));

    /* ---------- requisição enviada pelo app Android ---------- */
    w.eval('COD.ultimoEm = 0');
    const prod0 = w.eval('state.produtos[0]');
    const prod1 = w.eval('state.produtos[1]');
    w.codRegistrarLeitura('STOKIREQ;REQ-2026-0007;SAIDA;Maria Souza;' + prod0.ft + ':2|' + prod1.ft + ':1;separar até 18h', 'câmera');
    testar('QR de requisição reconhecido', !!w.eval('COD.requisicao') && w.eval('COD.requisicao.numero') === 'REQ-2026-0007', w.eval('COD.requisicao && COD.requisicao.numero'));
    testar('itens da requisição resolvidos pelo FT', w.eval('COD.requisicao.itens.filter(i => i.produto).length') === 2, w.eval("COD.requisicao.itens.map(i => i.ft).join(' | ')"));
    testar('tipo SAIDA vira Saída', w.eval('codReqRotulo(COD.requisicao.tipo).mov') === 'Saída');
    testar('observação do app preservada', w.eval('COD.requisicao.obs') === 'separar até 18h', w.eval('COD.requisicao.obs'));
    testar('cartão da requisição aparece', $('#codReqCartao').style.display === '' && $('#codReqBox').innerHTML.indexOf('Maria Souza') > -1);
    const estAntes = Number(prod0.estoque);
    $('#btnCodReqAplicar').click();
    testar('aplicar requisição baixa o estoque', Number(w.eval('state.produtos[0].estoque')) === estAntes - 2, w.eval('state.produtos[0].estoque') + ' (antes ' + estAntes + ')');
    testar('movimentação com origem Requisição', w.eval('state.movimentacoes[0].origem') === 'Requisição' && w.eval('state.movimentacoes[0].tipo') === 'Saída', w.eval('state.movimentacoes[0].origem'));
    testar('origem Requisição disponível no relatório', w.eval('REL_ORIGENS').includes('Requisição'));
    capturado.print = 0;
    $('#btnCodReqImprimir').click();
    await espera(140);
    const area = $('#printArea').innerHTML;
    testar('lista de separação impressa', capturado.print === 1 && area.indexOf('Lista de separação') > -1 && area.indexOf('Maria Souza') > -1 && area.indexOf('REQ-2026-0007') > -1, 'print=' + capturado.print);
    testar('lista tem a quantidade pedida', area.indexOf('>2<') > -1 || /2<\/td>/.test(area));
    $('#btnCodReqFechar').click();
    testar('fechar esconde o cartão', w.eval('COD.requisicao') === null && $('#codReqCartao').style.display === 'none');
    w.codRegistrarLeitura('STOKIREQ;REQ-2026-0008;MATERIAL;João Lima;PRODUTO-INEXISTENTE:5', 'digitado');
    testar('pedido de material sem baixa automática', $('#btnCodReqAplicar') === null, String($('#btnCodReqAplicar')));
    testar('item sem cadastro sinalizado', w.eval('COD.requisicao.itens[0].produto') === null && $('#codReqBox').innerHTML.indexOf('não cadastrado') > -1);
    w.codRegistrarLeitura('STOKIREQ;REQ-2026-0009;ENTRADA;Fornecedor Central;' + prod0.ft + ':4', 'digitado');
    const antesEnt = Number(w.eval('state.produtos[0].estoque'));
    $('#btnCodReqAplicar').click();
    testar('requisição de ENTRADA soma no estoque', Number(w.eval('state.produtos[0].estoque')) === antesEnt + 4, w.eval('state.produtos[0].estoque'));
    testar('entrada por requisição também usa origem Requisição', w.eval('state.movimentacoes[0].origem') === 'Requisição' && w.eval('state.movimentacoes[0].tipo') === 'Entrada');
    w.eval('COD.requisicao = null; codRender();');

    /* ---------- zerar sessão ---------- */
    await (async () => {
      const promessa = (() => { $('#btnCodLimparSessao').click(); return null; })();
      await espera(60);
      w.document.querySelector('.modal-overlay [data-act="ok"]').click();
      await espera(60);
    })();
    testar('sessão zerada', w.eval('COD.sessao.leituras.length') === 0 && $('#codSessaoTbody').innerHTML.indexOf('Nenhuma leitura') > -1);

    testar('nenhum erro de script', erros.length === 0, erros.join(' | '));
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
  try { w.close(); } catch (e) {}
});
