import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';

describe('removed subconverter endpoint', () => {
    it('returns 404 because Mihomo Subscriber has no subconverter surface', async () => {
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
        const res = await app.request('http://localhost/subconverter');
        expect(res.status).toBe(404);
    });
});
