export const DEFAULT_TEMPLATE_ID = 'android-phone';

export const ANDROID_PHONE_TEMPLATE = `mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
ipv6: true
unified-delay: true
tcp-concurrent: true
geodata-mode: true
global-client-fingerprint: chrome

profile:
  store-selected: true
  store-fake-ip: true

tun:
  enable: true
  stack: mixed
  auto-route: true
  strict-route: true
  auto-detect-interface: true
  dns-hijack:
    - any:53

sniffer:
  enable: true
  force-dns-mapping: true
  parse-pure-ip: true
  sniff:
    HTTP:
      ports:
        - 80
        - 8080-8880
      override-destination: true
    TLS:
      ports:
        - 443
        - 8443
    QUIC:
      ports:
        - 443
        - 8443

dns:
  enable: true
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - localhost.ptlogin2.qq.com
  nameserver:
    - https://1.1.1.1/dns-query
    - https://8.8.8.8/dns-query
  fallback:
    - https://dns.google/dns-query
    - https://cloudflare-dns.com/dns-query

rule-providers:
  pt-direct:
    type: http
    behavior: domain
    format: text
    path: ./ruleset/pt-direct.list
    url: https://github.com/milikii/sing-box-geosite/raw/refs/heads/main/pt.list
    interval: 86400

proxies: "{{PROXIES}}"

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - AUTO
      - US
      - JP
      - DIRECT
  - name: AUTO
    type: url-test
    proxies: "{{PUBLIC_PROXY_NAMES}}"
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
  - name: US
    type: select
    proxies: "{{US_PROXY_NAMES}}"
  - name: JP
    type: select
    proxies: "{{JP_PROXY_NAMES}}"
  - name: NAS
    type: select
    proxies: "{{NAS_PROXY_NAMES}}"
  - name: FCM
    type: select
    proxies:
      - PROXY
      - AUTO
      - US
      - JP
      - DIRECT

rules:
  - DOMAIN-SUFFIX,lan,NAS
  - DOMAIN-SUFFIX,local,NAS
  - IP-CIDR,10.0.0.0/8,NAS,no-resolve
  - IP-CIDR,172.16.0.0/12,NAS,no-resolve
  - IP-CIDR,192.168.0.0/16,NAS,no-resolve
  - IP-CIDR6,fd00::/8,NAS,no-resolve
  - IP-CIDR6,fe80::/10,NAS,no-resolve
  - DOMAIN,mtalk.google.com,FCM
  - DOMAIN,alt1-mtalk.google.com,FCM
  - DOMAIN,alt2-mtalk.google.com,FCM
  - DOMAIN,alt3-mtalk.google.com,FCM
  - DOMAIN,alt4-mtalk.google.com,FCM
  - DOMAIN,alt5-mtalk.google.com,FCM
  - DOMAIN,alt6-mtalk.google.com,FCM
  - DOMAIN,alt7-mtalk.google.com,FCM
  - DOMAIN,alt8-mtalk.google.com,FCM
  - IP-CIDR,108.177.125.188/32,FCM,no-resolve
  - IP-CIDR,142.250.10.188/32,FCM,no-resolve
  - IP-CIDR,142.250.31.188/32,FCM,no-resolve
  - IP-CIDR,142.250.4.188/32,FCM,no-resolve
  - IP-CIDR,142.250.96.188/32,FCM,no-resolve
  - IP-CIDR,172.217.194.188/32,FCM,no-resolve
  - IP-CIDR,172.217.218.188/32,FCM,no-resolve
  - IP-CIDR,172.217.219.188/32,FCM,no-resolve
  - IP-CIDR,172.253.122.188/32,FCM,no-resolve
  - IP-CIDR,172.253.63.188/32,FCM,no-resolve
  - IP-CIDR,173.194.175.188/32,FCM,no-resolve
  - IP-CIDR,173.194.218.188/32,FCM,no-resolve
  - IP-CIDR,209.85.233.188/32,FCM,no-resolve
  - IP-CIDR,64.233.177.188/32,FCM,no-resolve
  - IP-CIDR,64.233.186.188/32,FCM,no-resolve
  - IP-CIDR,64.233.187.188/32,FCM,no-resolve
  - IP-CIDR,64.233.188.188/32,FCM,no-resolve
  - IP-CIDR,64.233.189.188/32,FCM,no-resolve
  - IP-CIDR,74.125.127.188/32,FCM,no-resolve
  - IP-CIDR,74.125.137.188/32,FCM,no-resolve
  - IP-CIDR,74.125.203.188/32,FCM,no-resolve
  - IP-CIDR,74.125.204.188/32,FCM,no-resolve
  - IP-CIDR,74.125.206.188/32,FCM,no-resolve
  - IP-CIDR,74.125.23.188/32,FCM,no-resolve
  - IP-CIDR,74.125.24.188/32,FCM,no-resolve
  - IP-CIDR,74.125.28.188/32,FCM,no-resolve
  - RULE-SET,pt-direct,DIRECT
  - DOMAIN-SUFFIX,jp,JP
  - DOMAIN-SUFFIX,co.jp,JP
  - DOMAIN-SUFFIX,ne.jp,JP
  - DOMAIN-SUFFIX,or.jp,JP
  - DOMAIN-SUFFIX,go.jp,JP
  - DOMAIN-SUFFIX,ac.jp,JP
  - DOMAIN-SUFFIX,ed.jp,JP
  - DOMAIN-SUFFIX,abema.tv,JP
  - DOMAIN-SUFFIX,dmm.com,JP
  - DOMAIN-SUFFIX,niconico.com,JP
  - DOMAIN-SUFFIX,nicovideo.jp,JP
  - DOMAIN-SUFFIX,tver.jp,JP
  - DOMAIN-SUFFIX,radiko.jp,JP
  - DOMAIN-SUFFIX,pixiv.net,JP
  - DOMAIN-SUFFIX,mercari.com,JP
  - DOMAIN-SUFFIX,line.me,JP
  - GEOSITE,geolocation-jp,JP
  - GEOSITE,cn,DIRECT
  - GEOIP,CN,DIRECT,no-resolve
  - MATCH,PROXY
`;

export const WINDOWS_TEMPLATE = `mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
ipv6: true
unified-delay: true
tcp-concurrent: true
geodata-mode: true
global-client-fingerprint: chrome

profile:
  store-selected: true
  store-fake-ip: true

tun:
  enable: true
  stack: mixed
  auto-route: true
  strict-route: true
  auto-detect-interface: true
  dns-hijack:
    - any:53

sniffer:
  enable: true
  force-dns-mapping: true
  parse-pure-ip: true
  sniff:
    HTTP:
      ports:
        - 80
        - 8080-8880
      override-destination: true
    TLS:
      ports:
        - 443
        - 8443
    QUIC:
      ports:
        - 443
        - 8443

dns:
  enable: true
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - localhost.ptlogin2.qq.com
  nameserver:
    - https://1.1.1.1/dns-query
    - https://8.8.8.8/dns-query
  fallback:
    - https://dns.google/dns-query
    - https://cloudflare-dns.com/dns-query

rule-providers:
  pt-direct:
    type: http
    behavior: domain
    format: text
    path: ./ruleset/pt-direct.list
    url: https://github.com/milikii/sing-box-geosite/raw/refs/heads/main/pt.list
    interval: 86400

proxies: "{{PROXIES}}"

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - AUTO
      - US
      - JP
      - DIRECT
  - name: AUTO
    type: url-test
    proxies: "{{PUBLIC_PROXY_NAMES}}"
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
  - name: US
    type: select
    proxies: "{{US_PROXY_NAMES}}"
  - name: JP
    type: select
    proxies: "{{JP_PROXY_NAMES}}"
  - name: FCM
    type: select
    proxies:
      - PROXY
      - AUTO
      - US
      - JP
      - DIRECT

rules:
  - DOMAIN-SUFFIX,lan,DIRECT
  - DOMAIN-SUFFIX,local,DIRECT
  - GEOIP,private,DIRECT,no-resolve
  - DOMAIN,mtalk.google.com,FCM
  - DOMAIN,alt1-mtalk.google.com,FCM
  - DOMAIN,alt2-mtalk.google.com,FCM
  - DOMAIN,alt3-mtalk.google.com,FCM
  - DOMAIN,alt4-mtalk.google.com,FCM
  - DOMAIN,alt5-mtalk.google.com,FCM
  - DOMAIN,alt6-mtalk.google.com,FCM
  - DOMAIN,alt7-mtalk.google.com,FCM
  - DOMAIN,alt8-mtalk.google.com,FCM
  - IP-CIDR,108.177.125.188/32,FCM,no-resolve
  - IP-CIDR,142.250.10.188/32,FCM,no-resolve
  - IP-CIDR,142.250.31.188/32,FCM,no-resolve
  - IP-CIDR,142.250.4.188/32,FCM,no-resolve
  - IP-CIDR,142.250.96.188/32,FCM,no-resolve
  - IP-CIDR,172.217.194.188/32,FCM,no-resolve
  - IP-CIDR,172.217.218.188/32,FCM,no-resolve
  - IP-CIDR,172.217.219.188/32,FCM,no-resolve
  - IP-CIDR,172.253.122.188/32,FCM,no-resolve
  - IP-CIDR,172.253.63.188/32,FCM,no-resolve
  - IP-CIDR,173.194.175.188/32,FCM,no-resolve
  - IP-CIDR,173.194.218.188/32,FCM,no-resolve
  - IP-CIDR,209.85.233.188/32,FCM,no-resolve
  - IP-CIDR,64.233.177.188/32,FCM,no-resolve
  - IP-CIDR,64.233.186.188/32,FCM,no-resolve
  - IP-CIDR,64.233.187.188/32,FCM,no-resolve
  - IP-CIDR,64.233.188.188/32,FCM,no-resolve
  - IP-CIDR,64.233.189.188/32,FCM,no-resolve
  - IP-CIDR,74.125.127.188/32,FCM,no-resolve
  - IP-CIDR,74.125.137.188/32,FCM,no-resolve
  - IP-CIDR,74.125.203.188/32,FCM,no-resolve
  - IP-CIDR,74.125.204.188/32,FCM,no-resolve
  - IP-CIDR,74.125.206.188/32,FCM,no-resolve
  - IP-CIDR,74.125.23.188/32,FCM,no-resolve
  - IP-CIDR,74.125.24.188/32,FCM,no-resolve
  - IP-CIDR,74.125.28.188/32,FCM,no-resolve
  - RULE-SET,pt-direct,DIRECT
  - DOMAIN-SUFFIX,jp,JP
  - DOMAIN-SUFFIX,co.jp,JP
  - DOMAIN-SUFFIX,ne.jp,JP
  - DOMAIN-SUFFIX,or.jp,JP
  - DOMAIN-SUFFIX,go.jp,JP
  - DOMAIN-SUFFIX,ac.jp,JP
  - DOMAIN-SUFFIX,ed.jp,JP
  - DOMAIN-SUFFIX,abema.tv,JP
  - DOMAIN-SUFFIX,dmm.com,JP
  - DOMAIN-SUFFIX,niconico.com,JP
  - DOMAIN-SUFFIX,nicovideo.jp,JP
  - DOMAIN-SUFFIX,tver.jp,JP
  - DOMAIN-SUFFIX,radiko.jp,JP
  - DOMAIN-SUFFIX,pixiv.net,JP
  - DOMAIN-SUFFIX,mercari.com,JP
  - DOMAIN-SUFFIX,line.me,JP
  - GEOSITE,geolocation-jp,JP
  - GEOSITE,cn,DIRECT
  - GEOIP,CN,DIRECT,no-resolve
  - MATCH,PROXY
`;

export const NAS_BYPASS_ROUTER_TEMPLATE = `mixed-port: 7890
redir-port: 7892
tproxy-port: 7893
allow-lan: true
bind-address: "*"
mode: rule
log-level: info
ipv6: true
unified-delay: true
tcp-concurrent: true
geodata-mode: true
global-client-fingerprint: chrome

profile:
  store-selected: true
  store-fake-ip: true

sniffer:
  enable: true
  force-dns-mapping: true
  parse-pure-ip: true
  sniff:
    HTTP:
      ports:
        - 80
        - 8080-8880
      override-destination: true
    TLS:
      ports:
        - 443
        - 8443
    QUIC:
      ports:
        - 443
        - 8443

dns:
  enable: true
  listen: 0.0.0.0:53
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - localhost.ptlogin2.qq.com
  nameserver:
    - https://1.1.1.1/dns-query
    - https://8.8.8.8/dns-query
  fallback:
    - https://dns.google/dns-query
    - https://cloudflare-dns.com/dns-query

rule-providers:
  pt-direct:
    type: http
    behavior: domain
    format: text
    path: ./ruleset/pt-direct.list
    url: https://github.com/milikii/sing-box-geosite/raw/refs/heads/main/pt.list
    interval: 86400

proxies: "{{PROXIES}}"

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - AUTO
      - US
      - JP
      - DIRECT
  - name: AUTO
    type: url-test
    proxies: "{{PUBLIC_PROXY_NAMES}}"
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
  - name: US
    type: select
    proxies: "{{US_PROXY_NAMES}}"
  - name: JP
    type: select
    proxies: "{{JP_PROXY_NAMES}}"
  - name: FCM
    type: select
    proxies:
      - PROXY
      - AUTO
      - US
      - JP
      - DIRECT

rules:
  - DOMAIN-SUFFIX,lan,DIRECT
  - DOMAIN-SUFFIX,local,DIRECT
  - GEOIP,private,DIRECT,no-resolve
  - DOMAIN,mtalk.google.com,FCM
  - DOMAIN,alt1-mtalk.google.com,FCM
  - DOMAIN,alt2-mtalk.google.com,FCM
  - DOMAIN,alt3-mtalk.google.com,FCM
  - DOMAIN,alt4-mtalk.google.com,FCM
  - DOMAIN,alt5-mtalk.google.com,FCM
  - DOMAIN,alt6-mtalk.google.com,FCM
  - DOMAIN,alt7-mtalk.google.com,FCM
  - DOMAIN,alt8-mtalk.google.com,FCM
  - IP-CIDR,108.177.125.188/32,FCM,no-resolve
  - IP-CIDR,142.250.10.188/32,FCM,no-resolve
  - IP-CIDR,142.250.31.188/32,FCM,no-resolve
  - IP-CIDR,142.250.4.188/32,FCM,no-resolve
  - IP-CIDR,142.250.96.188/32,FCM,no-resolve
  - IP-CIDR,172.217.194.188/32,FCM,no-resolve
  - IP-CIDR,172.217.218.188/32,FCM,no-resolve
  - IP-CIDR,172.217.219.188/32,FCM,no-resolve
  - IP-CIDR,172.253.122.188/32,FCM,no-resolve
  - IP-CIDR,172.253.63.188/32,FCM,no-resolve
  - IP-CIDR,173.194.175.188/32,FCM,no-resolve
  - IP-CIDR,173.194.218.188/32,FCM,no-resolve
  - IP-CIDR,209.85.233.188/32,FCM,no-resolve
  - IP-CIDR,64.233.177.188/32,FCM,no-resolve
  - IP-CIDR,64.233.186.188/32,FCM,no-resolve
  - IP-CIDR,64.233.187.188/32,FCM,no-resolve
  - IP-CIDR,64.233.188.188/32,FCM,no-resolve
  - IP-CIDR,64.233.189.188/32,FCM,no-resolve
  - IP-CIDR,74.125.127.188/32,FCM,no-resolve
  - IP-CIDR,74.125.137.188/32,FCM,no-resolve
  - IP-CIDR,74.125.203.188/32,FCM,no-resolve
  - IP-CIDR,74.125.204.188/32,FCM,no-resolve
  - IP-CIDR,74.125.206.188/32,FCM,no-resolve
  - IP-CIDR,74.125.23.188/32,FCM,no-resolve
  - IP-CIDR,74.125.24.188/32,FCM,no-resolve
  - IP-CIDR,74.125.28.188/32,FCM,no-resolve
  - RULE-SET,pt-direct,DIRECT
  - DOMAIN-SUFFIX,jp,JP
  - DOMAIN-SUFFIX,co.jp,JP
  - DOMAIN-SUFFIX,ne.jp,JP
  - DOMAIN-SUFFIX,or.jp,JP
  - DOMAIN-SUFFIX,go.jp,JP
  - DOMAIN-SUFFIX,ac.jp,JP
  - DOMAIN-SUFFIX,ed.jp,JP
  - DOMAIN-SUFFIX,abema.tv,JP
  - DOMAIN-SUFFIX,dmm.com,JP
  - DOMAIN-SUFFIX,niconico.com,JP
  - DOMAIN-SUFFIX,nicovideo.jp,JP
  - DOMAIN-SUFFIX,tver.jp,JP
  - DOMAIN-SUFFIX,radiko.jp,JP
  - DOMAIN-SUFFIX,pixiv.net,JP
  - DOMAIN-SUFFIX,mercari.com,JP
  - DOMAIN-SUFFIX,line.me,JP
  - GEOSITE,geolocation-jp,JP
  - GEOSITE,cn,DIRECT
  - GEOIP,CN,DIRECT,no-resolve
  - MATCH,PROXY
`;

export const BUILTIN_MIHOMO_TEMPLATES = [
    {
        id: DEFAULT_TEMPLATE_ID,
        name: 'Android Phone',
        content: ANDROID_PHONE_TEMPLATE
    },
    {
        id: 'windows',
        name: 'Windows',
        content: WINDOWS_TEMPLATE
    },
    {
        id: 'nas-bypass-router',
        name: 'NAS Bypass Router',
        content: NAS_BYPASS_ROUTER_TEMPLATE
    }
];
