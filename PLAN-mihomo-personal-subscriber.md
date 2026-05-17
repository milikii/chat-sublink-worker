# /autoplan: Personal Mihomo Remote Subscriber

Captured: 2026-05-17
Branch: main
Repo: milikii/chat-sublink-worker
Base branch: main

> Restore note: no prior plan file existed. This file is the first explicit plan state for the requested conversion.

## Plan Summary

Convert this fork from a multi-client subscription converter into a private, single-user Mihomo YAML generator. The new product has one job: accept a few nodes on demand, apply a user-editable Mihomo template, and return a Mihomo config without storing node links, subscription URLs, or generated node data on the server.

The key product decision is to keep storage only for durable admin state: templates and auth/session metadata. Node input is request-scoped only.

## User Request

- Custom config templates.
- Web UI can edit the entire template file content.
- No retained node information.
- No retained subscription information.
- No scheduled subscription updates.
- User changes nodes only every few months.
- On demand: add a few nodes, choose a template, pull/generate once.
- Cloud side must not persist node/subscription data.
- Remove Sing-box and Surge template support.
- Everything targets Mihomo.
- Target recent alpha Mihomo features: VLESS xhttp, ECH, XTLS encryption/padding, xudp.
- Add login authentication.

## External Facts Checked

- MetaCubeX/mihomo GitHub releases show `Prerelease-Alpha` as a rolling pre-release, with the release page stating it keeps only the latest alpha version. The same page shows stable `v1.19.25` as latest stable on 2026-05-16 and alpha created on 2026-05-17 in the currently opened release view.
- Mihomo VLESS docs list `packet-encoding: xudp`, `encryption`, and `network: xhttp` support for VLESS.
- Mihomo transport docs list `xhttp-opts`, including `mode`, `x-padding-*`, `uplink-*`, `session-*`, `seq-*`, `reuse-settings`, and `download-settings`.
- Mihomo TLS docs list `ech-opts` and `reality-opts.support-x25519mlkem768`.

Sources:

- https://github.com/MetaCubeX/mihomo/releases
- https://wiki.metacubex.one/en/config/proxies/vless/
- https://wiki.metacubex.one/en/config/proxies/transport/
- https://wiki.metacubex.one/en/config/proxies/tls/
- https://github.com/MetaCubeX/Meta-Docs/blob/main/docs/startup/index.md

## Scope Decision

Build a stateless Mihomo config renderer, not a subscription manager.

In scope:

- `GET /` private web UI after login.
- `POST /auth/login`, `POST /auth/logout`, signed session cookie.
- Template editor backed by storage.
- `GET /api/templates`, `PUT /api/templates/:id`, `DELETE /api/templates/:id`.
- `POST /api/render` accepts transient node input and template id/content, returns YAML.
- Mihomo YAML output only.
- VLESS parser/output support for xhttp, ECH, xudp, encryption, x-padding, and current Mihomo alpha fields where documented.
- Tests proving nodes are never written to KV/Redis/Upstash/MemoryKV.

Out of scope:

- Sing-box output.
- Surge output.
- Xray base64 subscription output.
- Subconverter endpoint.
- Short links.
- Remote subscription fetching/provider auto-refresh.
- Scheduled updates.
- Storing generated config containing nodes.
- Running the Mihomo core binary in Cloudflare Worker or Vercel.
- Remote pull URL in MVP.

Important limitation:

Cloudflare Workers and Vercel serverless do not run the Mihomo core binary. This app should generate YAML for a Mihomo alpha client/core. If the requirement is to actually run `mihomo:Alpha` in the cloud, that is a separate VPS/Docker deployment, not this Worker app.

## What Already Exists

| Need | Existing code | Keep / Change |
|---|---|---|
| Hono app entry | `src/app/createApp.jsx` | Keep, heavily simplify routes |
| Web UI shell | `src/components/*` | Reuse shell, replace form |
| Mihomo YAML builder | `src/builders/ClashConfigBuilder.js` | Rename conceptually to Mihomo or create narrower renderer |
| YAML parsing/dumping | `js-yaml` | Keep |
| Protocol parsing | `src/parsers/*` | Keep subset, extend VLESS |
| KV abstraction | `src/adapters/kv/*` | Keep for templates only |
| Config storage | `src/services/configStorageService.js` | Replace or rewrite as template storage |
| Short links | `ShortLinkService`, `/shorten-v2`, `/b/:code`, etc. | Remove |
| Multi-client UI | `Form.jsx`, `formLogic.js` | Replace |
| i18n | `src/i18n/index.js` | Keep only needed Chinese/English labels or simplify |

## Architecture

```
Browser
  |
  | login, edit templates, paste nodes, render
  v
Hono app
  |
  +-- auth middleware
  |
  +-- TemplateStorageService
  |     |
  |     +-- KV / Redis / Upstash / Memory fallback
  |
  +-- MihomoRenderer
        |
        +-- ProxyParser subset
        +-- VLESS alpha field parser
        +-- template placeholder renderer
        +-- YAML validation

Mihomo client remote pull flow, deferred:

Mihomo -> GET /sub/:templateId?payload=<encrypted-nodes>&token=<read-token>
       -> server decrypts request payload in memory
       -> returns YAML with Cache-Control: no-store
       -> does not write nodes anywhere

This is not in the MVP. It needs a separate threat model because ciphertext URLs can still be logged and replayed.
```

## Data Flow

### Template edit flow

1. Admin logs in.
2. UI loads template list.
3. Admin edits raw Mihomo YAML template text.
4. UI validates by rendering with a sample node and parsing final YAML.
5. Server stores only template metadata and template content.

### One-shot render flow

1. Admin pastes node URIs or Mihomo proxy YAML.
2. UI submits `POST /api/render`.
3. Server parses nodes in memory.
4. Server renders selected template.
5. Server returns YAML.
6. No node content is written to KV, logs, localStorage, or server-side cache.

### Deferred remote pull flow

Not MVP. The safe first build is `POST /api/render` only.

Reasons:

1. Browser-side encryption with a server secret leaks the secret.
2. Server-side URL generation still sends node plaintext to the server once.
3. Ciphertext URLs can still appear in platform access logs and can be replayed unless signed with expiration and nonce state.
4. Mihomo pull endpoints are GET-oriented, which makes privacy harder than an authenticated UI POST.

If remote pull is required later, design it as a separate Phase G with signed, expiring, encrypted payload URLs and explicit log-retention warnings.

## Template Model

Use YAML templates parsed into structured objects. This preserves "edit the entire template file content" while avoiding unsafe string substitution.

Supported placeholders:

| Placeholder | Meaning |
|---|---|
| `{{PROXIES}}` | YAML scalar placeholder used as the complete value of `proxies` |
| `{{PROXY_NAMES}}` | YAML scalar placeholder used as the complete value of a `proxies` list |
| `{{PROXY_NAMES_INLINE}}` | Flow-style YAML list, e.g. `[A, B, C]` |
| `{{GENERATED_AT}}` | ISO timestamp |
| `{{TEMPLATE_NAME}}` | Selected template name |

Template validation rules:

- Must include `proxies: "{{PROXIES}}"`.
- Initial template YAML must parse before render.
- Final rendered YAML must contain `proxies` as an array.
- If `proxy-groups` reference generated nodes, use `{{PROXY_NAMES}}` or `{{PROXY_NAMES_INLINE}}`.
- Validation must reject templates that render empty `url-test` or `fallback` groups.
- Validation must reject proxy group references to missing proxy names or missing group names.
- Validation must reject duplicate proxy names and duplicate proxy group names.
- Renderer must parse YAML, replace complete placeholder nodes, validate the graph, then dump YAML. It must not perform regex or indentation-based string replacement.

Default template:

```yaml
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
unified-delay: true
tcp-concurrent: true

dns:
  enable: true
  ipv6: true
  enhanced-mode: fake-ip
  nameserver:
    - https://1.1.1.1/dns-query
    - https://8.8.8.8/dns-query

proxies: "{{PROXIES}}"

proxy-groups:
  - name: PROXY
    type: select
    proxies: {{PROXY_NAMES_INLINE}}
  - name: AUTO
    type: url-test
    proxies: {{PROXY_NAMES_INLINE}}
    url: https://www.gstatic.com/generate_204
    interval: 300

rules:
  - MATCH,PROXY
```

## Mihomo Alpha Field Support

The current code is not enough for the requested alpha target.

Needed parser/output changes:

- Preserve VLESS `encryption` from URI/query and YAML input.
- Preserve `packet-encoding` as Mihomo `packet-encoding`, including `xudp`.
- Preserve TLS `ech-opts.enable`, `ech-opts.config`, `ech-opts.query-server-name`.
- Preserve `reality-opts.support-x25519mlkem768`.
- Map VLESS `type=xhttp` to Mihomo `network: xhttp`.
- Emit `xhttp-opts` for documented fields:
  - `path`
  - `host`
  - `mode`
  - `headers`
  - `no-grpc-header`
  - `x-padding-bytes`
  - `x-padding-obfs-mode`
  - `x-padding-key`
  - `x-padding-header`
  - `x-padding-placement`
  - `x-padding-method`
  - `uplink-http-method`
  - `session-placement`
  - `session-key`
  - `seq-placement`
  - `seq-key`
  - `uplink-data-placement`
  - `uplink-data-key`
  - `uplink-chunk-size`
  - `sc-max-each-post-bytes`
  - `sc-min-posts-interval-ms`
  - `reuse-settings`
  - `download-settings`
- Pass through unknown but documented-looking Mihomo proxy fields only when source input is YAML. Do not blindly pass arbitrary URI params into output.

Recommended implementation:

- Add `src/parsers/protocols/vlessMihomoFields.js` for normalization.
- Add `src/builders/MihomoConfigRenderer.js` rather than keep expanding `ClashConfigBuilder`.
- Keep `ClashConfigBuilder` temporarily while tests migrate, then delete old builder paths in cleanup.

## Auth Design

Environment variables:

- `AUTH_SECRET`: signs session cookies.
- `ADMIN_USERNAME`: optional, default `admin`.
- `ADMIN_PASSWORD_SHA256`: SHA-256 hex of admin password.
- `SESSION_TTL_SECONDS`: default 86400.

Routes:

- `GET /login`
- `POST /auth/login`
- `POST /auth/logout`
- Protected UI and template/render APIs require valid session cookie.

Security requirements:

- Use constant-time comparisons for password/token hashes.
- Signed HttpOnly SameSite=Lax Secure cookies.
- `Cache-Control: no-store` on UI, render, login, and subscription responses.
- `Referrer-Policy: no-referrer`.
- Do not log raw node input, raw payload, or rendered YAML.
- Error messages must identify bad input without echoing secrets.

## UI Plan

This should be a private workbench, not a public landing page.

First screen after login:

- Left/top: template selector.
- Main editor tab: raw template YAML editor.
- Generate tab: node textarea, selected template, render button.
- Output panel: rendered YAML preview, copy, download.
- Remote pull URL controls are omitted in MVP.
- Validation panel: template status, node parse count, missing placeholders.

Expected states:

- Logged out.
- Loading templates.
- Empty templates.
- Template validation error.
- Node parse error.
- Render success.
- Copy/download success.
- Unauthorized/session expired.

## Implementation Phases

### Phase A: Cut product surface

- Rename constants from Sublink Worker to private Mihomo subscriber.
- Remove UI references to Sing-box, Surge, Xray, short links, subconverter.
- Remove or stop registering routes:
  - `/singbox`
  - `/surge`
  - `/xray`
  - `/subconverter`
  - `/shorten-v2`
  - `/s/:code`
  - `/b/:code`
  - `/c/:code`
  - `/x/:code`
  - `/resolve`
  - old `/config`
- Keep `/favicon.ico`.

### Phase B: Auth and template storage

- Add auth service and middleware.
- Add template storage service using fixed keys.
- Add template CRUD API.
- Add default template bootstrap if storage is empty.

### Phase C: Renderer

- Add `MihomoConfigRenderer`.
- Add placeholder renderer.
- Add final YAML validation.
- Add request-scoped node parser.
- Add `POST /api/render`.

### Phase C-hardening: Privacy allowlist

- Route allowlist: only `GET /`, `GET /login`, `POST /auth/login`, `POST /auth/logout`, template APIs, render API, static assets.
- KV write allowlist: only template keys and session metadata if sessions are server-side.
- Tests fail if node input reaches KV `put`.
- Tests fail if old routes return anything except 404.
- Tests fail if node textarea is written to localStorage.

### Phase D: Mihomo alpha support

- Extend VLESS parsing.
- Extend Mihomo proxy output.
- Add direct Mihomo YAML proxy input support.
- Add tests for xhttp, ECH, xudp, encryption padding.

### Phase E: UI replacement

- Replace `Form.jsx` and `formLogic.js` with private workbench UI.
- Keep Hono JSX and existing layout primitives only where useful.
- Ensure text does not overflow on mobile.
- Keep controls dense and operational.

### Phase F: Cleanup and docs

- Delete unused builders/parsers/configs after tests pass.
- Update README for private deployment.
- Add deployment env var documentation.
- Add privacy note: server does not persist nodes, but platform access logs may still record request metadata.

### Phase G: Remote pull, only if explicitly approved later

- Add `GET /sub/:templateId` only after a separate threat model.
- Use signed encrypted payloads with expiration.
- Document replay and log risks.
- Decide whether the privacy tradeoff is acceptable for your actual use.

## CEO Review

### Premise Challenge

| Premise | Evaluation | Decision |
|---|---|---|
| You need a remote subscriber | Mostly valid, but remote pull conflicts with "cloud never sees node data" unless payload is encrypted or generated client-side. | Support one-shot POST in MVP; defer pull URL. |
| No node retention is enough | Valid, but logs and URLs can still leak plaintext if nodes are in query params. | Never put plaintext node links in query params. |
| Mihomo only is better | Valid. It reduces maintenance and matches your actual use. | Remove other clients. |
| Latest alpha core support means this app runs alpha core | Likely not. This app should generate config for alpha. | Treat core runtime as out of scope unless you add VPS/Docker scope. |
| Template file must be fully editable | Valid. | Use raw template text plus placeholders. |

### Dream State

```
CURRENT
  Multi-client public-ish converter, stores configs/short links, fetches remote subscriptions.

THIS PLAN
  Private authenticated Mihomo YAML renderer, stores templates only, nodes are request-scoped.

12-MONTH IDEAL
  Tiny private control panel with template versions, encrypted stateless pull URLs, audited no-secret logging, and a clean deployment story.
```

### Alternatives

| Approach | Effort | Privacy | Remote pull | Recommendation |
|---|---:|---:|---:|---|
| Browser-only generator | Medium | Best | No | Good fallback, not enough for remote subscription. |
| Server render with POST only | Medium | Good | No | Implement as default one-shot mode. |
| Encrypted stateless pull URL | Higher | Medium | Yes | Defer until after MVP; it has replay/log risks. |
| Store nodes in KV with TTL | Low | Weak | Yes | Reject. It violates the core request. |

### NOT in Scope

- Node dashboards.
- Auto health checks.
- Provider auto-update.
- Public share links.
- User management beyond one admin.
- Multi-client output compatibility.

## Design Review

UI scope: yes.

Design score target: 8/10.

Main design risks:

- Existing UI is optimized for public conversion and many knobs. The new UI needs fewer but sharper controls.
- Template editing is high-risk because broken YAML can break the pulled subscription. Validation must be visible and immediate.
- Any future "generate remote URL" button must be gated behind Phase G and clearly warn about encrypted URL replay/log risk.

Design decisions:

- Use a two-tab workbench: `Generate` and `Templates`.
- Keep login separate and quiet.
- Use compact panels, not marketing hero content.
- Use icons for copy/download/save/delete.
- Do not show Sing-box/Surge/Xray anywhere.

Required states:

| State | User sees |
|---|---|
| Not logged in | Login form |
| No template | Default template creation prompt |
| Template invalid | YAML error and placeholder error |
| Nodes invalid | Line-specific parse failures |
| Rendered | YAML preview + copy/download |
| Pull URL created | URL plus privacy warning |
| Session expired | Redirect to login |

## Engineering Review

### Dependency Graph

```
createApp
  |
  +-- auth/session middleware
  |
  +-- TemplateStorageService
  |
  +-- MihomoConfigRenderer
        |
        +-- ProxyParser
        |     +-- vlessParser alpha extensions
        |     +-- ss/vmess/trojan/hysteria2/tuic parsers
        |
        +-- placeholderRenderer
        +-- js-yaml validation
```

### Main Engineering Findings

| Finding | Severity | Fix |
|---|---|---|
| Existing `/config` stores arbitrary config with generated ids and TTL. | High | Replace with fixed template storage only. |
| Existing short-link service stores full query strings. | Critical for privacy | Remove short links completely. |
| Existing remote subscription fetch stores provider URLs in output. | High | Remove provider mode and remote fetch from default flow. |
| Existing VLESS parser drops alpha fields. | High | Extend VLESS parser and renderer. |
| Existing UI saves node input in localStorage. | Critical for "no retained nodes" | Remove localStorage persistence for node textarea. |
| Query-string config generation can expose node links in logs. | Critical | Use POST for plaintext nodes; defer pull URLs. |

### Failure Modes Registry

| Failure | User impact | Prevention |
|---|---|---|
| Template renders invalid YAML | Mihomo refuses config | Render-then-parse validation before save and before response |
| Empty proxy group | Mihomo rejects config | Validate group members after render |
| Node input stored in browser localStorage | Node retention violates request | Do not persist node textarea |
| Node payload in URL plaintext | Platform logs expose nodes | No pull URL in MVP; Phase G must use signed encrypted payloads |
| Auth token leaked in Referer | Unauthorized access | no-referrer headers and no third-party links on app pages |
| Alpha field parser lags docs | New nodes silently lose fields | Pass direct YAML proxy objects through and test documented fields |
| KV missing on Cloudflare | Cannot save templates | Clear setup error; optional env default template fallback |

### Error & Rescue Registry

| Error | Response | Rescue |
|---|---|---|
| Missing auth config | 500 setup error | Show required env vars in README |
| Bad login | 401 | Generic message |
| Missing template | 404 | UI offers default template |
| Bad template placeholder | 400 | Line-level validation message |
| Bad node line | 400 | Return line number and protocol |
| KV unavailable | 503 | Explain template storage unavailable |

## DX Review

DX scope: yes, because deployment and env setup define whether this works.

TTHW target: under 10 minutes for Cloudflare Worker if KV and env vars are ready.

Developer journey:

| Stage | Expected |
|---|---|
| Clone | `git clone` fork |
| Install | `npm install` |
| Configure | set auth/template env vars |
| Dev | `npm run dev` |
| Login | open local URL and login |
| Edit template | save default template |
| Render | paste nodes and download YAML |
| Deploy | `wrangler deploy` |
| Pull | use Mihomo URL or downloaded YAML |

DX checklist:

- README has exact env var table.
- README has Cloudflare KV binding steps.
- README has one sample VLESS xhttp/ECH node and expected YAML excerpt.
- `npm test` covers renderer and auth.
- Error messages say problem, cause, fix.

## Test Plan

Artifact: `TEST-PLAN-mihomo-personal-subscriber.md`

Unit tests:

- `parseVless` preserves `encryption`.
- `parseVless` maps `packet-encoding=xudp`.
- `parseVless` maps `type=xhttp` and xhttp opts.
- `parseVless` maps ECH opts.
- `MihomoConfigRenderer` injects proxies and names into template placeholders.
- Renderer rejects missing `{{PROXIES}}`.
- Renderer rejects invalid final YAML.
- Renderer rejects empty `url-test` and `fallback` groups.
- Auth hash compare accepts correct password and rejects wrong password.
- Phase G, if approved later: encrypted payload decrypt rejects tampering.

Route tests:

- Unauthenticated UI redirects to `/login`.
- Template API requires session.
- Render API requires session.
- Render API returns `Cache-Control: no-store`.
- Render API does not write node input to KV.
- Route allowlist rejects `/sub` during MVP.

Regression tests:

- No route exists for `/singbox`, `/surge`, `/xray`, `/subconverter`, `/shorten-v2`.
- UI no longer stores node textarea in localStorage.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | CEO | Narrow product to Mihomo only | Mechanical | DRY / explicit | User does not need other clients; removing them reduces privacy and maintenance surface. | Keep Sing-box/Surge/Xray |
| 2 | CEO | Store templates only, never nodes | Mechanical | Completeness | This is the core privacy requirement. | TTL node storage |
| 3 | CEO | Defer encrypted stateless pull URL out of MVP | User Challenge | Completeness | It reconciles remote subscription with no server-side node persistence only partially; URL logging and replay risk need their own threat model. | Build `/sub` in MVP |
| 4 | Design | Replace public converter UI with private workbench | Mechanical | Explicit | Existing UI exposes irrelevant modes and persists input. | Patch existing form lightly |
| 5 | Eng | Add Mihomo renderer instead of overloading Clash builder | Taste | Explicit over clever | A narrow renderer is easier to reason about after deleting multi-client support. | Keep expanding ClashConfigBuilder |
| 6 | Eng | Keep KV abstraction for templates | Mechanical | Pragmatic | Web UI template edits need durable storage on Workers/Vercel. | Write repository files at runtime |
| 7 | Security | Use POST for plaintext node render | Mechanical | Completeness | Avoid node URLs in access logs and browser history. | GET query with plaintext config |
| 8 | DX | Document alpha target as generated config, not hosted core | Mechanical | Explicit | Workers cannot run the Mihomo binary. | Imply this app runs the core |
| 9 | Eng | Parse YAML templates and replace structured placeholders | Mechanical | Explicit | String replacement creates hidden invalid YAML and missed group reference errors. | Indentation-based raw text substitution |
| 10 | Eng | Add route and KV write allowlist tests before new features | Mechanical | Completeness | Any old route or storage path can violate the no-retention guarantee. | Trust route cleanup manually |

## Codex Outside Voice

Codex CLI ran a read-only review of this plan and returned three risks:

1. Remote pull design is self-contradictory for the privacy promise. Fix: remove `/sub` from MVP and handle remote pull as a later threat-modeled feature.
2. String placeholder templates are too fragile. Fix: parse YAML, allow placeholders only as complete YAML nodes, validate references, then dump final YAML.
3. Removing old product surface is itself a privacy-critical migration. Fix: start with route allowlist, KV write allowlist tests, and localStorage regression tests.

Actions taken:

- MVP now excludes `/sub`.
- Template renderer now uses structured YAML placeholder replacement.
- Phase C-hardening now comes before UI polish.

## User Challenge

### Challenge 1: "Remote subscriber" vs "cloud completely does not retain node info"

Your original direction is possible only if "does not retain" means "does not persist." The cloud must receive node data at render time unless rendering happens fully in the browser.

Recommended resolution:

- Default mode: POST render, no remote pull URL, best privacy.
- Remote pull mode is deferred. It can support Mihomo remote subscription later, but it needs a separate threat model.

If this recommendation is wrong, and you require the cloud to never receive node data at all, then the app must be browser-only for generation and cannot be a true remote subscription endpoint. If you require Mihomo remote pull in MVP, accept that the server receives node data at request time and that encrypted URLs may be logged/replayed.

### Challenge 2: "latest alpha core" wording

This app can generate config targeting Mihomo alpha. It should not try to run the Mihomo alpha core in Cloudflare Worker/Vercel.

If you want hosted Mihomo core, add a separate Docker/VPS plan using `metacubex/mihomo:Alpha`.

## Cross-Phase Themes

- Privacy is the main architecture driver. Short links, localStorage node persistence, provider URLs, and plaintext GET config all conflict with it.
- Mihomo alpha support should be handled in a narrow renderer and direct YAML pass-through, not by pretending older Clash conversion logic is enough.
- The UI should become smaller and more operational, not a patched version of the existing public converter.

## Final Recommended Build

Approve this plan with two explicit product choices:

1. Primary flow is one-shot POST render and download/copy.
2. Remote pull is not in MVP. It is a separate Phase G only if you explicitly accept the log/replay tradeoff.

After approval, implement in this order:

1. Auth + route cleanup.
2. Template storage + default template.
3. Mihomo renderer + alpha VLESS field support.
4. Privacy hardening tests.
5. Workbench UI.
6. README.

## GSTACK REVIEW REPORT

| Review | Status | Notes |
|---|---|---|
| CEO | DONE_WITH_CONCERNS | Main concern is remote pull vs zero node exposure. |
| Design | DONE | Private workbench design is clear. |
| Eng | DONE_WITH_CONCERNS | Remote pull removed from MVP after outside voice review. |
| DX | DONE | Deployment docs and env vars are required for success. |
| Dual voices | CODEX_ONLY | Codex CLI ran read-only and found 3 high-risk issues; plan was revised. Claude subagent was not available in this environment. |
