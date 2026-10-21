# Guia de configuração — Kismet Score

Tempo estimado: 15 minutos. Ao final, o site lê e grava direto na planilha **KISMET RESULTADOS**.

---

## 0. Converter a planilha para o formato Google Sheets (obrigatório)

Hoje o arquivo **KISMET RESULTADOS.xlsx** está no Drive como Excel (`.xlsx`).
A Google Sheets API **não grava em arquivos .xlsx** — só em planilhas nativas.

1. Abra o arquivo no Google Drive.
2. Menu **Arquivo → Salvar como Planilhas Google**.
3. Uma cópia nativa é criada (ícone verde, sem “.xlsx” no nome). Renomeie para **KISMET RESULTADOS** se necessário.
4. Use **essa nova planilha** nos passos seguintes. O `.xlsx` antigo pode ser arquivado.

> As abas antigas (`Nucha & Manoel` e `RESULTADOS`) continuam intactas. O app cria uma aba nova
> chamada **Partidas** (uma linha por partida) e nunca altera as abas antigas.

---

## 1. Criar o projeto e ativar a API no Google Cloud

1. Acesse <https://console.cloud.google.com/> e crie um projeto (ex.: `kismet-score`).
2. Vá em **APIs e serviços → Biblioteca**, procure **Google Sheets API** e clique em **Ativar**.

## 2. Criar a Service Account

1. **IAM e administrador → Contas de serviço → Criar conta de serviço**.
2. Nome: `kismet-score`. Não precisa conceder papéis no projeto → **Concluir**.
3. Abra a conta criada → aba **Chaves** → **Adicionar chave → Criar nova chave → JSON**.
4. Um arquivo `.json` é baixado. **Não coloque esse arquivo na pasta do projeto** (o `.gitignore` já bloqueia
   `*service-account*.json` e `credentials*.json`, mas o ideal é guardá-lo fora do repositório).

Do JSON você vai usar dois campos:

| Campo no JSON  | Variável de ambiente            |
| -------------- | ------------------------------- |
| `client_email` | `GOOGLE_SERVICE_ACCOUNT_EMAIL`  |
| `private_key`  | `GOOGLE_PRIVATE_KEY`            |

## 3. Compartilhar a planilha com a Service Account

1. Abra a planilha **KISMET RESULTADOS** (a versão Google Sheets do passo 0).
2. **Compartilhar** → cole o `client_email` (termina em `.iam.gserviceaccount.com`).
3. Permissão: **Editor**. Desmarque “Notificar pessoas” → **Compartilhar**.

## 4. Copiar o ID da planilha

Na URL da planilha:

```
https://docs.google.com/spreadsheets/d/1AbCdEf...XyZ/edit#gid=0
                                       └──── GOOGLE_SHEET_ID ────┘
```

## 5. Variáveis de ambiente

| Variável                       | Obrigatória | Exemplo / observação                                                     |
| ------------------------------ | ----------- | ------------------------------------------------------------------------ |
| `GOOGLE_SHEET_ID`              | sim         | ID do passo 4                                                            |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | sim         | `kismet-score@seu-projeto.iam.gserviceaccount.com`                       |
| `GOOGLE_PRIVATE_KEY`           | sim         | `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`    |
| `MANOEL_PIN`                   | sim         | PIN do perfil Manoel (4–8 dígitos)                                        |
| `ANA_PIN`                      | sim         | PIN do perfil Ana (4–8 dígitos)                                           |
| `ADMIN_PIN`                    | não         | PIN geral: entra em qualquer um dos dois perfis (opcional)                |
| `GOOGLE_LIVE_TAB`              | não         | padrão `AoVivo` — aba da partida em andamento, criada automaticamente     |
| `SESSION_SECRET`               | recomendada | texto aleatório longo (assina o cookie de sessão)                        |
| `GOOGLE_SHEET_TAB`             | não         | padrão `Partidas` — criada automaticamente com cabeçalho                 |
| `GOOGLE_LEGACY_TAB`            | não         | padrão `Nucha & Manoel` — histórico antigo, lido automaticamente          |
| `GOOGLE_LEGACY_YEAR`           | não         | padrão `2026` — ano das partidas da aba antiga                            |

Gerar o `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Local (`.env.local`)

```bash
cp .env.example .env.local   # Windows: copy .env.example .env.local
```

Preencha o `.env.local`. Para a chave privada, cole o valor de `private_key` **entre aspas duplas,
mantendo os `\n` literais** exatamente como aparecem no JSON.

### Vercel

**Project → Settings → Environment Variables** → cadastre as mesmas chaves para *Production*
(e *Preview*, se quiser). Na Vercel, cole a `private_key` **com ou sem aspas** — o código aceita
tanto `\n` literais quanto quebras de linha reais.

> Mudou alguma variável? Faça um **Redeploy** para ela valer.

## 6. Primeiro uso

1. Acesse `/registrar`, digite o PIN.
2. Na primeira leitura, o app cria a aba **Partidas** com o cabeçalho completo (46 colunas).
3. O site já mostra o histórico da aba antiga automaticamente: ele lê as duas abas e a aba
   **Partidas** tem prioridade quando o mesmo mês/partida existe nas duas. Opcionalmente, para
   consolidar tudo numa aba só, abra **Importar histórico da planilha antiga**, confirme o ano (**2026**) e clique em
   **Importar**. As 24 partidas de janeiro a agosto viram linhas na aba Partidas.
   Pode clicar de novo sem medo: partidas já existentes (mesmo mês e número) são ignoradas.
4. Pronto — a landing page passa a mostrar os dados ao vivo.

### Estrutura da aba `Partidas`

`ID · Data · Mês/Ano · Nº Partida · [Manoel: Ases…Seis, Subtotal Superior, Bônus, Total Superior,
Dois pares mesma cor…Kismet, Total Inferior, Total] · [Ana: idem] · Vencedor · Registrado em`

- **ID** segue o padrão `2026-10-P1` (ano-mês-partida).
- Os valores são gravados como dados brutos (sem fórmulas), o que mantém a leitura simples e estável.
- Editar uma célula à mão funciona: o app recalcula totais e vencedor a partir das categorias.

## 7. Cache e atualização

- A landing page é estática com revalidação a cada **5 minutos** (ISR).
- Ao salvar uma partida ou importar o histórico, o cache é invalidado na hora — o placar novo
  aparece imediatamente.
- Editou a planilha manualmente? A mudança aparece em até 5 minutos.

## 8. Problemas comuns

| Sintoma                                              | Causa provável / solução                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Faixa “Modo demonstração” no site                    | Variáveis do Google ausentes no ambiente. Cadastre e faça redeploy.                          |
| “Sem permissão na planilha”                          | Planilha não compartilhada com o `client_email` como **Editor**.                             |
| “Planilha não encontrada”                            | `GOOGLE_SHEET_ID` errado — ou ainda é o arquivo `.xlsx` (refaça o passo 0).                   |
| “This operation is not supported for this document” | O ID aponta para o `.xlsx`. Use o ID da versão Google Sheets.                                |
| “Falha na autenticação Google (400)”                 | `GOOGLE_PRIVATE_KEY` mal colada (faltando `-----BEGIN…` ou `\n`).                              |
| “Google Sheets API has not been used in project…”    | API não ativada (passo 1).                                                                   |
| PIN não aceito                                       | Confira `ADMIN_PIN` na Vercel e faça redeploy.                                               |

## 9. Partida ao vivo e app no celular

- **Perfis:** em `/registrar` cada um escolhe *Manoel* ou *Ana* e digita o próprio PIN. O celular fica
  logado por 90 dias.
- **Rodadas em sequência:** as partidas seguem a numeração da planilha — rodadas 1 a 36 no ano,
  3 por mês (jan = 1–3 … dez = 34–36). O app sempre abre a **próxima rodada** (última jogada + 1), e o
  mês que ela vale é o da sequência, não o do calendário: se a última foi a 24 (3ª de agosto), a
  próxima é a **rodada 25 = 1ª de setembro**, mesmo jogando em outubro. A data gravada é a do dia do
  jogo. Depois da 36ª, a sequência recomeça na rodada 1 do ano seguinte.
- **Ao vivo, por turnos:** quem cria a partida escolhe só **quem começa**. O outro
  abre o app e entra na mesma partida. As jogadas são intercaladas, como no jogo de verdade: na sua
  vez (jogada 1 a 15), você escolhe a categoria, marca os pontos (botões rápidos por nº de dados, "fez/riscar" ou o
  valor) e toca em **Salvar jogada** — ela é gravada na hora e a vez passa para o outro, que recebe
  um aviso com o que você marcou (em até 3 segundos).
- **Desfazer:** errou? Enquanto o outro ainda não jogou, toque em *Desfazer* e a vez volta para você.
- **Fim automático:** a última jogada da partida (botão *Salvar e encerrar*) já grava o resultado na
  aba **Partidas**, limpa a **AoVivo** e atualiza o placar — os dois celulares mostram o encerramento.
  Se a gravação falhar (ex.: sem internet), aparece *Gravar resultado agora* para tentar de novo.
- A aba **AoVivo** da planilha guarda a partida em andamento (uma linha por jogador, com todas as jogadas em ordem) e é limpa ao
  finalizar ou cancelar. Não edite essa aba à mão durante o jogo.
- **Lançamento manual** (`/registrar/manual`): preenche as duas colunas de uma vez — para correções.
- **Instalar no celular:**
  - *Android (Chrome):* abra o site → aparece "Instalar o Kismet" (ou menu ⋮ → *Instalar app*).
  - *iPhone (Safari):* botão *Compartilhar* → *Adicionar à Tela de Início*.
  O app abre em tela cheia direto na partida, com navegação inferior (Placar · Partida · Histórico).
- **Rotação:** o app acompanha o giro do celular (se a rotação automática estiver ligada). Deitado,
  a partida mostra a jogada e a cartela lado a lado, com as barras compactas.
- **Atualizações:** um aviso aparece no topo quando (a) há uma **versão nova do app** (após um deploy)
  ou (b) há **resultados novos** na planilha. Tocar em *Atualizar* aplica; *Depois* adia até a próxima
  novidade. Durante a partida ao vivo o aviso de dados não aparece (a tela já se sincroniza sozinha).

