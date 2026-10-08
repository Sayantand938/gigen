import test from 'node:test';
import assert from 'node:assert/strict';

import { CACHE_CONFIG, FALLBACK_TEMPLATES, GITHUB_CONFIG } from '../src/config.js';
import {
    buildRawUrl,
    downloadTemplate,
    listTemplates,
    parseTemplateTree,
    readCachedTemplates,
} from '../src/templates.js';

/** Minimal stand-in for the `conf` store. */
function memoryCache(initial) {
    const store = new Map(initial ? [[CACHE_CONFIG.key, initial]] : []);
    return {
        get: (key) => store.get(key),
        set: (key, value) => store.set(key, value),
        delete: (key) => store.delete(key),
    };
}

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

const TREE = {
    tree: [
        { type: 'blob', path: 'Global/VisualStudioCode.gitignore' },
        { type: 'blob', path: 'Node.gitignore' },
        { type: 'blob', path: 'README.md' },
        { type: 'tree', path: 'Global' },
        { type: 'blob', path: 'Python.gitignore' },
    ],
};

test('parseTemplateTree keeps only .gitignore blobs, sorted by name', () => {
    assert.deepEqual(parseTemplateTree(TREE), [
        { name: 'Node', path: 'Node.gitignore' },
        { name: 'Python', path: 'Python.gitignore' },
        { name: 'VisualStudioCode', path: 'Global/VisualStudioCode.gitignore' },
    ]);
});

test('parseTemplateTree tolerates a malformed payload', () => {
    assert.deepEqual(parseTemplateTree(undefined), []);
    assert.deepEqual(parseTemplateTree({}), []);
    assert.deepEqual(parseTemplateTree({ tree: null }), []);
    assert.deepEqual(parseTemplateTree({ tree: [{ type: 'blob' }] }), []);
});

test('buildRawUrl encodes path segments but keeps the directory structure', () => {
    assert.equal(buildRawUrl('Global/macOS.gitignore'), `${GITHUB_CONFIG.rawBaseUrl}/Global/macOS.gitignore`);
    assert.equal(buildRawUrl('C++.gitignore'), `${GITHUB_CONFIG.rawBaseUrl}/C%2B%2B.gitignore`);
    assert.equal(buildRawUrl('Foo Bar.gitignore'), `${GITHUB_CONFIG.rawBaseUrl}/Foo%20Bar.gitignore`);
});

test('downloadTemplate returns the body on success', async () => {
    const fetchImpl = async (url) => {
        assert.equal(url, buildRawUrl('Node.gitignore'));
        return { ok: true, status: 200, text: async () => 'node_modules/' };
    };

    assert.equal(await downloadTemplate('Node.gitignore', { fetchImpl }), 'node_modules/');
});

test('downloadTemplate reports the status when GitHub rejects the request', async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, text: async () => '' });
    await assert.rejects(() => downloadTemplate('Nope.gitignore', { fetchImpl }), /HTTP 404/);
});

test('listTemplates fetches from the network and caches the result', async () => {
    const cache = memoryCache();
    const result = await listTemplates({ cache, fetchImpl: async () => jsonResponse(TREE) });

    assert.equal(result.source, 'network');
    assert.equal(result.templates.length, 3);
    assert.deepEqual(cache.get(CACHE_CONFIG.key).data, result.templates);
});

test('listTemplates serves a fresh cache without touching the network', async () => {
    const cached = [{ name: 'Node', path: 'Node.gitignore' }];
    const cache = memoryCache({ timestamp: 1_000, data: cached });
    let called = false;

    const result = await listTemplates({
        cache,
        now: 1_000 + CACHE_CONFIG.ttl - 1,
        fetchImpl: async () => {
            called = true;
            return jsonResponse(TREE);
        },
    });

    assert.equal(called, false);
    assert.equal(result.source, 'cache');
    assert.deepEqual(result.templates, cached);
});

test('listTemplates refetches an expired cache', async () => {
    const cache = memoryCache({ timestamp: 1_000, data: [{ name: 'Stale', path: 'Stale.gitignore' }] });

    const result = await listTemplates({
        cache,
        now: 1_000 + CACHE_CONFIG.ttl + 1,
        fetchImpl: async () => jsonResponse(TREE),
    });

    assert.equal(result.source, 'network');
    assert.equal(result.templates.some((t) => t.name === 'Stale'), false);
});

test('listTemplates honours forceRefresh even on a fresh cache', async () => {
    const cache = memoryCache({ timestamp: 1_000, data: [{ name: 'Stale', path: 'Stale.gitignore' }] });

    const result = await listTemplates({
        cache,
        now: 1_000 + 1,
        forceRefresh: true,
        fetchImpl: async () => jsonResponse(TREE),
    });

    assert.equal(result.source, 'network');
    assert.equal(result.templates.length, 3);
});

test('listTemplates falls back to the bundled list when offline', async () => {
    const result = await listTemplates({
        cache: memoryCache(),
        fetchImpl: async () => {
            throw new Error('offline');
        },
    });

    assert.equal(result.source, 'fallback');
    assert.equal(result.templates, FALLBACK_TEMPLATES);
    assert.match(result.error.message, /offline/);
});

test('listTemplates prefers a stale cache over the bundled list', async () => {
    const stale = [{ name: 'Django', path: 'Django.gitignore' }];

    const result = await listTemplates({
        cache: memoryCache({ timestamp: 0, data: stale }),
        now: CACHE_CONFIG.ttl * 10,
        fetchImpl: async () => {
            throw new Error('offline');
        },
    });

    assert.equal(result.source, 'fallback');
    assert.deepEqual(result.templates, stale);
});

test('listTemplates falls back on an error status or an empty tree', async () => {
    const forbidden = await listTemplates({
        cache: memoryCache(),
        fetchImpl: async () => jsonResponse({}, { ok: false, status: 403 }),
    });
    const empty = await listTemplates({
        cache: memoryCache(),
        fetchImpl: async () => jsonResponse({ tree: [] }),
    });

    assert.equal(forbidden.source, 'fallback');
    assert.equal(empty.source, 'fallback');
    assert.equal(empty.templates, FALLBACK_TEMPLATES);
});

test('readCachedTemplates rejects malformed entries', () => {
    assert.equal(readCachedTemplates(memoryCache({ timestamp: 0 })), null);
    assert.equal(readCachedTemplates(memoryCache({ timestamp: 0, data: 'nope' })), null);
    assert.equal(readCachedTemplates(undefined), null);
});
