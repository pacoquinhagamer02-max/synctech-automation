#!/bin/bash
# Sincroniza padaria-cantinho-do-pao/ pros lugares publicados:
# - cantinhodopao-site (github.io/cantinhodopao/, link antigo, continua valido)
# - pacoquinhagamer02-max.github.io (raiz da conta github, link curto)
# - cantinhodopao-netlify (Netlify, cantinhodopaomariana.netlify.app — sem
#   usuario no dominio, o link "oficial" pedido pelo Rafael 28/09/2026. So
#   copia os arquivos; publicar de verdade e' `netlify deploy --prod` na
#   pasta cantinhodopao-netlify (nao tem git, nao precisa commit).
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
sync_para "../cantinhodopao-netlify" "https://cantinhodopaomariana.netlify.app/"

echo "Sincronizado nos 3 lugares. Falta: git commit+push nos 2 repos GitHub, e"
echo "'netlify deploy --prod --dir=.' dentro de cantinhodopao-netlify/ pro Netlify."
