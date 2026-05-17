import { CloudflareKVAdapter } from '../adapters/kv/cloudflareKv.js';

export function createCloudflareRuntime(env) {
    return {
        kv: env?.SUBLINK_KV ? new CloudflareKVAdapter(env.SUBLINK_KV) : null,
        assetFetcher: env?.ASSETS ? (request) => env.ASSETS.fetch(request) : null,
        logger: console,
        config: {
            authSecret: env?.AUTH_SECRET,
            adminUsername: env?.ADMIN_USERNAME,
            adminPasswordSha256: env?.ADMIN_PASSWORD_SHA256,
            sessionTtlSeconds: parseNumber(env?.SESSION_TTL_SECONDS),
            oneTimeDownloadTtlSeconds: parseNumber(env?.ONE_TIME_DOWNLOAD_TTL_SECONDS),
            oneTimeDownloadRetryWindowSeconds: parseNumber(env?.ONE_TIME_DOWNLOAD_RETRY_WINDOW_SECONDS)
        }
    };
}

function parseNumber(value) {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
