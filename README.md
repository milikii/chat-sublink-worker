# Chat Sublink Worker

私有的一次性 Mihomo 配置生成器。项目只面向个人 Mihomo 配置渲染，不再保留多客户端订阅转换器的公开入口。

## 目标

- 登录后进入 WebUI。
- 在 WebUI 编辑完整 Mihomo YAML 模板。
- 每次需要配置时，临时粘贴节点，点击生成一次性下载链接。
- 不生成可复用订阅链接，不保留节点，不保留订阅 URL，不做定时更新。
- 模板保存在 KV；`POST /api/render` 不写入节点和生成结果。WebUI 使用的 `POST /api/render-link` 会把生成后的 YAML 临时写入 KV，默认 10 分钟内必须首次访问；首次访问后默认保留 60 秒重试窗口，方便 Mihomo 客户端断线重试，之后失效。
- 支持 VLESS xhttp、`packet-encoding: xudp`、ECH、VLESS encryption、xhttp padding 等 Mihomo alpha 字段的透传/渲染。

## 支持范围

输入支持两种形式：

- 每行一个节点 URI：`ss://`、`vmess://`、`vless://`、`trojan://`、`hysteria2://`、`tuic://`
- 直接粘贴 Mihomo `proxies` YAML 数组，或包含 `proxies:` 的 Mihomo YAML

模板必须包含结构化占位符：

```yaml
proxies: "{{PROXIES}}"
proxy-groups:
  - name: PROXY
    type: select
    proxies: "{{PROXY_NAMES}}"
```

`{{PROXIES}}` 会替换成完整节点对象数组，`{{PROXY_NAMES}}` 会替换成节点名数组。

兼容写法：

- `proxies: []` 或省略 `proxies` 时，会自动注入本次节点。
- `{{PROXIES}}`、`{{PROXY_NAMES}}` 等占位符可以不加引号。
- `proxies` 里已有真实静态节点时，会保留这些节点并合并本次临时节点。
- 如果误把 `type: select` 写在 `proxies` 里，生成器会把它转成 `proxy-groups`；其中 `{{SUBSCRIBED_PROXIES}}` 会替换成本次临时节点名。
- `prepend-proxies` 可用于模板内预置本机私有节点，生成后会合并到 `proxies` 并移除 helper 字段。
- `prepend-proxy-groups` 配合 `proxy-groups: "{{PROXY_GROUPS}}"` 可预置分组，生成时会自动把美国、日本、NAS/回家、自动测速分组补入对应节点。

内置模板：

- `android-phone`: 安卓手机模板，启用 TUN，局域网地址走 `NAS` 分组，`NAS` 分组会自动匹配节点名包含 `NAS` / `HOME` / `家庭` / `局域网` 的节点，并保留 `DIRECT` 兜底。
- `windows`: Windows 模板，启用 TUN，局域网直连。
- `nas-bypass-router`: NAS 旁路由模板，开启 `mixed-port` / `redir-port` / `tproxy-port` / LAN DNS，不启用 TUN，不主动接管宿主机网络。

节点名分组占位符：

- `{{PUBLIC_PROXY_NAMES}}`: 排除 NAS/Home 节点后的普通代理节点。
- `{{US_PROXY_NAMES}}`: 自动匹配美国节点；没有匹配时回落到普通代理节点。
- `{{JP_PROXY_NAMES}}`: 自动匹配日本节点；没有匹配时回落到普通代理节点。
- `{{NAS_PROXY_NAMES}}`: 自动匹配 NAS/Home 节点，并追加 `DIRECT` 兜底。

内置分流：

- PT 域名列表 `https://github.com/milikii/sing-box-geosite/raw/refs/heads/main/pt.list` 直连。
- FCM 域名和 IP 走 `FCM` 分组，默认代理。
- `.jp` / `co.jp` / 常见日本站点和 `GEOSITE,geolocation-jp` 走 `JP` 分组。
- 中国域名/IP 直连，其余全部走 `PROXY`。

## 环境变量

必须配置：

- `AUTH_SECRET`: session 签名密钥，建议 32 字节以上随机字符串。
- `ADMIN_USERNAME`: 管理员用户名，默认可用 `admin`。
- `ADMIN_PASSWORD_SHA256`: 管理员密码的 SHA-256 hex。

可选：

- `SESSION_TTL_SECONDS`: 登录有效期，默认 86400 秒。
- `ONE_TIME_DOWNLOAD_TTL_SECONDS`: 一次性下载链接有效期，默认 600 秒，范围 60-3600 秒。
- `ONE_TIME_DOWNLOAD_RETRY_WINDOW_SECONDS`: 首次访问后的客户端重试窗口，默认 60 秒，范围 60-300 秒。
- `COOKIE_SECURE=true`: Node 运行时强制 Secure Cookie。

生成密码哈希：

```bash
node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode(process.argv[1])).then(h=>console.log([...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')))" "your-password"
```

Cloudflare Workers 配置示例：

```bash
wrangler secret put AUTH_SECRET
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD_SHA256
wrangler secret put SESSION_TTL_SECONDS
wrangler secret put ONE_TIME_DOWNLOAD_TTL_SECONDS
wrangler secret put ONE_TIME_DOWNLOAD_RETRY_WINDOW_SECONDS
```

## Cloudflare Workers 部署

本仓库的 Worker 名称是 `chat-sublink-worker`，KV binding 是 `SUBLINK_KV`。

首次部署建议按这个顺序：

```bash
npm install
npx wrangler login
npm run setup-kv
npm run deploy
```

部署后写入私密环境变量：

```bash
printf "your-random-auth-secret" | npx wrangler secret put AUTH_SECRET
printf "admin" | npx wrangler secret put ADMIN_USERNAME
printf "<sha256-hex>" | npx wrangler secret put ADMIN_PASSWORD_SHA256
printf "86400" | npx wrangler secret put SESSION_TTL_SECONDS
printf "600" | npx wrangler secret put ONE_TIME_DOWNLOAD_TTL_SECONDS
printf "60" | npx wrangler secret put ONE_TIME_DOWNLOAD_RETRY_WINDOW_SECONDS
```

如果使用 GitHub Actions 自动部署，需要在仓库 secrets 里配置：

- `CLOUDFLARE_API_TOKEN`
- `CF_ACCOUNT_ID`

Worker 的 `AUTH_SECRET`、`ADMIN_USERNAME`、`ADMIN_PASSWORD_SHA256`、`SESSION_TTL_SECONDS`、`ONE_TIME_DOWNLOAD_TTL_SECONDS`、`ONE_TIME_DOWNLOAD_RETRY_WINDOW_SECONDS` 仍建议用 `wrangler secret put` 写入 Cloudflare，不提交到仓库。

## 本地开发

```bash
npm install
npm test
npm run build
```

启动 Wrangler dev 时可以用临时变量：

```bash
npx wrangler dev --port 8787 \
  --var AUTH_SECRET:dev-secret \
  --var ADMIN_USERNAME:admin \
  --var ADMIN_PASSWORD_SHA256:<sha256-hex> \
  --var SESSION_TTL_SECONDS:86400 \
  --var ONE_TIME_DOWNLOAD_TTL_SECONDS:600 \
  --var ONE_TIME_DOWNLOAD_RETRY_WINDOW_SECONDS:60
```

打开 `http://127.0.0.1:8787`。

## 路由

- `GET /login`: 登录页
- `POST /auth/login`: 登录
- `POST /auth/logout`: 退出
- `GET /`: 私有 WebUI
- `GET /api/templates`: 模板列表
- `GET /api/templates/:id`: 读取模板
- `PUT /api/templates/:id`: 保存模板
- `DELETE /api/templates/:id`: 删除模板
- `POST /api/render`: 一次性渲染 Mihomo YAML
- `POST /api/render-link`: 生成一次性 YAML 下载链接
- `GET /download/:token.yaml`: 公开下载；必须在有效期内首次访问，首次访问后短时间允许客户端重试，随后失效

旧的 `/sub`、`/shorten-v2`、`/singbox`、`/surge`、`/xray`、`/subconverter` 等公开转换/短链路由已移除。

## License

MIT
