# Deferred Work

## Phase G: Remote Mihomo Pull

- Decide whether remote pull is required after the POST render MVP works.
- Threat-model signed encrypted payload URLs.
- Document platform access-log and replay risk.
- Only then consider `GET /sub/:templateId`.

## Hosted Mihomo Core

- If the goal changes from "generate alpha-compatible config" to "run Mihomo alpha in the cloud," create a separate Docker/VPS plan.
- Candidate image family: MetaCubeX/mihomo alpha releases.

## Optional Polish

- Template version history.
- Import/export templates.
- Browser-only render mode for maximum privacy.
- E2E browser QA after implementation.
