import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';

describe('remote subscription routes removed', () => {
    it('does not fetch or proxy remote subscription metadata in the private Mihomo app', async () => {
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
        const res = await app.request('http://localhost/clash?config=https%3A%2F%2Fairport.example.com%2Fsub%3Ftoken%3Dabc');
        expect(res.status).toBe(404);
        expect(res.headers.get('subscription-userinfo')).toBeNull();
    });
});
