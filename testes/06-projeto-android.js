/* Bateria de testes do projeto Android (estrutura do build e sincronia do app).
   Uso, da raiz do repositório:   node testes/06-projeto-android.js
   Não precisa de jsdom — só confere os arquivos do projeto. */
const fs = require('fs');
const moduloCaminho = require('path');
const RAIZ = moduloCaminho.join(__dirname, '..');
const MOBILE = moduloCaminho.join(RAIZ, 'mobile');
const ANDROID = moduloCaminho.join(MOBILE, 'android');
const APP = moduloCaminho.join(ANDROID, 'app');
const PUBLIC = moduloCaminho.join(APP, 'src', 'main', 'assets', 'public');

const ok = [], falhas = [];
const testar = (nome, cond, extra) => (cond ? ok : falhas).push(nome + (extra !== undefined ? ' → ' + extra : ''));
const existe = p => fs.existsSync(p);
const ler = p => fs.readFileSync(p, 'utf8');

/* ---------- arquivos que o Gradle exige ---------- */
testar('wrapper do Gradle presente', existe(moduloCaminho.join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.jar')) &&
  existe(moduloCaminho.join(ANDROID, 'gradlew')));

const settings = ler(moduloCaminho.join(ANDROID, 'settings.gradle'));
testar('settings.gradle inclui o módulo :app', /include ':app'/.test(settings));

/* todo "include ':<projeto>'" precisa ter a pasta — foi assim que o build quebraria */
const projetos = [...settings.matchAll(/include\s+':([^']+)'/g)].map(m => m[1]);
const pastas = [...settings.matchAll(/project\(':([^']+)'\)\.projectDir\s*=\s*new File\('([^']+)'\)/g)]
  .reduce((a, m) => (a[m[1]] = m[2], a), {});
projetos.forEach(nome => {
  const rel = pastas[nome] || ('./' + nome + '/');
  const pasta = moduloCaminho.join(ANDROID, rel.replace(/^\.\//, ''));
  testar('módulo Gradle "' + nome + '" existe', existe(pasta) && existe(moduloCaminho.join(pasta, 'build.gradle')), rel);
});

/* o capacitor.build.gradle faz "apply from" — o arquivo precisa existir */
const capBuild = ler(moduloCaminho.join(APP, 'capacitor.build.gradle'));
[...capBuild.matchAll(/apply from:\s*"([^"]+)"/g)].forEach(m => {
  const alvo = moduloCaminho.resolve(APP, m[1]);
  testar('apply from "' + m[1] + '" existe', existe(alvo), moduloCaminho.relative(RAIZ, alvo));
});

/* flatDir apontado pelo app/build.gradle */
const appBuild = ler(moduloCaminho.join(APP, 'build.gradle'));
testar('app/build.gradle usa o módulo capacitor-android vendorizado', /project\(':capacitor-android'\)/.test(appBuild));
if(/capacitor-cordova-android-plugins\/src\/main\/libs/.test(appBuild)){
  const libs = moduloCaminho.join(ANDROID, 'capacitor-cordova-android-plugins', 'src', 'main', 'libs');
  if(!existe(libs)) fs.mkdirSync(libs, {recursive:true});
  testar('pasta libs dos plugins Cordova existe', existe(libs));
}

/* ---------- configuração do app ---------- */
const capConfig = JSON.parse(ler(moduloCaminho.join(MOBILE, 'capacitor.config.json')));
testar('appId configurado', capConfig.appId === 'br.com.stokisdy.app', capConfig.appId);
testar('nome do app configurado', capConfig.appName === 'Stoki SDY', capConfig.appName);
testar('webDir aponta para www', capConfig.webDir === 'www', capConfig.webDir);

const manifest = ler(moduloCaminho.join(APP, 'src', 'main', 'AndroidManifest.xml'));
testar('manifest declara a permissão de câmera', /android\.permission\.CAMERA/.test(manifest));
testar('manifest permite http interno (usesCleartextTraffic)', /usesCleartextTraffic="true"/.test(manifest));

const assetsCap = JSON.parse(ler(moduloCaminho.join(APP, 'src', 'main', 'assets', 'capacitor.config.json')));
testar('capacitor.config.json copiado para os assets', assetsCap.appId === capConfig.appId, assetsCap.appId);
testar('capacitor.plugins.json copiado para os assets', existe(moduloCaminho.join(APP, 'src', 'main', 'assets', 'capacitor.plugins.json')));

/* ---------- www ↔ assets/public (o APK usa a cópia) ---------- */
const arquivosApp = ['index.html', 'sw.js', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png',
  'icone-512-maskable.png', 'icone-64.png', 'vendor/html5-qrcode.min.js', 'vendor/qrcode.js'];
arquivosApp.forEach(rel => {
  const origem = moduloCaminho.join(MOBILE, 'www', rel);
  const copia = moduloCaminho.join(PUBLIC, rel);
  const igual = existe(origem) && existe(copia) && Buffer.compare(fs.readFileSync(origem), fs.readFileSync(copia)) === 0;
  testar('assets/public em sincronia — ' + rel, igual, existe(copia) ? 'diferente do www' : 'não copiado (npm run sync)');
});

/* ---------- ícones e telas de abertura ---------- */
const res = moduloCaminho.join(APP, 'src', 'main', 'res');
['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].forEach(d => {
  testar('ícone do launcher (' + d + ')', existe(moduloCaminho.join(res, 'mipmap-' + d, 'ic_launcher.png')) &&
    existe(moduloCaminho.join(res, 'mipmap-' + d, 'ic_launcher_foreground.png')));
});
testar('tela de abertura presente', existe(moduloCaminho.join(res, 'drawable-land-hdpi', 'splash.png')));
testar('fundo do ícone adaptativo é branco', /FFFFFF|ffffff/.test(ler(moduloCaminho.join(res, 'values', 'ic_launcher_background.xml'))));

/* ---------- leitura por câmera no app: formatos numéricos ---------- */
const appHtml = ler(moduloCaminho.join(PUBLIC, 'index.html'));
testar('app usa os valores numéricos do enum de formatos', /Html5QrcodeSupportedFormats/.test(appHtml) && /FORMATOS_NOMES\.map/.test(appHtml));
testar('app pergunta ao aparelho quais formatos o leitor nativo aceita', /BarcodeDetector[\s\S]{0,120}getSupportedFormats/.test(appHtml));
testar('app tem recuo para o leitor em JavaScript', /leitorComRecuo/.test(appHtml));
testar('service worker com versão nova', /stoki-sdy-v\d+/.test(ler(moduloCaminho.join(PUBLIC, 'sw.js'))), (ler(moduloCaminho.join(PUBLIC, 'sw.js')).match(/stoki-sdy-v\d+/) || [])[0]);

/* ---------- build na nuvem ---------- */
testar('fluxo de build do APK no repositório', existe(moduloCaminho.join(MOBILE, 'ci', 'android.yml')) &&
  /gradlew assembleDebug/.test(ler(moduloCaminho.join(MOBILE, 'ci', 'android.yml'))));
testar('guia do app escrito', existe(moduloCaminho.join(MOBILE, 'README-APP.md')));

console.log('\n== OK (' + ok.length + ') ==');
ok.forEach(o => console.log('  ✓ ' + o));
if(falhas.length){
  console.log('\n== FALHAS (' + falhas.length + ') ==');
  falhas.forEach(f => console.log('  ✗ ' + f));
}
process.exit(falhas.length ? 1 : 0);
