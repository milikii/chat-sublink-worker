/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { APP_NAME } from '../constants.js';

export const Workbench = () => {
    const script = `
        async function copyToClipboard(text) {
            if (!text) return false;
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    return true;
                } catch (error) {
                    // Fall through to the textarea fallback for LAN HTTP pages.
                }
            }
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            try {
                return document.execCommand('copy');
            } finally {
                document.body.removeChild(textarea);
            }
        }

        window.workbenchData = function () {
            return {
                templates: [],
                selectedTemplateId: 'android-phone',
                selectedTemplateBuiltIn: true,
                templateName: '',
                templateContent: '',
                nodeInput: '',
                renderedYaml: '',
                downloadUrl: '',
                downloadExpiresAt: '',
                downloadFilename: '',
                status: '',
                error: '',
                loadingTemplates: true,
                savingTemplate: false,
                rendering: false,
                activeTab: 'generate',

                async init() {
                    await this.loadTemplates();
                },

                async loadTemplates() {
                    this.loadingTemplates = true;
                    this.error = '';
                    try {
                        const response = await fetch('/api/templates', { headers: { 'Accept': 'application/json' } });
                        if (response.status === 401) {
                            window.location.href = '/login';
                            return;
                        }
                        if (!response.ok) throw new Error(await response.text());
                        this.templates = await response.json();
                        const first = this.templates.find(t => t.id === this.selectedTemplateId) || this.templates[0];
                        if (first) {
                            await this.selectTemplate(first.id);
                        }
                    } catch (error) {
                        this.error = error.message || '模板加载失败';
                    } finally {
                        this.loadingTemplates = false;
                    }
                },

                async selectTemplate(id) {
                    this.selectedTemplateId = id;
                    this.error = '';
                    try {
                        const response = await fetch('/api/templates/' + encodeURIComponent(id), { headers: { 'Accept': 'application/json' } });
                        if (!response.ok) throw new Error(await response.text());
                        const template = await response.json();
                        this.templateName = template.name;
                        this.templateContent = template.content;
                        this.selectedTemplateBuiltIn = Boolean(template.builtIn);
                        this.status = '';
                    } catch (error) {
                        this.error = error.message || '模板读取失败';
                    }
                },

                newTemplate() {
                    const id = 'template-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
                    this.selectedTemplateId = id;
                    this.selectedTemplateBuiltIn = false;
                    this.templateName = 'My Mihomo Template';
                    this.templateContent = 'mixed-port: 7890\\nmode: rule\\nproxies: "{{PROXIES}}"\\nproxy-groups:\\n  - name: PROXY\\n    type: select\\n    proxies: "{{PROXY_NAMES}}"\\nrules:\\n  - MATCH,PROXY\\n';
                    this.activeTab = 'templates';
                    this.status = '新模板尚未保存';
                },

                async saveTemplate() {
                    this.savingTemplate = true;
                    this.error = '';
                    this.status = '';
                    try {
                        const response = await fetch('/api/templates/' + encodeURIComponent(this.selectedTemplateId), {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                            body: JSON.stringify({
                                name: this.templateName,
                                content: this.templateContent
                            })
                        });
                        if (!response.ok) throw new Error(await response.text());
                        const template = await response.json();
                        this.selectedTemplateId = template.id;
                        this.templateName = template.name;
                        this.templateContent = template.content;
                        this.selectedTemplateBuiltIn = Boolean(template.builtIn);
                        this.status = '模板已保存';
                        await this.loadTemplates();
                    } catch (error) {
                        this.error = error.message || '模板保存失败';
                    } finally {
                        this.savingTemplate = false;
                    }
                },

                async deleteTemplate() {
                    if (this.selectedTemplateBuiltIn) {
                        this.status = '内置模板不能删除';
                        return;
                    }
                    if (!this.selectedTemplateId) return;
                    const confirmed = window.confirm('删除模板 ' + this.selectedTemplateId + '？');
                    if (!confirmed) return;

                    this.savingTemplate = true;
                    this.error = '';
                    this.status = '';
                    try {
                        const deletedId = this.selectedTemplateId;
                        const response = await fetch('/api/templates/' + encodeURIComponent(deletedId), {
                            method: 'DELETE',
                            headers: { 'Accept': 'application/json' }
                        });
                        if (!response.ok) throw new Error(await response.text());
                        this.selectedTemplateId = 'android-phone';
                        this.selectedTemplateBuiltIn = true;
                        await this.loadTemplates();
                        this.status = '模板已删除';
                    } catch (error) {
                        this.error = error.message || '模板删除失败';
                    } finally {
                        this.savingTemplate = false;
                    }
                },

                async renderConfig() {
                    this.rendering = true;
                    this.error = '';
                    this.status = '';
                    this.renderedYaml = '';
                    this.downloadUrl = '';
                    this.downloadExpiresAt = '';
                    this.downloadFilename = '';
                    try {
                        const response = await fetch('/api/render-link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                            body: JSON.stringify({
                                templateId: this.selectedTemplateId,
                                templateName: this.templateName,
                                templateContent: this.templateContent,
                                nodes: this.nodeInput
                            })
                        });
                        const text = await response.text();
                        if (!response.ok) throw new Error(text);
                        const payload = JSON.parse(text);
                        this.downloadUrl = new URL(payload.downloadUrl, window.location.origin).href;
                        this.downloadExpiresAt = payload.expiresAt || '';
                        this.downloadFilename = payload.filename || 'mihomo.yaml';
                        const minutes = Math.max(1, Math.round((payload.expiresInSeconds || 600) / 60));
                        const retrySeconds = payload.retryWindowSeconds || 60;
                        this.status = '一次性下载链接已生成，' + minutes + ' 分钟内首次访问；访问后 ' + retrySeconds + ' 秒内允许客户端重试。';
                    } catch (error) {
                        this.error = error.message || '生成失败';
                    } finally {
                        this.rendering = false;
                    }
                },

                async copyOutput() {
                    const text = this.downloadUrl || this.renderedYaml;
                    if (!text) return;
                    const copied = await copyToClipboard(text);
                    this.status = copied ? '已复制下载链接' : '复制失败，请手动选择链接';
                },

                downloadOutput() {
                    if (!this.downloadUrl) return;
                    const link = document.createElement('a');
                    link.href = this.downloadUrl;
                    link.download = this.downloadFilename || 'mihomo.yaml';
                    link.click();
                },

                clearSensitive() {
                    this.nodeInput = '';
                    this.renderedYaml = '';
                    this.downloadUrl = '';
                    this.downloadExpiresAt = '';
                    this.downloadFilename = '';
                    this.status = '本次节点输入和输出已从页面清空';
                },

                async logout() {
                    await fetch('/auth/logout', { method: 'POST' });
                    window.location.href = '/login';
                }
            };
        };
    `;

    return (
        <div {...{ 'x-data': 'workbenchData()', 'x-init': 'init()' }} class="min-h-screen">
            <script dangerouslySetInnerHTML={{ __html: script }}></script>
            <header class="border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 sticky top-0 z-40">
                <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="/favicon.ico" alt="" class="w-7 h-7" />
                        <div class="min-w-0">
                            <h1 class="text-base font-semibold truncate">{APP_NAME}</h1>
                            <p class="text-xs text-gray-500 dark:text-gray-400">一次性生成，不保存节点</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" {...{ 'x-on:click': 'toggleDarkMode()' }} class="w-9 h-9 inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900" title="切换明暗">
                            <i class="fas" {...{ 'x-bind:class': "darkMode ? 'fa-sun' : 'fa-moon'" }}></i>
                        </button>
                        <button type="button" {...{ 'x-on:click': 'logout()' }} class="w-9 h-9 inline-flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900" title="退出">
                            <i class="fas fa-right-from-bracket"></i>
                        </button>
                    </div>
                </div>
            </header>

            <main class="max-w-7xl mx-auto px-4 py-6">
                <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
                    <aside class="space-y-3">
                        <div class="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                            <div class="flex items-center justify-between mb-3">
                                <h2 class="text-sm font-semibold">模板</h2>
                                <button type="button" {...{ 'x-on:click': 'newTemplate()' }} class="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-900" title="新建模板">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                            <div {...{ 'x-show': 'loadingTemplates' }} class="text-sm text-gray-500">加载中</div>
                            <div class="space-y-1">
                                <template {...{ 'x-for': 'template in templates', 'x-bind:key': 'template.id' }}>
                                    <button type="button" {...{ 'x-on:click': 'selectTemplate(template.id)', 'x-bind:class': "selectedTemplateId === template.id ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-900'" }} class="w-full text-left px-3 py-2 rounded-md text-sm truncate">
                                        <span {...{ 'x-text': 'template.name' }}></span>
                                    </button>
                                </template>
                            </div>
                        </div>

                        <div class="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            节点只在本次请求中处理。页面不会把节点写入 localStorage，也不会生成可复用订阅链接。
                        </div>
                    </aside>

                    <section class="space-y-4">
                        <div class="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-2 flex gap-2">
                            <button type="button" {...{ 'x-on:click': "activeTab = 'generate'", 'x-bind:class': "activeTab === 'generate' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950' : 'hover:bg-gray-100 dark:hover:bg-gray-900'" }} class="px-3 py-2 rounded-md text-sm font-medium">
                                生成
                            </button>
                            <button type="button" {...{ 'x-on:click': "activeTab = 'templates'", 'x-bind:class': "activeTab === 'templates' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-950' : 'hover:bg-gray-100 dark:hover:bg-gray-900'" }} class="px-3 py-2 rounded-md text-sm font-medium">
                                编辑模板
                            </button>
                        </div>

                        <div {...{ 'x-show': 'error', 'x-text': 'error' }} class="rounded-md border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200 px-3 py-2 text-sm"></div>
                        <div {...{ 'x-show': 'status', 'x-text': 'status' }} class="rounded-md border border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-200 px-3 py-2 text-sm"></div>

                        <div {...{ 'x-show': "activeTab === 'templates'" }} class="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-4">
                            <div>
                                <label class="block text-sm font-medium mb-1">模板 ID</label>
                                <input {...{ 'x-model': 'selectedTemplateId' }} class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-mono" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">模板名称</label>
                                <input {...{ 'x-model': 'templateName' }} class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">Mihomo YAML 模板</label>
                                <textarea {...{ 'x-model': 'templateContent' }} spellcheck="false" class="w-full min-h-[460px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-mono leading-5"></textarea>
                            </div>
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <button type="button" {...{ 'x-on:click': 'deleteTemplate()', 'x-bind:disabled': 'savingTemplate || selectedTemplateBuiltIn' }} class="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950" title="删除自定义模板">
                                    <i class="fas fa-trash"></i>
                                    <span>删除模板</span>
                                </button>
                                <button type="button" {...{ 'x-on:click': 'saveTemplate()', 'x-bind:disabled': 'savingTemplate' }} class="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                                    <i class="fas" {...{ 'x-bind:class': "savingTemplate ? 'fa-spinner fa-spin' : 'fa-save'" }}></i>
                                    <span {...{ 'x-text': "savingTemplate ? '保存中' : '保存模板'" }}></span>
                                </button>
                            </div>
                        </div>

                        <div {...{ 'x-show': "activeTab === 'generate'" }} class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div class="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
                                <div class="flex items-center justify-between">
                                    <label class="text-sm font-semibold">本次节点输入</label>
                                    <button type="button" {...{ 'x-on:click': 'clearSensitive()' }} class="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-900" title="清空敏感内容">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                                <textarea {...{ 'x-model': 'nodeInput' }} spellcheck="false" class="w-full min-h-[420px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-mono leading-5" placeholder="每行一个 vless:// / vmess:// / ss:// 节点，或粘贴 Mihomo proxies YAML。"></textarea>
                                <button type="button" {...{ 'x-on:click': 'renderConfig()', 'x-bind:disabled': 'rendering' }} class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200">
                                    <i class="fas" {...{ 'x-bind:class': "rendering ? 'fa-spinner fa-spin' : 'fa-bolt'" }}></i>
                                    <span {...{ 'x-text': "rendering ? '生成中' : '一次性生成 YAML'" }}></span>
                                </button>
                            </div>

                            <div class="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
                                <div class="flex items-center justify-between gap-2">
                                    <h2 class="text-sm font-semibold">输出</h2>
                                    <div class="flex items-center gap-1">
                                        <button type="button" {...{ 'x-on:click': 'copyOutput()' }} class="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-900" title="复制">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                        <button type="button" {...{ 'x-on:click': 'downloadOutput()' }} class="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-900" title="下载">
                                            <i class="fas fa-download"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <input {...{ 'x-model': 'downloadUrl' }} readonly spellcheck="false" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm font-mono" placeholder="生成后显示一次性下载链接。" />
                                    <div {...{ 'x-show': 'downloadUrl' }} class="text-xs text-gray-500 dark:text-gray-400">
                                        <span>首次访问后短时间内允许客户端重试</span>
                                        <span {...{ 'x-show': 'downloadExpiresAt' }}>，过期时间 </span>
                                        <span {...{ 'x-show': 'downloadExpiresAt', 'x-text': 'new Date(downloadExpiresAt).toLocaleString()' }}></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};
