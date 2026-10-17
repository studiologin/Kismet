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
| `ADMIN_PIN`                    | sim         | PIN de 4–8 dígitos para acessar `/registrar`                              |
| `SESSION_SECRET`               | recomendada | texto aleatório longo (assina o cookie de sessão)                        |
| `GOOGLE_SHEET_TAB`             | não         | padrão `Partidas` — criada automaticamente com cabeçalho                 |
| `GOOGLE_LEGACY_TAB`            | não         | padrão `Nucha & Manoel` — usada só na importação do histórico            |

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
3. No fim da página, abra **Importar histórico da planilha antiga**, confirme o ano (**2026**) e clique em
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
