#!/bin/bash
# Sincroniza padaria-cantinho-do-pao/ pros 2 repos publicados:
# - cantinhodopao-site (dominio /cantinhodopao/, link antigo, continua valido)
# - pacoquinhagamer02-max.github.io (raiz da conta, link curto oficial desde 28/09/2026)
# Roda a partir da raiz do synctech-automation.
set -e
SRC="padaria-cantinho-do-pao"

sync_para() {
  local DST="$1" URL_BASE="$2"
  cp "$SRC/cardapio.html" "$DST/index.html"
  cp "$SRC/manifest.json" "$DST/manifest.json" 2>/dev/null || true
  cp "$SRC/sw.js" "$DST/sw.js" 2>/dev/null || true
  rm -rf "$DST/assets"
  cp -r "$SRC/assets" "$DST/assets"
  # Corrige canonical/og:url/og:image pro dominio de destino (senao fica apontando pro caminho errado)
  sed -i \
    -e "s#<link rel=\"canonical\" href=\"[^\"]*\">#<link rel=\"canonical\" href=\"${URL_BASE}\">#g" \
    -e "s#<meta property=\"og:url\" content=\"[^\"]*\">#<meta property=\"og:url\" content=\"${URL_BASE}\">#g" \
    -e "s#<meta property=\"og:image\" content=\"[^\"]*/assets/hero.jpg\">#<meta property=\"og:image\" content=\"${URL_BASE}assets/hero.jpg\">#g" \
    "$DST/index.html"
}

sync_para "../cantinhodopao-site" "https://pacoquinhagamer02-max.github.io/cantinhodopao/"
sync_para "../pacoquinhagamer02-max.github.io" "https://pacoquinhagamer02-max.github.io/"

echo "Sincronizado nos 2 repos publicados. Falta só: cd em cada pasta e git commit+push."
