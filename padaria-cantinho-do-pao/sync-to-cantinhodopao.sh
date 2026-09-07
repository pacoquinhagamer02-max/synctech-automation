#!/bin/bash
# Sincroniza padaria-cantinho-do-pao/ pro repo cantinhodopao (dominio limpo).
# Roda a partir da raiz do synctech-automation.
set -e
SRC="padaria-cantinho-do-pao"
DST="../cantinhodopao-site"

cp "$SRC/cardapio.html" "$DST/index.html"
cp "$SRC/manifest.json" "$DST/manifest.json" 2>/dev/null || true
cp "$SRC/sw.js" "$DST/sw.js" 2>/dev/null || true
rm -rf "$DST/assets"
cp -r "$SRC/assets" "$DST/assets"

# Corrige og:url/og:image pro dominio limpo (senao fica apontando pro caminho antigo)
sed -i \
  -e 's#https://pacoquinhagamer02-max.github.io/synctech-automation/padaria-cantinho-do-pao/#https://pacoquinhagamer02-max.github.io/cantinhodopao/#g' \
  -e 's#content="https://pacoquinhagamer02-max.github.io/cantinhodopao/cardapio.html"#content="https://pacoquinhagamer02-max.github.io/cantinhodopao/"#g' \
  "$DST/index.html"

echo "Sincronizado. Revise og:url manualmente se precisar."
