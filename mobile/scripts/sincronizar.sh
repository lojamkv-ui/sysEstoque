#!/usr/bin/env bash
# Copia o app (mobile/www) para dentro do projeto Android.
# É o equivalente ao "npx cap sync android", mas sem precisar de Node/npm.
#   bash mobile/scripts/sincronizar.sh
set -eu
cd "$(dirname "$0")/.."          # raiz de mobile/
alvo="android/app/src/main/assets/public"
mkdir -p "$alvo"
cp -r www/. "$alvo"/
cp capacitor.config.json android/app/src/main/assets/capacitor.config.json
printf '{\n  "android": []\n}\n' > android/app/src/main/assets/capacitor.plugins.json
echo "app copiado para $alvo"
echo "confira o painel de conferência por QR/EAN no computador: o QR do app usa o formato STOKIREQ;..."
