export const DEFAULT_TEMPLATE_ID = 'default';

export const DEFAULT_TEMPLATE_NAME = 'Default Mihomo';

export const DEFAULT_MIHOMO_TEMPLATE = `mixed-port: 7890
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
    proxies: "{{PROXY_NAMES}}"
  - name: AUTO
    type: url-test
    proxies: "{{PROXY_NAMES}}"
    url: https://www.gstatic.com/generate_204
    interval: 300

rules:
  - MATCH,PROXY
`;

export const MINIMAL_MIHOMO_TEMPLATE = `mixed-port: 7890
allow-lan: false
mode: rule
log-level: warning

proxies: "{{PROXIES}}"

proxy-groups:
  - name: PROXY
    type: select
    proxies: "{{PROXY_NAMES}}"

rules:
  - MATCH,PROXY
`;

export const ALPHA_XHTTP_MIHOMO_TEMPLATE = `mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
ipv6: true
unified-delay: true
tcp-concurrent: true
global-client-fingerprint: chrome

profile:
  store-selected: true
  store-fake-ip: true

sniffer:
  enable: true
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
  nameserver:
    - https://1.1.1.1/dns-query
    - https://8.8.8.8/dns-query

proxies: "{{PROXIES}}"

proxy-groups:
  - name: PROXY
    type: select
    proxies: "{{PROXY_NAMES}}"
  - name: AUTO
    type: url-test
    proxies: "{{PROXY_NAMES}}"
    url: https://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
  - name: FALLBACK
    type: fallback
    proxies: "{{PROXY_NAMES}}"
    url: https://www.gstatic.com/generate_204
    interval: 300

rules:
  - DOMAIN-SUFFIX,local,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - MATCH,PROXY
`;

export const LAN_DASHBOARD_MIHOMO_TEMPLATE = `mixed-port: 7890
allow-lan: true
bind-address: "*"
mode: rule
log-level: info
external-controller: 127.0.0.1:9090
unified-delay: true

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
    proxies: "{{PROXY_NAMES}}"
  - name: AUTO
    type: url-test
    proxies: "{{PROXY_NAMES}}"
    url: https://www.gstatic.com/generate_204
    interval: 300

rules:
  - IP-CIDR,10.0.0.0/8,DIRECT,no-resolve
  - IP-CIDR,172.16.0.0/12,DIRECT,no-resolve
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - MATCH,PROXY
`;

export const BUILTIN_MIHOMO_TEMPLATES = [
    {
        id: DEFAULT_TEMPLATE_ID,
        name: DEFAULT_TEMPLATE_NAME,
        content: DEFAULT_MIHOMO_TEMPLATE
    },
    {
        id: 'minimal',
        name: 'Minimal Manual Select',
        content: MINIMAL_MIHOMO_TEMPLATE
    },
    {
        id: 'alpha-xhttp',
        name: 'Mihomo Alpha XHTTP/ECH',
        content: ALPHA_XHTTP_MIHOMO_TEMPLATE
    },
    {
        id: 'lan-dashboard',
        name: 'LAN Dashboard',
        content: LAN_DASHBOARD_MIHOMO_TEMPLATE
    }
];
