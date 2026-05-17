import { describe, it, expect, vi } from 'vitest';
import yaml from 'js-yaml';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';

const PASSWORD_HASH = '2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b';

const createTestApp = (overrides = {}) => {
    const runtime = {
        kv: overrides.kv ?? new MemoryKVAdapter(),
        assetFetcher: overrides.assetFetcher ?? null,
        logger: console,
        config: {
            authSecret: 'test-secret',
            adminUsername: 'admin',
            adminPasswordSha256: PASSWORD_HASH,
            forceSecureCookie: false,
            ...(overrides.config || {})
        }
    };
    return createApp(runtime);
};

async function login(app) {
    const res = await app.request('http://localhost/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'secret' })
    });
    expect(res.status).toBe(200);
    return res.headers.get('set-cookie').split(';')[0];
}

describe('Private Mihomo worker', () => {
    it('redirects root to login without a session', async () => {
        const app = createTestApp();
        const res = await app.request('http://localhost/');
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe('/login');
    });

    it('renders the private workbench after login', async () => {
        const app = createTestApp();
        const cookie = await login(app);
        const res = await app.request('http://localhost/', {
            headers: { Cookie: cookie }
        });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/html');
        const text = await res.text();
        expect(text).toContain('一次性生成');
        expect(text).not.toContain('SingBox');
        expect(text).not.toContain('Surge');
    });

    it('lists built-in Mihomo templates', async () => {
        const app = createTestApp();
        const cookie = await login(app);

        const res = await app.request('http://localhost/api/templates', {
            headers: { Cookie: cookie }
        });

        expect(res.status).toBe(200);
        const templates = await res.json();
        expect(templates.map(template => template.id)).toEqual(expect.arrayContaining([
            'android-phone',
            'windows',
            'nas-bypass-router'
        ]));
    });

    it('renders the Android template with US, JP, and NAS groups', async () => {
        const app = createTestApp();
        const cookie = await login(app);
        const templateRes = await app.request('http://localhost/api/templates/android-phone', {
            headers: { Cookie: cookie }
        });
        const template = await templateRes.json();
        const nodes = [
            'ss://YWVzLTEyOC1nY206cGFzc0BleGFtcGxlLmNvbTo0NDM#US-LA',
            'ss://YWVzLTEyOC1nY206cGFzc0BqcC5leGFtcGxlLmNvbTo0NDM#JP-Tokyo',
            'ss://YWVzLTEyOC1nY206cGFzc0BuYXMuZXhhbXBsZS5jb206NDQz#NAS-Reality'
        ].join('\n');

        const res = await app.request('http://localhost/api/render', {
            method: 'POST',
            headers: {
                Cookie: cookie,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                templateContent: template.content,
                nodes
            })
        });

        expect(res.status).toBe(200);
        const config = yaml.load(await res.text());
        const groupByName = Object.fromEntries(config['proxy-groups'].map(group => [group.name, group]));
        expect(groupByName.AUTO.proxies).toEqual(['US-LA', 'JP-Tokyo']);
        expect(groupByName.US.proxies).toEqual(['US-LA']);
        expect(groupByName.JP.proxies).toEqual(['JP-Tokyo']);
        expect(groupByName.NAS.proxies).toEqual(['NAS-Reality', 'DIRECT']);
        expect(config.rules).toContain('RULE-SET,pt-direct,DIRECT');
        expect(config.rules).toContain('DOMAIN,mtalk.google.com,FCM');
        expect(config.rules).toContain('DOMAIN-SUFFIX,jp,JP');
        expect(config.rules).toContain('GEOSITE,cn,DIRECT');
        expect(config.rules).toContain('MATCH,PROXY');
    });

    it('renders Mihomo YAML via authenticated POST without storing nodes', async () => {
        const kvMock = {
            get: vi.fn(async () => null),
            put: vi.fn(async () => {}),
            delete: vi.fn(async () => {})
        };
        const app = createTestApp({ kv: kvMock });
        const cookie = await login(app);
        const node = 'vless://00000000-0000-4000-8000-000000000001@example.com:443?security=tls&sni=example.com&type=xhttp&path=%2Fup&mode=packet-up&packet-encoding=xudp&encryption=mlkem768x25519plus&ech=true&ech-config=abc#Alpha';
        const template = 'mixed-port: 7890\nproxies: "{{PROXIES}}"\nproxy-groups:\n  - name: PROXY\n    type: select\n    proxies: "{{PROXY_NAMES}}"\nrules:\n  - MATCH,PROXY\n';

        const res = await app.request('http://localhost/api/render', {
            method: 'POST',
            headers: {
                Cookie: cookie,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                templateContent: template,
                nodes: node
            })
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const text = await res.text();
        const config = yaml.load(text);
        expect(config.proxies[0].name).toBe('Alpha');
        expect(config.proxies[0].network).toBe('xhttp');
        expect(config.proxies[0]['packet-encoding']).toBe('xudp');
        expect(config.proxies[0].encryption).toBe('mlkem768x25519plus');
        expect(config.proxies[0]['ech-opts']).toMatchObject({ enable: true, config: 'abc' });

        expect(kvMock.put).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining('00000000-0000-4000-8000-000000000001'),
            expect.anything()
        );
        expect(kvMock.put).not.toHaveBeenCalledWith(
            expect.any(String),
            expect.stringContaining('example.com'),
            expect.anything()
        );
    });

    it('rejects proxy providers so templates cannot retain subscription sources', async () => {
        const app = createTestApp();
        const cookie = await login(app);
        const template = 'mixed-port: 7890\nproxies: "{{PROXIES}}"\nproxy-providers:\n  remote:\n    type: http\n    url: https://example.com/sub\n    path: ./remote.yaml\nproxy-groups:\n  - name: PROXY\n    type: select\n    use:\n      - remote\nrules:\n  - MATCH,PROXY\n';

        const res = await app.request('http://localhost/api/render', {
            method: 'POST',
            headers: {
                Cookie: cookie,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                templateContent: template,
                nodes: 'ss://YWVzLTEyOC1nY206cGFzc0BleGFtcGxlLmNvbTo0NDM#Alpha'
            })
        });

        expect(res.status).toBe(400);
        await expect(res.text()).resolves.toContain('proxy-providers are not supported');
    });

    it('rejects removed product routes', async () => {
        const app = createTestApp();
        for (const path of ['/singbox', '/surge', '/xray', '/subconverter', '/shorten-v2', '/s/code', '/b/code', '/c/code', '/x/code', '/resolve', '/config', '/sub/default']) {
            const res = await app.request(`http://localhost${path}`);
            expect(res.status).toBe(404);
        }
    });
});
