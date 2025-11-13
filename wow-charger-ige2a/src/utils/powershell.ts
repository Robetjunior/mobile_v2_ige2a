import { API_BASE, ensureApiKey } from '../services/http';

function esc(str: string): string {
  return String(str).replace(/`/g, '').replace(/"/g, '\"');
}

export async function buildRemoteStopPS(params: { chargeBoxId?: string; transactionId: number }): Promise<string> {
  const api = API_BASE;
  const key = await ensureApiKey().catch(() => '');
  const cb = params.chargeBoxId ? esc(params.chargeBoxId) : '';
  const tx = Number(params.transactionId);
  const hasCb = !!cb;
  const body = hasCb
    ? `$body=@{ chargeBoxId='${cb}'; transactionId=${tx} } | ConvertTo-Json`
    : `$body=@{ transactionId=${tx} } | ConvertTo-Json`;
  return [`$api='${api}';`, `$key='${key}';`, hasCb ? `$cb='${cb}';` : '', `$tx=${tx};`, body, `Invoke-RestMethod -Method POST -Uri "$api/v1/commands/remoteStop" -Headers @{ 'X-API-Key'=$key } -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 6`]
    .filter(Boolean)
    .join(' ');
}

export async function buildRemoteStartPS(params: { chargeBoxId: string; idTag: string; connectorId: number }): Promise<string> {
  const api = API_BASE;
  const key = await ensureApiKey().catch(() => '');
  const cb = esc(params.chargeBoxId);
  const idTag = esc(params.idTag);
  const connectorId = Number(params.connectorId);
  const body = `$body=@{ chargeBoxId='${cb}'; idTag='${idTag}'; connectorId=${connectorId} } | ConvertTo-Json`;
  return [`$api='${api}';`, `$key='${key}';`, `$cb='${cb}';`, `$idTag='${idTag}';`, `$conn=${connectorId};`, body, `Invoke-RestMethod -Method POST -Uri "$api/v1/commands/remoteStart" -Headers @{ 'X-API-Key'=$key } -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 6`]
    .join(' ');
}

export async function buildActiveSessionPS(params: { chargeBoxId: string }): Promise<string> {
  const api = API_BASE;
  const key = await ensureApiKey().catch(() => '');
  const cb = esc(params.chargeBoxId);
  return [`$api='${api}';`, `$key='${key}';`, `$cb='${cb}';`, `Invoke-RestMethod -Method GET -Uri "$api/v1/sessions/active/$cb" -Headers @{ 'X-API-Key'=$key } | ConvertTo-Json -Depth 6`]
    .join(' ');
}