import { InvalidPayloadError, MissingDependencyError } from './errors.js';

const DOWNLOAD_PREFIX = 'mihomo:downloads:';
const DEFAULT_TTL_SECONDS = 10 * 60;
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 60 * 60;
const MAX_CONTENT_LENGTH = 512 * 1024;
const CONSUMED_TOMBSTONE_TTL_SECONDS = 60;

export class OneTimeDownloadService {
    constructor(kv, options = {}) {
        this.kv = kv;
        this.ttlSeconds = normalizeTtl(options.ttlSeconds);
    }

    ensureKv() {
        if (!this.kv) {
            throw new MissingDependencyError('One-time download links require a KV store');
        }
        return this.kv;
    }

    async create(content, options = {}) {
        const yaml = normalizeContent(content);
        const kv = this.ensureKv();
        const token = createToken();
        const now = Date.now();
        const payload = {
            content: yaml,
            filename: normalizeFilename(options.filename || 'mihomo.yaml'),
            contentType: options.contentType || 'text/yaml; charset=utf-8',
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + this.ttlSeconds * 1000).toISOString()
        };

        await kv.put(downloadKey(token), JSON.stringify(payload), {
            expirationTtl: this.ttlSeconds
        });

        return {
            token,
            expiresInSeconds: this.ttlSeconds,
            expiresAt: payload.expiresAt,
            filename: payload.filename
        };
    }

    async consume(token) {
        const normalizedToken = normalizeToken(token);
        const kv = this.ensureKv();
        const key = downloadKey(normalizedToken);
        const raw = await kv.get(key);
        if (!raw) {
            return null;
        }

        await kv.put(key, JSON.stringify({
            consumedAt: new Date().toISOString()
        }), {
            expirationTtl: CONSUMED_TOMBSTONE_TTL_SECONDS
        });

        let payload;
        try {
            payload = JSON.parse(raw);
        } catch {
            return null;
        }

        if (!payload.content) {
            return null;
        }

        if (payload.expiresAt && Date.parse(payload.expiresAt) <= Date.now()) {
            return null;
        }

        return {
            content: normalizeContent(payload.content),
            filename: normalizeFilename(payload.filename || 'mihomo.yaml'),
            contentType: payload.contentType || 'text/yaml; charset=utf-8',
            expiresAt: payload.expiresAt
        };
    }
}

export function parseDownloadToken(file) {
    const value = String(file || '').trim();
    const token = value.endsWith('.yaml') ? value.slice(0, -5) : value;
    return normalizeToken(token);
}

function normalizeContent(content) {
    const value = String(content || '');
    if (!value.trim()) {
        throw new InvalidPayloadError('Download content is required');
    }
    if (value.length > MAX_CONTENT_LENGTH) {
        throw new InvalidPayloadError('Generated YAML is too large for a one-time download link');
    }
    return value;
}

function normalizeFilename(filename) {
    const value = String(filename || 'mihomo.yaml').trim();
    const safe = value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
    const normalized = safe || 'mihomo.yaml';
    return normalized.endsWith('.yaml') ? normalized : `${normalized}.yaml`;
}

function normalizeToken(token) {
    const value = String(token || '').trim();
    if (!/^[a-zA-Z0-9_-]{32,128}$/.test(value)) {
        throw new InvalidPayloadError('Invalid download token');
    }
    return value;
}

function normalizeTtl(ttlSeconds) {
    const parsed = Number(ttlSeconds);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_TTL_SECONDS;
    }
    return Math.min(Math.max(Math.floor(parsed), MIN_TTL_SECONDS), MAX_TTL_SECONDS);
}

function downloadKey(token) {
    return `${DOWNLOAD_PREFIX}${token}`;
}

function createToken() {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes) {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
