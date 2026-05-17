/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { Hono } from 'hono';
import { Layout } from '../components/Layout.jsx';
import { LoginPage } from '../components/LoginPage.jsx';
import { Workbench } from '../components/Workbench.jsx';
import { MihomoConfigRenderer, renderTemplate, validateMihomoConfig } from '../builders/MihomoConfigRenderer.js';
import { TemplateStorageService } from '../services/templateStorageService.js';
import { AuthService } from '../services/authService.js';
import { ServiceError, InvalidPayloadError, MissingDependencyError } from '../services/errors.js';
import { normalizeRuntime } from '../runtime/runtimeConfig.js';
import { APP_NAME } from '../constants.js';
import { PREDEFINED_RULE_SETS } from '../config/index.js';

export function createApp(bindings = {}) {
    const runtime = normalizeRuntime(bindings);
    const templates = new TemplateStorageService(runtime.kv);
    const auth = new AuthService(runtime.config);
    const app = new Hono();

    app.use('*', async (c, next) => {
        setNoStoreHeaders(c);
        await next();
    });

    app.get('/login', (c) => c.html(
        <Layout title={`${APP_NAME} Login`}>
            <LoginPage />
        </Layout>
    ));

    app.post('/auth/login', async (c) => {
        try {
            const body = await readBody(c);
            const token = await auth.login(body.username, body.password);
            if (!token) {
                return c.text('Unauthorized', 401);
            }
            c.header('Set-Cookie', auth.buildSessionCookie(token, c.req.url));
            return c.json({ ok: true });
        } catch (error) {
            return handleError(c, error, runtime.logger);
        }
    });

    app.post('/auth/logout', (c) => {
        c.header('Set-Cookie', auth.buildLogoutCookie(c.req.url));
        return c.json({ ok: true });
    });

    app.use('/', requireSession(auth));
    app.use('/api/*', requireSession(auth));

    app.get('/', (c) => c.html(
        <Layout title={APP_NAME}>
            <Workbench />
        </Layout>
    ));

    app.get('/api/templates', async (c) => {
        try {
            return c.json(await templates.listTemplates());
        } catch (error) {
            return handleError(c, error, runtime.logger);
        }
    });

    app.get('/api/templates/:id', async (c) => {
        try {
            const template = await templates.getTemplateById(c.req.param('id'));
            if (!template) {
                return c.text('Template not found', 404);
            }
            return c.json(template);
        } catch (error) {
            return handleError(c, error, runtime.logger);
        }
    });

    app.put('/api/templates/:id', async (c) => {
        try {
            const body = await readBody(c);
            validateTemplateContent(body.content);
            const template = await templates.saveTemplate(c.req.param('id'), body);
            return c.json(template);
        } catch (error) {
            return handleError(c, error, runtime.logger);
        }
    });

    app.delete('/api/templates/:id', async (c) => {
        try {
            await templates.deleteTemplate(c.req.param('id'));
            return c.json({ ok: true });
        } catch (error) {
            return handleError(c, error, runtime.logger);
        }
    });

    app.post('/api/render', async (c) => {
        try {
            const body = await readBody(c);
            const templateContent = await resolveTemplateContent(templates, body);
            const renderer = new MihomoConfigRenderer({
                templateContent,
                templateName: body.templateName || body.templateId || 'template',
                nodeInput: body.nodes
            });
            return c.text(await renderer.render(), 200, {
                'Content-Type': 'text/yaml; charset=utf-8'
            });
        } catch (error) {
            return handleError(c, error, runtime.logger);
        }
    });

    app.get('/favicon.ico', async (c) => {
        if (!runtime.assetFetcher) {
            return c.notFound();
        }
        try {
            return await runtime.assetFetcher(c.req.raw);
        } catch (error) {
            runtime.logger.warn('Asset fetch failed', error);
            return c.notFound();
        }
    });

    return app;
}

export function parseSelectedRules(raw) {
    if (!raw) return [];
    if (typeof raw === 'string' && PREDEFINED_RULE_SETS[raw]) {
        return PREDEFINED_RULE_SETS[raw];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return PREDEFINED_RULE_SETS.minimal;
    }
}

async function resolveTemplateContent(templates, body) {
    if (typeof body.templateContent === 'string' && body.templateContent.trim()) {
        return body.templateContent;
    }
    const template = await templates.getTemplateById(body.templateId || 'default');
    if (!template) {
        throw new InvalidPayloadError('Template not found');
    }
    return template.content;
}

function validateTemplateContent(content) {
    const sample = [{
        name: 'Sample',
        type: 'ss',
        server: 'sample.invalid',
        port: 443,
        cipher: 'aes-128-gcm',
        password: 'sample'
    }];
    const rendered = renderTemplate({
        templateContent: content,
        proxies: sample,
        templateName: 'Validation Sample',
        now: new Date('2026-01-01T00:00:00.000Z')
    });
    validateMihomoConfig(rendered);
}

function requireSession(auth) {
    return async (c, next) => {
        try {
            const session = await auth.verify(c.req.raw);
            if (!session) {
                if (c.req.path.startsWith('/api/')) {
                    return c.text('Unauthorized', 401);
                }
                return c.redirect('/login', 302);
            }
            c.set('session', session);
            await next();
        } catch (error) {
            if (error instanceof MissingDependencyError) {
                return c.text(error.message, 500);
            }
            throw error;
        }
    };
}

async function readBody(c) {
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('application/json')) {
        return c.req.json();
    }
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        return c.req.parseBody();
    }
    const text = await c.req.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new InvalidPayloadError('Request body must be JSON');
    }
}

function setNoStoreHeaders(c) {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Content-Type-Options', 'nosniff');
}

function handleError(c, error, logger) {
    if (error instanceof ServiceError) {
        return c.text(error.message, error.status);
    }
    logger.error?.('Unhandled error', error?.message || error);
    return c.text('Internal Server Error', 500);
}
