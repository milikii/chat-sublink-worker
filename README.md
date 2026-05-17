# Chat Sublink Worker

私有的一次性 Mihomo 配置生成器。项目只面向个人 Mihomo 配置渲染，不再保留多客户端订阅转换器的公开入口。

## 目标

- 登录后进入 WebUI。
- 在 WebUI 编辑完整 Mihomo YAML 模板。
- 每次需要配置时，临时粘贴节点，点击生成，服务端只在本次 `POST /api/render` 内处理。
- 不生成可复用订阅链接，不保留节点，不保留订阅 URL，不做定时更新。
- 模板保存在 KV；节点输入和生成结果不写入 KV，也不写入浏览器 `localStorage`。
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
```

如果使用 GitHub Actions 自动部署，需要在仓库 secrets 里配置：

- `CLOUDFLARE_API_TOKEN`
- `CF_ACCOUNT_ID`

Worker 的 `AUTH_SECRET`、`ADMIN_USERNAME`、`ADMIN_PASSWORD_SHA256`、`SESSION_TTL_SECONDS` 仍建议用 `wrangler secret put` 写入 Cloudflare，不提交到仓库。

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
  --var SESSION_TTL_SECONDS:86400
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

旧的 `/sub`、`/shorten-v2`、`/singbox`、`/surge`、`/xray`、`/subconverter` 等公开转换/短链路由已移除。

## License

MIT
