# App Stoki SDY (Android / PWA)

App de **conferência de estoque por QR Code / EAN** para o celular. Funciona **sem internet**:
guarda o catálogo no próprio aparelho, registra as leituras e monta a **requisição de material**
com QR Code, que o sistema do computador lê e aplica no estoque.

```
mobile/
├─ www/                 ← o app (HTML/CSS/JS puro, sem build)
│  ├─ index.html        · telas: Conferir, Requisição, Produtos, Histórico
│  ├─ vendor/           · html5-qrcode 2.3.8 (Apache-2.0) e qrcode-generator 2.0.4 (MIT)
│  ├─ manifest.webmanifest · icone-*.png · sw.js   → instalação por link / sem internet
├─ android/             ← projeto Android (Capacitor 6, Gradle 8, AGP 8.2.1, compileSdk 34)
│  ├─ capacitor-android/                    · biblioteca @capacitor/android vendorizada
│  ├─ capacitor-cordova-android-plugins/    · pasta exigida pelo Gradle (sem plugins)
│  └─ app/src/main/assets/public/           · cópia de www/ que vai dentro do APK
├─ ci/android.yml       ← fluxo do GitHub Actions que compila o APK na nuvem
├─ scripts/gerar-icones.py  · regenera ícones, ícone adaptativo e telas de abertura
└─ capacitor.config.json
```

## 1. Instalar por link (sem loja, o mais rápido)
Abra no **Chrome do celular**:

```
https://lojamkv-ui.github.io/sysEstoque/mobile/www/
```

Toque em **⬇︎ Instalar app** (ou menu ⋮ › *Instalar app / Adicionar à tela inicial*).
O app abre sem internet depois da primeira visita (service worker) e a câmera funciona porque
o GitHub Pages é **https** — o navegador só libera a câmera em https ou localhost.

## 2. Gerar o APK

### Pelo GitHub (não precisa instalar nada)
1. Copie `mobile/ci/android.yml` para `.github/workflows/android.yml` (pelo site do GitHub: **Add file › Create new file**).
2. Aba **Actions** › *Build do APK (Android)* › **Run workflow** (~5 min).
3. Baixe o APK em **Artifacts** → `stoki-sdy-apk`.
4. Para um **link direto**: crie uma tag (`git tag v1.0.0 && git push origin v1.0.0`) — o APK vai para a Release em
   `https://github.com/lojamkv-ui/sysEstoque/releases/latest/download/app-debug.apk`.

### No computador (com JDK 17 + Android SDK)
```bash
cd mobile/android
./gradlew assembleDebug      # gera app/build/outputs/apk/debug/app-debug.apk
```
A pasta `app/src/main/assets/public` já está versionada, então **não é preciso** `npm install`.
Depois de mexer no app, sincronize a cópia com:
```bash
bash mobile/scripts/sincronizar.sh     # copia mobile/www → android/app/src/main/assets/public
# ou, com Node: cd mobile && npx cap sync android
```

### Instalar no celular
Envie o `app-debug.apk` por WhatsApp/Drive, toque nele e permita *instalar de fontes desconhecidas*.
Ao abrir pela primeira vez, **autorize a câmera** (o app não funciona sem essa permissão).

## 3. Como usar
1. **Catálogo**: no sistema do computador, aba *Produtos* › botão **CSV**; mande o arquivo para o celular;
   no app, aba **Produtos › Importar CSV**. Pronto: FT, EAN, nome e estoque ficam iguais.
2. **Conferir**: *Abrir câmera e ler* → bipe o QR Code ou o código de barras. O produto aparece com o
   estoque atual; use **Entrada**, **Saída** ou **Contagem** (quantidade no campo acima).
3. **Requisição**: aba *Requisição* → informe o solicitante, o tipo (Saída/Entrada/Pedido), bipe os itens
   e toque em **Gerar**. Mostre o QR para o sistema do computador (ou *Compartilhar*/*Copiar texto*).
   No sistema, aba **Conferência QR/EAN**, o cartão *Requisição recebida do app* abre com a lista de
   separação e o botão para aplicar a baixa/entrada no estoque.
4. **Histórico**: tudo o que foi feito no aparelho, com data e hora, exportável em CSV; backup em JSON.

## 4. Problemas comuns
| Sintoma | Causa / solução |
|---|---|
| “Não foi possível abrir a câmera… permissão” | Autorize a câmera: *Ajustes › Apps › Stoki SDY › Permissões › Câmera*. |
| A câmera abre mas não lê | Aproxime ~15 cm, melhore a luz, use a **lanterna**; etiquetas amassadas: use *Ler de foto*. |
| Mensagem sobre `BarcodeDetector` / “Hint option” | Já tratado: o app pergunta ao aparelho quais formatos o leitor nativo aceita e, se falhar, usa o leitor em JavaScript. Se aparecer, atualize o app (veja abaixo). |
| O app não pega a versão nova | Feche o app por completo e abra de novo (a página usa *rede primeiro*). Confira a versão no topo: aparece `· v2`. Em último caso, no Chrome: *Configurações do site › Limpar dados*. |
| QR do sistema não abre o produto no app | O aparelho precisa ter aquele produto no catálogo — importe o CSV de novo. |

## 5. Detalhes técnicos
- **Formatos lidos**: QR Code, EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, CODE-39, CODE-93, ITF, Codabar, Data Matrix, PDF417.
- **Leitor nativo**: quando o aparelho tem `BarcodeDetector`, o app usa a decodificação nativa
  (bem mais rápida e precisa para EAN). Antes de usar, ele pergunta `getSupportedFormats()` e manda
  **somente** os formatos aceitos — o que evita o erro do Android
  `Failed to construct 'BarcodeDetector': Hint option provided, but is empty.`
  Se ainda assim o leitor nativo recusar, o app cai automaticamente para o decodificador em JavaScript.
- **Dados**: `localStorage` (chave `stoki-sdy-app-v2`), no aparelho. Nada é enviado para a internet.
- **Permissão de câmera**: declarada no `AndroidManifest.xml` (`android.permission.CAMERA`).
- **Ícones/splash**: `python3 mobile/scripts/gerar-icones.py` (requer Pillow).
