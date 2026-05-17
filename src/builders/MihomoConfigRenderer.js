import yaml from 'js-yaml';
import { ProxyParser } from '../parsers/index.js';
import { deepCopy } from '../utils.js';
import { InvalidPayloadError } from '../services/errors.js';

const BUILTIN_GROUP_REFS = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']);
const GROUP_TYPES_REQUIRING_MEMBERS = new Set(['url-test', 'fallback', 'load-balance', 'select']);

export class MihomoConfigRenderer {
    constructor({ templateContent, nodeInput, templateName = 'template', now = new Date() } = {}) {
        this.templateContent = templateContent;
        this.nodeInput = nodeInput;
        this.templateName = templateName;
        this.now = now;
    }

    async render() {
        const proxies = await parseNodeInput(this.nodeInput);
        const config = renderTemplate({
            templateContent: this.templateContent,
            proxies,
            templateName: this.templateName,
            now: this.now
        });
        validateMihomoConfig(config);
        return yaml.dump(config, {
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        });
    }
}

export async function parseNodeInput(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed) {
        throw new InvalidPayloadError('Node input is required');
    }

    const yamlProxies = parseDirectYamlProxies(trimmed);
    if (yamlProxies) {
        return yamlProxies.map(normalizeDirectMihomoProxy);
    }

    const lines = trimmed
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const proxies = [];
    const errors = [];

    for (const [index, line] of lines.entries()) {
        if (/^https?:\/\//i.test(line)) {
            errors.push(`Line ${index + 1}: remote subscription URLs are not supported in MVP`);
            continue;
        }

        try {
            const parsed = await ProxyParser.parse(line);
            if (!parsed) {
                errors.push(`Line ${index + 1}: unsupported or invalid proxy URI`);
                continue;
            }
            if (Array.isArray(parsed)) {
                parsed.forEach(item => proxies.push(convertParsedProxy(item)));
            } else {
                proxies.push(convertParsedProxy(parsed));
            }
        } catch (error) {
            errors.push(`Line ${index + 1}: ${error?.message || 'failed to parse proxy URI'}`);
        }
    }

    if (errors.length > 0) {
        throw new InvalidPayloadError(errors.join('; '));
    }
    if (proxies.length === 0) {
        throw new InvalidPayloadError('No valid proxies found');
    }

    return proxies;
}

export function renderTemplate({ templateContent, proxies, templateName = 'template', now = new Date() }) {
    let parsed;
    try {
        parsed = yaml.load(String(templateContent || ''));
    } catch (error) {
        throw new InvalidPayloadError(`Template YAML is invalid: ${error.message}`);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new InvalidPayloadError('Template must be a YAML object');
    }

    const proxyNames = proxies.map(proxy => proxy.name);
    let sawProxiesPlaceholder = false;

    const rendered = replacePlaceholders(parsed, {
        proxies,
        proxyNames,
        templateName,
        generatedAt: now.toISOString(),
        markProxiesPlaceholder: () => {
            sawProxiesPlaceholder = true;
        }
    });

    if (!sawProxiesPlaceholder) {
        throw new InvalidPayloadError('Template must include proxies: "{{PROXIES}}"');
    }

    return rendered;
}

export function validateMihomoConfig(config) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new InvalidPayloadError('Rendered config must be a YAML object');
    }
    if (!Array.isArray(config.proxies) || config.proxies.length === 0) {
        throw new InvalidPayloadError('Rendered config must include at least one proxy');
    }
    if (config['proxy-providers'] && Object.keys(config['proxy-providers']).length > 0) {
        throw new InvalidPayloadError('proxy-providers are not supported in one-shot mode');
    }

    const proxyNames = new Set();
    config.proxies.forEach((proxy, index) => {
        if (!proxy || typeof proxy !== 'object') {
            throw new InvalidPayloadError(`Proxy ${index + 1} must be an object`);
        }
        if (!proxy.name || typeof proxy.name !== 'string') {
            throw new InvalidPayloadError(`Proxy ${index + 1} is missing name`);
        }
        if (proxyNames.has(proxy.name)) {
            throw new InvalidPayloadError(`Duplicate proxy name: ${proxy.name}`);
        }
        proxyNames.add(proxy.name);
    });

    const groups = Array.isArray(config['proxy-groups']) ? config['proxy-groups'] : [];
    const groupNames = new Set();
    groups.forEach((group, index) => {
        if (!group || typeof group !== 'object') {
            throw new InvalidPayloadError(`Proxy group ${index + 1} must be an object`);
        }
        if (!group.name || typeof group.name !== 'string') {
            throw new InvalidPayloadError(`Proxy group ${index + 1} is missing name`);
        }
        if (groupNames.has(group.name)) {
            throw new InvalidPayloadError(`Duplicate proxy group name: ${group.name}`);
        }
        groupNames.add(group.name);
    });

    groups.forEach(group => {
        const members = Array.isArray(group.proxies) ? group.proxies : [];
        const requiresMembers = GROUP_TYPES_REQUIRING_MEMBERS.has(group.type);
        const hasUse = Array.isArray(group.use) && group.use.length > 0;
        if (hasUse) {
            throw new InvalidPayloadError(`Proxy group "${group.name}" cannot use proxy-providers in one-shot mode`);
        }
        if (requiresMembers && members.length === 0) {
            throw new InvalidPayloadError(`Proxy group "${group.name}" requires at least one proxy`);
        }
        members.forEach(member => {
            if (!proxyNames.has(member) && !groupNames.has(member) && !BUILTIN_GROUP_REFS.has(member)) {
                throw new InvalidPayloadError(`Proxy group "${group.name}" references missing member "${member}"`);
            }
        });
    });
}

function parseDirectYamlProxies(input) {
    let parsed;
    try {
        parsed = yaml.load(input);
    } catch {
        return null;
    }

    if (Array.isArray(parsed) && parsed.every(isMihomoProxyObject)) {
        return parsed;
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.proxies) && parsed.proxies.every(isMihomoProxyObject)) {
        return parsed.proxies;
    }
    return null;
}

function isMihomoProxyObject(value) {
    return value && typeof value === 'object' && typeof value.name === 'string' && typeof value.type === 'string';
}

function normalizeDirectMihomoProxy(proxy) {
    return deepCopy(proxy);
}

function replacePlaceholders(value, context) {
    if (typeof value === 'string') {
        switch (value) {
            case '{{PROXIES}}':
                context.markProxiesPlaceholder();
                return deepCopy(context.proxies);
            case '{{PROXY_NAMES}}':
            case '{{PROXY_NAMES_INLINE}}':
                return [...context.proxyNames];
            case '{{GENERATED_AT}}':
                return context.generatedAt;
            case '{{TEMPLATE_NAME}}':
                return context.templateName;
            default:
                return value;
        }
    }
    if (Array.isArray(value)) {
        return value.map(item => replacePlaceholders(item, context));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [key, replacePlaceholders(nestedValue, context)])
        );
    }
    return value;
}

function convertParsedProxy(proxy) {
    if (isMihomoProxyObject(proxy)) {
        return normalizeDirectMihomoProxy(proxy);
    }
    if (!proxy || typeof proxy !== 'object' || !proxy.tag) {
        throw new InvalidPayloadError('Parsed proxy is missing a name');
    }

    switch (proxy.type) {
        case 'shadowsocks':
            return removeUndefined({
                name: proxy.tag,
                type: 'ss',
                server: proxy.server,
                port: proxy.server_port,
                cipher: proxy.method,
                password: proxy.password,
                udp: proxy.udp ?? true,
                plugin: proxy.plugin,
                'plugin-opts': proxy.plugin_opts
            });
        case 'vmess':
            return removeUndefined({
                name: proxy.tag,
                type: 'vmess',
                server: proxy.server,
                port: proxy.server_port,
                uuid: proxy.uuid,
                alterId: proxy.alter_id ?? 0,
                cipher: proxy.security || 'auto',
                tls: proxy.tls?.enabled || false,
                servername: proxy.tls?.server_name,
                'skip-cert-verify': !!proxy.tls?.insecure,
                network: proxy.transport?.type || proxy.network || 'tcp',
                'ws-opts': proxy.transport?.type === 'ws' ? {
                    path: proxy.transport.path,
                    headers: proxy.transport.headers
                } : undefined,
                'http-opts': proxy.transport?.type === 'http' ? {
                    method: proxy.transport.method || 'GET',
                    path: Array.isArray(proxy.transport.path) ? proxy.transport.path : [proxy.transport.path || '/'],
                    headers: proxy.transport.headers
                } : undefined,
                'grpc-opts': proxy.transport?.type === 'grpc' ? {
                    'grpc-service-name': proxy.transport.service_name
                } : undefined,
                udp: proxy.udp ?? true
            });
        case 'vless':
            return removeUndefined({
                name: proxy.tag,
                type: 'vless',
                server: proxy.server,
                port: proxy.server_port,
                uuid: proxy.uuid,
                cipher: proxy.security || 'none',
                encryption: proxy.encryption,
                tls: proxy.tls?.enabled || false,
                servername: proxy.tls?.server_name,
                'client-fingerprint': proxy.tls?.utls?.fingerprint,
                'skip-cert-verify': !!proxy.tls?.insecure,
                network: proxy.transport?.type || 'tcp',
                'packet-encoding': proxy.packet_encoding,
                'ws-opts': proxy.transport?.type === 'ws' ? {
                    path: proxy.transport.path,
                    headers: proxy.transport.headers
                } : undefined,
                'grpc-opts': proxy.transport?.type === 'grpc' ? {
                    'grpc-service-name': proxy.transport.service_name
                } : undefined,
                'xhttp-opts': proxy.transport?.type === 'xhttp' ? proxy.transport.options : undefined,
                'reality-opts': proxy.tls?.reality?.enabled ? removeUndefined({
                    'public-key': proxy.tls.reality.public_key,
                    'short-id': proxy.tls.reality.short_id,
                    'support-x25519mlkem768': proxy.tls.reality.support_x25519mlkem768
                }) : undefined,
                'ech-opts': proxy.tls?.ech,
                flow: proxy.flow,
                udp: proxy.udp ?? true
            });
        case 'trojan':
            return removeUndefined({
                name: proxy.tag,
                type: 'trojan',
                server: proxy.server,
                port: proxy.server_port,
                password: proxy.password,
                sni: proxy.tls?.server_name,
                'skip-cert-verify': !!proxy.tls?.insecure,
                network: proxy.transport?.type || 'tcp',
                udp: proxy.udp ?? true
            });
        case 'hysteria2':
            return removeUndefined({
                name: proxy.tag,
                type: 'hysteria2',
                server: proxy.server,
                port: proxy.server_port,
                password: proxy.password,
                obfs: proxy.obfs?.type,
                'obfs-password': proxy.obfs?.password,
                sni: proxy.tls?.server_name,
                'skip-cert-verify': !!proxy.tls?.insecure
            });
        case 'tuic':
            return removeUndefined({
                name: proxy.tag,
                type: 'tuic',
                server: proxy.server,
                port: proxy.server_port,
                uuid: proxy.uuid,
                password: proxy.password,
                'congestion-controller': proxy.congestion_control,
                sni: proxy.tls?.server_name,
                'skip-cert-verify': !!proxy.tls?.insecure,
                'udp-relay-mode': proxy.udp_relay_mode || 'native'
            });
        default:
            throw new InvalidPayloadError(`Unsupported proxy type: ${proxy.type}`);
    }
}

function removeUndefined(value) {
    if (Array.isArray(value)) {
        return value.map(removeUndefined);
    }
    if (value && typeof value === 'object') {
        const result = {};
        Object.entries(value).forEach(([key, nestedValue]) => {
            if (nestedValue === undefined) return;
            result[key] = removeUndefined(nestedValue);
        });
        return result;
    }
    return value;
}
