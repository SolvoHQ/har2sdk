# har2sdk

Paste a HAR (Chrome / Firefox network export) → typed TypeScript fetch SDK with LLM-named methods, resource grouping, and auth detection.

**Live: https://har2sdk.vercel.app/**

No signup. Free. Same shape as our two sibling tools:

- [jsontosdk](https://jsontosdk.vercel.app/) — paste JSON → typed SDK
- [dotenv2types](https://dotenv2types.vercel.app/) — paste .env → typed env + Zod
- **har2sdk** — paste HAR → typed fetch SDK ← you are here

## What's it good for

Wrapping a third-party API that has no published OpenAPI spec. Capture
traffic in DevTools (filter by API origin → right-click → Save all as HAR),
paste the HAR here, get back:

- `client.ts` — a typed SDK class with semantic method names
  (`client.users.create({...})`, not `request('POST', '/v1/users', ...)`)
- `types.ts` — request and response interfaces
- `README.md` — three usage examples + auth notes

## Three examples

### 1. Wrapping an unofficial vendor API

HAR captured from `api.somesaas.com/v2/...` → SDK with `client.users.create()`,
`client.users.list()`, `client.messages.send()`, all typed from real payloads.

### 2. Generating a client for an internal API without OpenAPI

Run your e2e tests → save the HAR → paste → typed client your frontend can
import — kept in sync by re-pasting whenever the backend ships shape changes.

### 3. Bootstrapping an agent / scraping workflow

Browser through the target site once → HAR → typed SDK → call from a Claude
or Composio tool integration. Zero spec-reading.

## What we redact before upload

Before your HAR ever leaves the browser, we scan and replace these patterns
with `<REDACTED>` (the header NAMES are kept so the LLM can detect auth
shape, but VALUES are stripped):

- `Authorization: Bearer ...`
- `X-API-Key: ...`
- JWT-shaped values (`eyJ...`)
- AWS access key ids (`AKIA...`)
- Stripe-style live/test keys (`sk_live_...`, `sk_test_...`)

We also dedupe (one sample per `method + normalized path`), cap input at
50 KB / 50 unique endpoints, and never log paste content.

## Limits

- 50 KB or 50 unique endpoints per paste (whichever hits first; larger HARs are sampled)
- 20 generations / hour / IP (move to paid in v2 if anyone asks)
- Browser HAR v1.2 format (DevTools default)

## Repo layout

This repo is the public site. Built on Astro + Vercel + Anthropic Haiku 4.5,
plumbing mirrors `dotenv2types`. No npm package yet — paste output into
your repo directly.
