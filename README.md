# WOW Charger IGE2A – Me / Account

Implementação da tela **Me / Account** com React Native + Expo, estado com Zustand e navegação por Bottom Tabs.

## Rodar

1. `npm install` (caso necessário)
2. `npm start`
3. Abrir no Android/iOS com Expo Go.

## Ajustes de Tema/Strings

- Cores: `src/theme/colors.ts`
- Espaçamentos: `src/theme/spacing.ts`
- Tipografia: `src/theme/typography.ts`

## Deep Links

- `ev://me`, `ev://settings`, `ev://cards`, `ev://recently-used`
- Prefixo web (dev): `http://localhost:8087`

## Testes

Arquivos em `src/tests/`. Para executar, instale Jest/RTL:

```
npm i -D jest @testing-library/react-native @types/jest react-test-renderer
```

Configure conforme necessidade do seu ambiente de RN/Expo.

## Orchestrator API

- Base URL: defina `EXPO_PUBLIC_API_BASE_URL` (padrão `http://35.231.137.231:3000`).
- API Key: defina `EXPO_PUBLIC_API_KEY` para autenticar rotas sob `/v1/**`.
- Cabeçalhos: `X-API-Key` é injetado apenas quando a rota começa com `/v1/`; `Content-Type: application/json` em POST.

## Timeouts e Polling

- GET críticos: `10s`.
- POST: `15s`.
- Poll de comandos: intervalo `1500ms`, até `180s`.
- Captura de `transaction_id` após start: intervalo `1500ms`, até `30s`.

## Fluxos de Carga

- Start: `POST /v1/commands/remoteStart` → poll `GET /v1/commands/:id` aceitando `accepted` ou `completed` → ler sessão ativa `GET /v1/sessions/active/:chargeBoxId/detail` → fallback `GET /v1/debug/ocpp/last-tx/:chargeBoxId` se não houver `transaction_id` em 30s.
- Stop: descobrir `transaction_id` via `GET /v1/sessions/active/:chargeBoxId` → `POST /v1/commands/remoteStop` (inclua `chargeBoxId` quando possível) → poll `GET /v1/commands/:id` aceitando `accepted` ou `completed` (trate `idempotentDuplicate` como sucesso) → confirmar com `GET /v1/sessions/:transactionId` esperando `status: completed` e `duration_seconds`.

## Tratamento de Erros

- `401`: não autorizado — verifique `EXPO_PUBLIC_API_KEY`.
- `404` ou `409`: CP offline/não encontrado — mensagem clara e opção de tentar novamente.
- `timeout`: exibir prompt de retry.
- Idempotência: trate `idempotentDuplicate: true` no stop como sucesso.