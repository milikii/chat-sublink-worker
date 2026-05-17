import { parseArray, parseBool, parseMaybeNumber } from '../../utils.js';

const XHTTP_STRING_KEYS = [
    'mode',
    'host',
    'path',
    'x-padding-obfs-mode',
    'x-padding-key',
    'x-padding-header',
    'x-padding-placement',
    'x-padding-method',
    'uplink-http-method',
    'session-placement',
    'session-key',
    'seq-placement',
    'seq-key',
    'uplink-data-placement',
    'uplink-data-key'
];

const XHTTP_NUMBER_KEYS = [
    'x-padding-bytes',
    'uplink-chunk-size',
    'sc-max-each-post-bytes',
    'sc-min-posts-interval-ms'
];

const XHTTP_BOOL_KEYS = ['no-grpc-header'];

export function buildVlessAlphaFields(params) {
    const fields = {};
    const encryption = pick(params, ['encryption']);
    if (encryption) {
        fields.encryption = encryption;
    }

    const packetEncoding = pick(params, ['packet-encoding', 'packet_encoding', 'packetEncoding']);
    if (packetEncoding) {
        fields.packet_encoding = packetEncoding;
    }

    const ech = buildEchOptions(params);
    if (ech) {
        fields.ech = ech;
    }

    const reality = buildRealityOptions(params);
    if (reality) {
        fields.reality = reality;
    }

    const xhttp = buildXhttpOptions(params);
    if (xhttp) {
        fields.xhttp = xhttp;
    }

    return fields;
}

function buildEchOptions(params) {
    const enabled = parseBool(pick(params, ['ech', 'ech-enable', 'ech_enabled', 'ech-opts.enable']));
    const config = pick(params, ['ech-config', 'ech_config', 'ech-opts.config']);
    const queryServerName = pick(params, ['ech-query-server-name', 'ech_query_server_name', 'ech-opts.query-server-name']);

    if (enabled === undefined && !config && !queryServerName) {
        return undefined;
    }

    return removeUndefined({
        enable: enabled ?? true,
        config,
        'query-server-name': queryServerName
    });
}

function buildRealityOptions(params) {
    const supportHybrid = parseBool(pick(params, [
        'support-x25519mlkem768',
        'support_x25519mlkem768',
        'reality-opts.support-x25519mlkem768'
    ]));
    if (supportHybrid === undefined) {
        return undefined;
    }
    return { support_x25519mlkem768: supportHybrid };
}

function buildXhttpOptions(params) {
    if (params.type !== 'xhttp') {
        return undefined;
    }

    const options = {};
    XHTTP_STRING_KEYS.forEach(key => {
        const value = pick(params, [key, toCamelish(key), `xhttp-opts.${key}`]);
        if (value !== undefined && value !== '') {
            options[key] = value;
        }
    });
    XHTTP_NUMBER_KEYS.forEach(key => {
        const value = parseMaybeNumber(pick(params, [key, toCamelish(key), `xhttp-opts.${key}`]));
        if (value !== undefined) {
            options[key] = value;
        }
    });
    XHTTP_BOOL_KEYS.forEach(key => {
        const value = parseBool(pick(params, [key, toCamelish(key), `xhttp-opts.${key}`]));
        if (value !== undefined) {
            options[key] = value;
        }
    });

    const headers = parseHeaderMap(pick(params, ['headers', 'xhttp-headers', 'xhttp-opts.headers']));
    if (headers) {
        options.headers = headers;
    }

    const alpn = parseArray(pick(params, ['alpn']));
    if (alpn) {
        options.alpn = alpn;
    }

    const reuseSettings = parseNestedObject(params, 'reuse-settings');
    if (reuseSettings) {
        options['reuse-settings'] = reuseSettings;
    }

    const downloadSettings = parseNestedObject(params, 'download-settings');
    if (downloadSettings) {
        options['download-settings'] = downloadSettings;
    }

    return Object.keys(options).length > 0 ? options : undefined;
}

function parseNestedObject(params, prefix) {
    const result = {};
    const prefixWithDot = `${prefix}.`;
    Object.entries(params).forEach(([key, value]) => {
        if (key.startsWith(prefixWithDot)) {
            result[key.slice(prefixWithDot.length)] = parseScalar(value);
        }
    });
    return Object.keys(result).length > 0 ? result : undefined;
}

function parseHeaderMap(value) {
    if (!value) return undefined;
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
    } catch {
        // Fall through to comma-separated form.
    }

    const headers = {};
    String(value).split(',').forEach(entry => {
        const colonIndex = entry.indexOf(':');
        if (colonIndex === -1) return;
        const key = entry.slice(0, colonIndex).trim();
        const headerValue = entry.slice(colonIndex + 1).trim();
        if (key) {
            headers[key] = headerValue;
        }
    });
    return Object.keys(headers).length > 0 ? headers : undefined;
}

function parseScalar(value) {
    const bool = parseBool(value);
    if (bool !== undefined) return bool;
    const number = parseMaybeNumber(value);
    if (number !== undefined) return number;
    return value;
}

function pick(params, keys) {
    for (const key of keys) {
        if (params[key] !== undefined) {
            return params[key];
        }
    }
    return undefined;
}

function toCamelish(key) {
    return key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function removeUndefined(value) {
    return Object.fromEntries(Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined));
}
