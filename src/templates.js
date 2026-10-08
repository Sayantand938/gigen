import path from 'node:path';

import Conf from 'conf';

import { CACHE_CONFIG, FALLBACK_TEMPLATES, GITHUB_CONFIG } from './config.js';

/**
 * Template discovery and download.
 *
 * Network access is injected as `fetchImpl` so tests never touch GitHub, and
 * every function here is silent: the CLI layer owns all user-facing output.
 */

/** Create the on-disk cache store used for the template list. */
export function createCache() {
    return new Conf({ projectName: CACHE_CONFIG.projectName });
}

/**
 * Reduce the GitHub tree payload to the flat template list used everywhere else.
 *
 * @param {{tree?: Array<{path?: string, type?: string}>}} payload
 * @returns {Array<{name: string, path: string}>} sorted by template name
 */
export function parseTemplateTree(payload) {
    const tree = Array.isArray(payload?.tree) ? payload.tree : [];

    return tree
        .filter((entry) => entry?.type === 'blob' && typeof entry.path === 'string' && entry.path.endsWith('.gitignore'))
        .map((entry) => ({ name: path.posix.basename(entry.path, '.gitignore'), path: entry.path }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Read the cached template list, if any.
 *
 * @returns {{templates: Array<object>, isFresh: boolean}|null}
 */
export function readCachedTemplates(cache, now = Date.now()) {
    const cached = cache?.get(CACHE_CONFIG.key);
    if (!cached || !Array.isArray(cached.data)) return null;

    return {
        templates: cached.data,
        isFresh: typeof cached.timestamp === 'number' && now - cached.timestamp < CACHE_CONFIG.ttl,
    };
}

/**
 * Build the raw download URL for a template, encoding every path segment.
 * Upstream names contain characters such as `+` and spaces.
 */
export function buildRawUrl(filePath) {
    const encoded = String(filePath)
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    return `${GITHUB_CONFIG.rawBaseUrl}/${encoded}`;
}

/**
 * Download a single template body.
 * @throws when GitHub responds with a non-2xx status
 */
export async function downloadTemplate(filePath, { fetchImpl = fetch } = {}) {
    const res = await fetchImpl(buildRawUrl(filePath), { headers: GITHUB_CONFIG.headers });
    if (!res.ok) throw new Error(`Failed to download ${filePath} (HTTP ${res.status})`);

    return res.text();
}

/**
 * Resolve the template list, preferring a fresh cache and falling back to a
 * bundled list when GitHub is unreachable.
 *
 * @returns {Promise<{templates: Array<object>, source: 'cache'|'network'|'fallback', error?: Error}>}
 */
export async function listTemplates({ cache, forceRefresh = false, now = Date.now(), fetchImpl = fetch } = {}) {
    const cached = readCachedTemplates(cache, now);
    if (cached?.isFresh && !forceRefresh) {
        return { templates: cached.templates, source: 'cache' };
    }

    try {
        const res = await fetchImpl(GITHUB_CONFIG.treeApiUrl, { headers: GITHUB_CONFIG.headers });
        if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);

        const templates = parseTemplateTree(await res.json());
        if (templates.length === 0) throw new Error('GitHub returned an empty template list');

        cache?.set(CACHE_CONFIG.key, { timestamp: now, data: templates });
        return { templates, source: 'network' };
    } catch (error) {
        return { templates: cached?.templates ?? FALLBACK_TEMPLATES, source: 'fallback', error };
    }
}

/** Drop the cached template list. */
export function clearCache(cache) {
    cache.delete(CACHE_CONFIG.key);
}
