import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';

const app = createApp({
    kv: new MemoryKVAdapter(),
    assetFetcher: null,
    logger: console,
    config: {
        authSecret: 'test-secret',
        adminUsername: 'admin',
        adminPasswordSha256: '2bb80d537b1da3e38bd30361aa855686bde0baaa4497cae5c01693217a25b1b',
        forceSecureCookie: false
    }
});

describe('Worker', () => {
    it('responds with HTML on login path', async () => {
        const res = await app.request('http://example.com/login');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        const text = await res.text();
        expect(text).toContain('<!DOCTYPE html>');
    });

    it('responds with 404 for unknown paths', async () => {
        const res = await app.request('http://example.com/unknown-path');
        expect(res.status).toBe(404);
    });
});
