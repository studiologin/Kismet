# Kismet Score

Placar, histórico e estatísticas da disputa de **Kismet** entre **Manoel e Ana** — 3 partidas por mês —
com cartela de registro integrada à planilha **KISMET RESULTADOS** (Google Sheets).

- **Landing pública** (`/`): placar geral e líder, mês corrente (x/3), duelo de estatísticas,
  evolução mensal em gráfico, histórico mês a mês com acumulado e últimas partidas.
- **Registro** (`/registrar`, protegido por PIN): cartela lado a lado com cálculo automático
  de subtotal, bônus, totais e vencedor; validação por categoria; confirmação antes de salvar;
  bloqueio da 4ª partida do mês (com opção de sobrescrever); rascunho salvo no aparelho.
- **Importação** do histórico antigo (aba `Nucha & Manoel`) em um clique, sem duplicar.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Motion (Framer Motion) ·
Google Sheets API v4 via Service Account (somente no servidor, sem SDK) · Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis (veja docs/CONFIGURACAO.md)
npm run dev                  # http://localhost:3000
```

Sem as variáveis do Google, o site abre em **modo demonstração** com o histórico real
de jan–ago 2026 embutido — útil para ver o layout antes de configurar.

## Deploy na Vercel

1. Faça commit desta pasta (ela é a raiz do repositório) e envie para o GitHub:
   ```bash
   git init && git add . && git commit -m "Kismet Score"
   git branch -M main
   git remote add origin https://github.com/<usuario>/<repo>.git
   git push -u origin main
   ```
2. Na Vercel: **Add New → Project → Import** o repositório.
   Framework: **Next.js** (detectado sozinho). Root Directory: **`./`**. Nada mais a ajustar.
3. Em **Settings → Environment Variables**, cadastre as variáveis do `.env.example`.
4. **Deploy**. A cada `git push` na `main`, a Vercel publica de novo.

Passo a passo da Service Account e da planilha: **[docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)**.

## Regras de pontuação

Definidas em `lib/kismet.ts` (validação, cálculo e cabeçalho da planilha leem tudo de lá):

| Categoria              | Pontos                    | Validação           |
| ---------------------- | ------------------------- | ------------------- |
| Ases … Seis            | soma da face              | múltiplo da face, até 5 dados |
| Bônus superior         | 63–70: 35 · 71–77: 55 · 78+: 75 | automático |
| Dois pares mesma cor   | soma dos dados            | 0 ou 5–30           |
| Trinca                 | soma dos dados            | 0 ou 5–30           |
| Sequência              | 30                        | 0 ou 30             |
| Flush                  | 35                        | 0 ou 35             |
| Full House             | soma + 15                 | 0 ou 20–45          |
| Full House mesma cor   | soma + 20                 | 0 ou 25–50          |
| Quadra                 | soma + **35** (regra da planilha) | 0 ou 40–65  |
| Yarborough             | soma dos dados            | 0 ou 5–30           |
| Kismet                 | soma + 50                 | 0 ou 55–80          |

Campo riscado = **0**. O botão **“Vazios = 0”** zera de uma vez as categorias não usadas.

## Estrutura

```
app/
  layout.tsx            fontes, metadados, providers de animação
  page.tsx              landing (ISR 5 min + revalidação ao salvar)
  globals.css           tema, glass, dados 3D em CSS, reduced-motion
  icon.svg
  registrar/
    page.tsx            PIN → cartela + importação
    actions.ts          Server Actions: login, logout, salvar, importar
components/
  landing/              Header, Hero (parallax), MonthNow, StatsSection, DuelBar,
                        EvolutionChart, MonthHistory, RecentMatches, Marquee, CtaFooter…
  registrar/            PinGate, MatchForm (cartela), ImportPanel
  ui/                   Die (dado 3D CSS), AnimatedNumber, Reveal, Parallax, Providers
lib/
  kismet.ts             regras, categorias, bônus, validação
  match.ts              modelo da partida ⇄ linha da planilha
  google-sheets.ts      cliente Sheets (JWT RS256 com node:crypto)
  matches.ts            leitura com cache, gravação, sobrescrita, importação
  legacy.ts             conversor da aba antiga
  stats.ts              vitórias, médias, recordes, sequências, meses
  auth.ts               PIN + cookie de sessão assinado (HMAC)
  dates.ts              fuso America/Sao_Paulo
  demo-data.ts          histórico jan–ago 2026 (modo demonstração)
docs/CONFIGURACAO.md    guia da Service Account, planilha e variáveis
```

## Segurança

- Credenciais só existem no servidor (Server Components / Server Actions); nada vai ao navegador.
- `.env*`, JSON de credenciais e `*.xlsx` estão no `.gitignore`.
- `/registrar` exige PIN; a sessão é um cookie `httpOnly` assinado com `SESSION_SECRET`, válido por 30 dias.
- Toda gravação revalida o PIN e valida a cartela de novo no servidor.

## Acessibilidade e performance

- `prefers-reduced-motion` desliga parallax, giro dos dados e contadores.
- Dados 3D feitos em CSS (sem WebGL/three.js); fontes self-hosted; landing pré-renderizada.
- Gráfico com tabela equivalente para leitores de tela; foco visível em todos os controles.
