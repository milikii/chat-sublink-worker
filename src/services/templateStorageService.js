import { BUILTIN_MIHOMO_TEMPLATES, DEFAULT_TEMPLATE_ID } from '../config/mihomoDefaultTemplate.js';
import { InvalidPayloadError, MissingDependencyError } from './errors.js';

const INDEX_KEY = 'mihomo:templates:index';
const TEMPLATE_PREFIX = 'mihomo:templates:';

export class TemplateStorageService {
    constructor(kv) {
        this.kv = kv;
    }

    ensureKv() {
        if (!this.kv) {
            throw new MissingDependencyError('Template storage requires a KV store');
        }
        return this.kv;
    }

    async listTemplates() {
        const kv = this.ensureKv();
        const ids = await this.readIndex(kv);
        const builtinIds = new Set(BUILTIN_MIHOMO_TEMPLATES.map(template => template.id));
        const templates = [];

        for (const builtin of BUILTIN_MIHOMO_TEMPLATES) {
            templates.push(await this.getStoredTemplate(builtin.id) ?? createBuiltinTemplate(builtin.id));
        }

        for (const id of ids) {
            if (builtinIds.has(id)) continue;
            const template = await this.getStoredTemplate(id);
            if (template) {
                templates.push(template);
            }
        }

        return templates.map(({ content, ...template }) => ({
            ...template,
            hasContent: Boolean(content)
        }));
    }

    async getTemplateById(id) {
        const templateId = normalizeTemplateId(id || DEFAULT_TEMPLATE_ID);
        const stored = await this.getStoredTemplate(templateId);
        if (stored) {
            return stored;
        }
        if (isBuiltinTemplate(templateId)) {
            return createBuiltinTemplate(templateId);
        }
        return null;
    }

    async saveTemplate(id, payload) {
        const kv = this.ensureKv();
        const templateId = normalizeTemplateId(id || payload?.id || DEFAULT_TEMPLATE_ID);
        const name = normalizeTemplateName(payload?.name || templateId);
        const content = normalizeTemplateContent(payload?.content);
        const now = new Date().toISOString();
        const existing = await this.getStoredTemplate(templateId);

        const template = {
            id: templateId,
            name,
            content,
            updatedAt: now,
            createdAt: existing?.createdAt || now
        };

        await kv.put(templateKey(templateId), JSON.stringify(template));
        const ids = await this.readIndex(kv);
        if (!ids.includes(templateId)) {
            ids.push(templateId);
            await kv.put(INDEX_KEY, JSON.stringify(ids));
        }
        return template;
    }

    async deleteTemplate(id) {
        const templateId = normalizeTemplateId(id);
        if (isBuiltinTemplate(templateId)) {
            throw new InvalidPayloadError('Built-in templates cannot be deleted');
        }
        const kv = this.ensureKv();
        await kv.delete(templateKey(templateId));
        const ids = await this.readIndex(kv);
        await kv.put(INDEX_KEY, JSON.stringify(ids.filter(entry => entry !== templateId)));
    }

    async getStoredTemplate(id) {
        const kv = this.ensureKv();
        const raw = await kv.get(templateKey(id));
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return {
                id: normalizeTemplateId(parsed.id),
                name: normalizeTemplateName(parsed.name || parsed.id),
                content: normalizeTemplateContent(parsed.content),
                createdAt: parsed.createdAt,
                updatedAt: parsed.updatedAt
            };
        } catch {
            throw new InvalidPayloadError('Stored template is not valid JSON');
        }
    }

    async readIndex(kv) {
        const raw = await kv.get(INDEX_KEY);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.map(entry => normalizeTemplateId(entry)).filter(Boolean)
                : [];
        } catch {
            return [];
        }
    }
}

export function createDefaultTemplate() {
    return createBuiltinTemplate(DEFAULT_TEMPLATE_ID);
}

export function createBuiltinTemplate(id) {
    const builtin = BUILTIN_MIHOMO_TEMPLATES.find(template => template.id === id);
    if (!builtin) {
        throw new InvalidPayloadError('Built-in template not found');
    }
    const now = new Date().toISOString();
    return {
        id: builtin.id,
        name: builtin.name,
        content: builtin.content,
        createdAt: now,
        updatedAt: now
    };
}

function isBuiltinTemplate(id) {
    return BUILTIN_MIHOMO_TEMPLATES.some(template => template.id === id);
}

function templateKey(id) {
    return `${TEMPLATE_PREFIX}${id}`;
}

function normalizeTemplateId(value) {
    const id = String(value || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
        throw new InvalidPayloadError('Template id must be 1-64 letters, numbers, underscores, or dashes');
    }
    return id;
}

function normalizeTemplateName(value) {
    const name = String(value || '').trim();
    if (!name) {
        throw new InvalidPayloadError('Template name is required');
    }
    if (name.length > 120) {
        throw new InvalidPayloadError('Template name is too long');
    }
    return name;
}

function normalizeTemplateContent(value) {
    const content = String(value || '').trimEnd();
    if (!content.trim()) {
        throw new InvalidPayloadError('Template content is required');
    }
    if (content.length > 256 * 1024) {
        throw new InvalidPayloadError('Template content is too large');
    }
    return content.endsWith('\n') ? content : `${content}\n`;
}
