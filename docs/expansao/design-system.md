# Design System — SyncTech Automation ("Roxo Futurista")

Registro dos tokens visuais aplicados nas 5 páginas do produto (landing, setup, dashboard, bio, agendamento) em 01/07/2026, substituindo a paleta genérica anterior (indigo `#6366F1` + Inter — a combinação mais comum em landing pages geradas por IA).

## Por que mudou

Auditoria encontrou `#6366F1` (indigo padrão do Tailwind) + fundo `#0D1117` (dark do GitHub) + Inter em **todas as 5 páginas** — a fórmula visual mais repetida em produtos de automação/IA. Direção escolhida: roxo mais saturado (violeta, não azulado) + efeitos de grid/glow + tipografia com mais caráter, mantendo o dark mode que já funcionava.

## Tokens de cor

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0A0714` | Fundo base |
| `--s1` / `--surface` | `#150F24` | Cards, sidebar, superfícies elevadas |
| `--s2` / `--surface2` | `#1D1530` | Superfícies secundárias (inputs, hover) |
| `--s3` | `#251C3D` | Terceiro nível (raramente usado) |
| `--primary` | `#A855F7` | Cor de marca — CTAs, links, destaques |
| `--pl` / `--primary-l` | `#C084FC` | Variante clara (texto sobre fundo escuro, hover) |
| `--pd` / `--primary-d` | `#9333EA` | Variante escura (hover de botão) |
| `--text` | `#F1EAFB` | Texto principal |
| `--muted` | `#B0A0CC` | Texto secundário |
| `--faint` | `#6B5A8B` | Texto terciário/desabilitado |
| `--border` | `rgba(168,85,247,0.14)` | Bordas padrão (tingidas de roxo, não cinza neutro) |
| `--border-strong` / `--bord2` | `rgba(168,85,247,0.28)` | Bordas em destaque/hover |
| `--green` `--yellow` `--red` | inalterados | Cores funcionais (sucesso/alerta/erro) — não fazem parte da marca |
| `--cyan` | `#60A5FA` | Segunda cor de apoio em gráficos (era `#06B6D4`) |

## Tipografia

| Uso | Fonte |
|---|---|
| Corpo de texto | `Inter` (mantido — neutro, legível, não é o problema) |
| Títulos (`h1`, `h2`, `h3`, logo) | `Space Grotesk` — mais geométrica e distinta |
| Tags/badges/eyebrow (labels curtos, estilo terminal) | `JetBrains Mono` — reforça a leitura "tech" |

Import usado em todas as páginas:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

## Efeito de hero (só na landing page)

Grid sutil + glow radial no topo do hero, mascarado pra sumir gradualmente:
```css
.hero::before {
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(168,85,247,0.28) 0%, transparent 65%),
    linear-gradient(rgba(168,85,247,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(168,85,247,0.05) 1px, transparent 1px);
  background-size: 100% 100%, 42px 42px, 42px 42px;
  mask-image: linear-gradient(to bottom, black 0%, transparent 85%);
}
```

## Raio de borda

Reduzido de `12px` para `8px` (`--radius`) e de `8px` para `6px` (`--radius-sm`) — cantos menos arredondados, visual mais "técnico/angular" e menos "app fofinho genérico".

## Regra pra manter consistência

Qualquer página nova do produto deve importar as 3 fontes acima e usar os tokens desta tabela — nunca hardcodar `#6366F1`, `#818CF8`, `#0D1117` ou `Inter` sozinho em títulos. Se precisar de uma cor nova, derive do roxo (`#A855F7`) por variação de luminosidade, não introduza uma cor de marca não relacionada.
