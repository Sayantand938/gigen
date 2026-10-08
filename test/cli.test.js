import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

/**
 * Run the real CLI in a child process with the cache redirected to a throwaway
 * directory, so the suite never reads or writes the developer's own cache.
 */
function runCli(args) {
    const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gigen-conf-'));

    try {
        return spawnSync(process.execPath, [CLI, ...args], {
            cwd: path.dirname(CLI),
            encoding: 'utf8',
            env: {
                ...process.env,
                APPDATA: configHome,
                LOCALAPPDATA: configHome,
                XDG_CONFIG_HOME: configHome,
            },
        });
    } finally {
        fs.rmSync(configHome, { recursive: true, force: true });
    }
}

test('--version reports the version published in package.json', () => {
    const result = runCli(['--version']);

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), pkg.version);
});

test('--help describes the gigen command and its options', () => {
    const result = runCli(['--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: gigen/);
    assert.match(result.stdout, /--print/);
    assert.match(result.stdout, /clean/);
});

test('clean clears the cache and exits successfully', () => {
    const result = runCli(['clean']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Cache cleared/);
});

test('package metadata is ready to publish', () => {
    assert.equal(pkg.publishConfig.access, 'public', 'scoped packages must opt into public access');
    assert.equal(pkg.license, 'MIT');
    assert.ok(pkg.author, 'author must be set');
    assert.ok(pkg.repository.url.includes('github.com'));
    assert.ok(pkg.engines.node, 'engines.node must be set');
    assert.deepEqual(pkg.files, ['bin', 'src', 'README.md', 'LICENSE']);
});

test('the declared bin target exists', () => {
    assert.equal(pkg.bin.gigen, './bin/cli.js');
    assert.ok(fs.existsSync(path.join(path.dirname(CLI), '..', 'bin', 'cli.js')));
});
