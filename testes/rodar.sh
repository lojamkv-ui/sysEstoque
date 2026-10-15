#!/usr/bin/env bash
# Roda todas as baterias de teste do Stoki SDY (precisa de Node e do pacote jsdom).
#   bash testes/rodar.sh
set -u
cd "$(dirname "$0")/.." || exit 1
falhou=0
for arq in testes/[0-9]*.js; do
  echo "───────────────────────────────────────────────"
  echo "▶ $arq"
  if ! node --unhandled-rejections=warn "$arq"; then falhou=1; fi
done
echo "───────────────────────────────────────────────"
if [ "$falhou" = "0" ]; then echo "✅ Todas as baterias passaram."; else echo "❌ Alguma bateria falhou (veja acima)."; fi
exit "$falhou"
