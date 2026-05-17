import { InvalidPayloadError, MissingDependencyError } from './errors.js';

const SESSION_COOKIE = 'mihomo_session';
const encoder = new TextEncoder();

export class AuthService {
    constructor(config = {}) {
        this.config = {
            adminUsername: config.adminUsername || 'admin',
            adminPasswordSha256: config.adminPasswordSha256,
            authSecret: config.authSecret,
            sessionTtlSeconds: config.sessionTtlSeconds || 86400,
            forceSecureCookie: config.forceSecureCookie
        };
    }

    assertConfigured() {
        if (!this.config.authSecret) {
            throw new MissingDependencyError('AUTH_SECRET is required');
        }
        if (!this.config.adminPasswordSha256) {
            throw new MissingDependencyError('ADMIN_PASSWORD_SHA256 is required');
        }
    }

    async login(username, password) {
        this.assertConfigured();
        const normalizedUsername = String(username || '').trim();
        if (normalizedUsername !== this.config.adminUsername) {
            return null;
        }
        const passwordHash = await sha256Hex(String(password || ''));
        if (!constantTimeEqualHex(passwordHash, this.config.adminPasswordSha256)) {
            return null;
        }
        const exp = Math.floor(Date.now() / 1000) + this.config.sessionTtlSeconds;
        return this.signSession({ sub: normalizedUsername, exp });
    }

    async verify(request) {
        this.assertConfigured();
        const token = parseCookies(request.headers.get('Cookie') || '')[SESSION_COOKIE];
        if (!token) return null;
        const [payloadPart, signaturePart] = token.split('.');
        if (!payloadPart || !signaturePart) return null;
        const expected = await hmacBase64Url(this.config.authSecret, payloadPart);
        if (!constantTimeEqual(signaturePart, expected)) {
            return null;
        }
        let payload;
        try {
            payload = JSON.parse(base64UrlDecodeToString(payloadPart));
        } catch {
            return null;
        }
        if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    }

    async signSession(payload) {
        const payloadPart = base64UrlEncode(JSON.stringify(payload));
        const signaturePart = await hmacBase64Url(this.config.authSecret, payloadPart);
        return `${payloadPart}.${signaturePart}`;
    }

    buildSessionCookie(token, requestUrl) {
        const secure = shouldUseSecureCookie(requestUrl, this.config.forceSecureCookie);
        return serializeCookie(SESSION_COOKIE, token, {
            httpOnly: true,
            sameSite: 'Lax',
            secure,
            path: '/',
            maxAge: this.config.sessionTtlSeconds
        });
    }

    buildLogoutCookie(requestUrl) {
        const secure = shouldUseSecureCookie(requestUrl, this.config.forceSecureCookie);
        return serializeCookie(SESSION_COOKIE, '', {
            httpOnly: true,
            sameSite: 'Lax',
            secure,
            path: '/',
            maxAge: 0
        });
    }
}

export function parseCookies(rawCookie) {
    return rawCookie
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((cookies, part) => {
            const eqIndex = part.indexOf('=');
            if (eqIndex === -1) return cookies;
            const key = part.slice(0, eqIndex).trim();
            const value = part.slice(eqIndex + 1).trim();
            cookies[key] = value;
            return cookies;
        }, {});
}

async function sha256Hex(value) {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacBase64Url(secret, message) {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return base64UrlEncodeBytes(new Uint8Array(signature));
}

function serializeCookie(name, value, options = {}) {
    const parts = [`${name}=${value}`];
    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.secure) parts.push('Secure');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    return parts.join('; ');
}

function shouldUseSecureCookie(requestUrl, forced) {
    if (forced !== undefined) return forced;
    try {
        return new URL(requestUrl).protocol === 'https:';
    } catch {
        return false;
    }
}

function base64UrlEncode(value) {
    return base64UrlEncodeBytes(encoder.encode(value));
}

function base64UrlEncodeBytes(bytes) {
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToString(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function constantTimeEqualHex(a, b) {
    const left = String(a || '').toLowerCase();
    const right = String(b || '').toLowerCase();
    return constantTimeEqual(left, right);
}

function constantTimeEqual(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    let diff = left.length ^ right.length;
    const max = Math.max(left.length, right.length);
    for (let i = 0; i < max; i++) {
        diff |= left.charCodeAt(i % left.length || 0) ^ right.charCodeAt(i % right.length || 0);
    }
    return diff === 0;
}
