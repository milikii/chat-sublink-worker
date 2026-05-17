# Test Plan: Personal Mihomo Subscriber

Captured: 2026-05-17
Plan: `PLAN-mihomo-personal-subscriber.md`

## Affected Pages and Routes

- `GET /`
- `GET /login`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /api/templates`
- `PUT /api/templates/:id`
- `DELETE /api/templates/:id`
- `POST /api/render`
- Static assets and favicon

Old routes must be removed or return 404:

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
- MVP `/sub`

## Key Interactions to Verify

- Login succeeds with correct password hash.
- Login fails with generic 401 for wrong password.
- Session cookie is signed, HttpOnly, SameSite=Lax, Secure in production.
- Template list loads only after login.
- Template save validates YAML before writing.
- Render accepts pasted node lines and selected template.
- Render returns Mihomo YAML with `Cache-Control: no-store`.
- Render response can be copied/downloaded.
- Node textarea is never persisted to localStorage.

## Unit Tests

- `parseVless` preserves `encryption`.
- `parseVless` maps `packet-encoding=xudp`.
- `parseVless` maps `type=xhttp` to Mihomo `network: xhttp`.
- `parseVless` maps documented `xhttp-opts`.
- `parseVless` maps `ech-opts`.
- `parseVless` maps `reality-opts.support-x25519mlkem768`.
- Direct Mihomo YAML proxy input passes through documented proxy fields.
- Template parser accepts `proxies: "{{PROXIES}}"`.
- Template parser rejects templates without `{{PROXIES}}`.
- Renderer rejects invalid initial YAML.
- Renderer rejects invalid final YAML.
- Renderer rejects duplicate proxy names.
- Renderer rejects duplicate group names.
- Renderer rejects groups referencing missing proxy or group names.
- Renderer rejects empty `url-test` and `fallback` groups.
- Auth hash compare accepts correct password and rejects wrong password.

## Route Tests

- Unauthenticated UI redirects to `/login`.
- Template API requires session.
- Render API requires session.
- Render API does not write node input to KV.
- Template API writes only template keys.
- Route allowlist rejects old product routes.
- Route allowlist rejects `/sub` in MVP.
- All render and auth responses use `Cache-Control: no-store`.
- Protected pages use `Referrer-Policy: no-referrer`.

## Privacy Regression Tests

- MemoryKV spy fails the test if any value written contains a pasted node hostname, UUID, password, or raw URI.
- Rendered YAML is never stored by template or session services.
- No localStorage write contains node textarea content.
- Errors returned to the client do not echo raw node input.
- Server logs in route tests do not include raw node input.

## Critical Paths

- Fresh deploy with empty template storage creates or offers a default template.
- Admin edits default template, saves, reloads page, and sees saved template.
- Admin pastes VLESS xhttp/ECH node, renders, and output contains Mihomo alpha fields.
- Admin pastes direct Mihomo YAML proxy list, renders, and output preserves supported fields.
- Admin logs out and cannot access template/render APIs.

## Edge Cases

- Empty node input.
- One invalid node among valid nodes.
- Empty template store.
- Missing KV binding.
- Missing `AUTH_SECRET`.
- Missing `ADMIN_PASSWORD_SHA256`.
- Very long node textarea.
- Template with YAML anchors.
- Template with comments, where comments may not survive render dump.
- Duplicate proxy names after parsing.
- Proxy group references generated names before generation.

## Not Tested in MVP

- Remote Mihomo pull URL.
- Scheduled updates.
- Running the Mihomo core.
- Sing-box, Surge, Xray, and subconverter compatibility.
