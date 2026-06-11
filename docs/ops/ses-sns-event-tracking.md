# Runbook — SES → SNS event tracking (newsletter)

> Status 2026-06-10: a cadeia está QUEBRADA no elo SES→SNS. Diagnóstico e fix abaixo.
> O fix exige o **console AWS com usuário admin** — as credenciais do app
> (`bythiago-ses-sender`, em `apps/web/.env.local`) são send-only e NÃO conseguem
> ler nem editar a Access Policy do tópico (confirmado via API: `AuthorizationError`
> em `SNS:GetTopicAttributes` e `SNS:SetTopicAttributes`).

## Arquitetura

```
SES SendEmail (ConfigurationSetName=bythiago-marketing)
  └─ event destination "ses-bythiago-marketing-events"
       (Enabled — Hard bounces, Clicks, Complaints, Deliveries, Opens)
       └─ SNS topic: arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events
            └─ HTTPS subscription (Confirmed, raw delivery OFF):
                 https://bythiagofigueiredo.com/api/webhooks/ses
                   └─ apps/web/src/app/api/webhooks/ses/route.ts
                        ├─ verifica assinatura SNS (cert SigV1)
                        ├─ valida TopicArn contra SNS_EXPECTED_TOPIC_ARN (se setado)
                        ├─ dedup por SNS MessageId → webhook_events.idempotency_key
                        └─ atualiza newsletter_sends (delivered/opened/clicked/
                           bounced/complained) + newsletter_subscriptions
                           (hard bounce/complaint = opt-out) + link_clicks
                           (cliques unificados) + stats_stale na edition
```

## Sintoma observado

- SendEmail com o config set → mailbox simulator: e-mail entregue, **zero POSTs**
  no endpoint (Vercel logs observados por 75s) e `webhook_events` vazio.
- Diagnóstico: **o SES não consegue publicar no tópico** — a Access Policy do
  tópico SNS não tem um statement permitindo `ses.amazonaws.com` → `SNS:Publish`.
  (O SES falha silenciosamente nesse caso: não há retry visível nem erro no envio.)

## Fix — Access Policy do tópico SNS (console, usuário admin)

Caminho no console:

1. AWS Console → **SNS** (region **sa-east-1 / São Paulo**) → **Topics** → `ses-bythiago-events`.
2. **Edit** → expandir **Access policy** → substituir o JSON inteiro pelo documento abaixo.
3. **Save changes**.

Documento completo (cole tudo — já inclui o statement default do owner):

```json
{
  "Version": "2008-10-17",
  "Id": "__default_policy_ID",
  "Statement": [
    {
      "Sid": "__default_statement_ID",
      "Effect": "Allow",
      "Principal": {
        "AWS": "*"
      },
      "Action": [
        "SNS:GetTopicAttributes",
        "SNS:SetTopicAttributes",
        "SNS:AddPermission",
        "SNS:RemovePermission",
        "SNS:DeleteTopic",
        "SNS:Subscribe",
        "SNS:ListSubscriptionsByTopic",
        "SNS:Publish"
      ],
      "Resource": "arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events",
      "Condition": {
        "StringEquals": {
          "AWS:SourceOwner": "793477410088"
        }
      }
    },
    {
      "Sid": "AllowSESPublish",
      "Effect": "Allow",
      "Principal": {
        "Service": "ses.amazonaws.com"
      },
      "Action": "SNS:Publish",
      "Resource": "arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events",
      "Condition": {
        "StringEquals": {
          "AWS:SourceAccount": "793477410088"
        }
      }
    }
  ]
}
```

## Verificação (depois do fix)

Envia UM e-mail real via SES para o mailbox simulator da Amazon (não chega a
ninguém, mas gera evento de Delivery de verdade). Script já existe:
`scripts/test-ses-event-chain.ts`.

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
set -a && source apps/web/.env.local && set +a
npx tsx scripts/test-ses-event-chain.ts
```

Conteúdo do script (referência):

```ts
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

const ses = new SESv2Client({
  region: process.env.AWS_SES_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
  },
})

const res = await ses.send(new SendEmailCommand({
  FromEmailAddress: `Thiago Figueiredo <newsletter@${process.env.NEWSLETTER_FROM_DOMAIN}>`,
  Destination: { ToAddresses: ['success@simulator.amazonses.com'] },
  ConfigurationSetName: process.env.SES_MARKETING_CONFIG_SET!,
  Content: { Simple: {
    Subject: { Data: 'chain-test: SES→SNS→webhook' },
    Body: { Text: { Data: 'Event chain verification.' } },
  } },
}))
console.log('SENT ok — MessageId:', res.MessageId)
```

Resultado esperado em ~10-60s:

- Vercel logs: `POST /api/webhooks/ses` → 200.
- Banco: nova row em `webhook_events` (idempotency_key = SNS MessageId,
  event_type `delivered`).
- (O simulator não tem `newsletter_sends` correspondente, então o update da send
  é no-op — o que importa é a row em `webhook_events` provando a cadeia.)

Se continuar sem POST: SNS console → topic → aba **Subscriptions** → conferir
status **Confirmed**; e SES console → Configuration sets → `bythiago-marketing`
→ event destination habilitado.

## Hardening recomendado — `SNS_EXPECTED_TOPIC_ARN` (Vercel)

O webhook (route.ts) aceita qualquer mensagem SNS com assinatura válida quando
essa var está vazia (e emite warning no Sentry em prod). Setar no Vercel
(Production + Preview), projeto web:

```
SNS_EXPECTED_TOPIC_ARN=arn:aws:sns:sa-east-1:793477410088:ses-bythiago-events
```

Com a var setada, mensagens de qualquer outro tópico (mesmo validamente
assinadas por outra conta AWS) são rejeitadas com 403 `topic_arn_mismatch`.

## Recomendação (decidir depois) — desligar 'Clicks' (e talvez 'Opens') no SES

Contexto: o click-tracking do SES reescreve TODOS os links do e-mail para um
domínio de rastreio da AWS (double-wrap) — e os links da newsletter já passam
pelo nosso `go.*` (Links Engine), que rastreia clique com atribuição própria.
Resultado: clique conta duas vezes em pipelines diferentes, URL feia no hover e
ponto extra de falha/spam-score. Opens via pixel SES é menos problemático, mas
também é redundante se um dia migrarmos para pixel próprio.

Receita (console — NÃO executado, decisão do usuário):

1. AWS Console → **SES** (sa-east-1) → **Configuration sets** → `bythiago-marketing`.
2. Aba **Event destinations** → selecionar `ses-bythiago-marketing-events` → **Edit**.
3. No passo **Select event types**: desmarcar **Clicks** (e opcionalmente **Opens**).
   Manter: Hard bounces, Complaints, Deliveries.
4. **Next** até o fim → **Save changes**.

Efeito colateral a saber: desmarcar Clicks/Opens no event destination NÃO
desliga a reescrita de links/pixel por si só — isso é controlado pelo
**tracking options** do configuration set (Configuration set → aba
**Tracking** → custom/open/click tracking). Para parar o double-wrap dos
links, desabilitar **click tracking** lá também. Sem eventos `clicked` do SES,
`newsletter_sends.clicked_at` passa a depender 100% do `go.*` (que já grava em
`link_clicks`); o status `clicked` da send deixa de ser preenchido pelo webhook.
