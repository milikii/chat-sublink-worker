/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */
import { APP_NAME } from '../constants.js';

export const LoginPage = ({ error }) => {
    const script = `
        window.loginData = function () {
            return {
                username: 'admin',
                password: '',
                error: ${JSON.stringify(error || '')},
                loading: false,
                async login() {
                    this.loading = true;
                    this.error = '';
                    try {
                        const response = await fetch('/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                username: this.username,
                                password: this.password
                            })
                        });
                        if (!response.ok) {
                            this.error = '登录失败，请检查用户名和密码';
                            return;
                        }
                        window.location.href = '/';
                    } catch (error) {
                        this.error = '无法连接服务器';
                    } finally {
                        this.loading = false;
                        this.password = '';
                    }
                }
            };
        };
    `;

    return (
        <div class="min-h-screen flex items-center justify-center px-4 py-10">
            <script dangerouslySetInnerHTML={{ __html: script }}></script>
            <div {...{ 'x-data': 'loginData()' }} class="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-6">
                <div class="mb-6">
                    <div class="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center mb-4">
                        <i class="fas fa-lock"></i>
                    </div>
                    <h1 class="text-xl font-semibold text-gray-950 dark:text-white">{APP_NAME}</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">登录后生成一次性 Mihomo 配置。</p>
                </div>

                <form {...{ 'x-on:submit.prevent': 'login()' }} class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户名</label>
                        <input {...{ 'x-model': 'username' }} autocomplete="username" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
                        <input {...{ 'x-model': 'password' }} type="password" autocomplete="current-password" class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div {...{ 'x-show': 'error', 'x-text': 'error' }} class="text-sm text-red-600 dark:text-red-400"></div>
                    <button type="submit" {...{ 'x-bind:disabled': 'loading' }} class="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                        <i class="fas" {...{ 'x-bind:class': "loading ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'" }}></i>
                        <span {...{ 'x-text': "loading ? '登录中' : '登录'" }}>登录</span>
                    </button>
                </form>
            </div>
        </div>
    );
};
