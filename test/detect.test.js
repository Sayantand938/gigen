import test from 'node:test';
import assert from 'node:assert/strict';

import { detectTemplates, readProjectFiles } from '../src/detect.js';

const TEMPLATES = [
    { name: 'Node', path: 'Node.gitignore' },
    { name: 'Nextjs', path: 'Nextjs.gitignore' },
    { name: 'Python', path: 'Python.gitignore' },
    { name: 'Flutter', path: 'Flutter.gitignore' },
    { name: 'Dart', path: 'Dart.gitignore' },
    { name: 'VisualStudioCode', path: 'Global/VisualStudioCode.gitignore' },
    { name: 'macOS', path: 'Global/macOS.gitignore' },
    { name: 'Windows', path: 'Global/Windows.gitignore' },
    { name: 'Linux', path: 'Global/Linux.gitignore' },
];

const detect = (files, platform = 'linux') => detectTemplates(TEMPLATES, files, platform).map((t) => t.name);

test('detects Node from any known lockfile', () => {
    for (const file of ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb']) {
        assert.ok(detect([file]).includes('Node'), `expected ${file} to trigger Node`);
    }
});

test('detects Python from any known project file', () => {
    for (const file of ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'environment.yml', 'poetry.lock', 'uv.lock']) {
        assert.ok(detect([file]).includes('Python'), `expected ${file} to trigger Python`);
    }
});

test('framework rules are evaluated before the language they build on', () => {
    assert.deepEqual(detect(['next.config.mjs', 'package.json'], 'darwin'), ['Nextjs', 'Node', 'macOS']);
    assert.deepEqual(detect(['pubspec.yaml', 'android'], 'linux'), ['Flutter', 'Dart', 'Linux']);
});

test('appends the template matching the host platform', () => {
    assert.deepEqual(detect(['package.json'], 'darwin'), ['Node', 'macOS']);
    assert.deepEqual(detect(['package.json'], 'win32'), ['Node', 'Windows']);
    assert.deepEqual(detect(['package.json'], 'linux'), ['Node', 'Linux']);
});

test('ignores platforms that have no template', () => {
    assert.deepEqual(detect(['package.json'], 'freebsd'), ['Node']);
    assert.deepEqual(detect([], 'freebsd'), []);
});

test('never returns the same template twice', () => {
    const names = detect(['package.json', 'pnpm-lock.yaml', 'yarn.lock'], 'linux');
    assert.deepEqual(names, ['Node', 'Linux']);
    assert.equal(new Set(names).size, names.length);
});

test('skips rules whose template is missing upstream', () => {
    const available = [{ name: 'Rust', path: 'Rust.gitignore' }];
    assert.deepEqual(detectTemplates(available, ['package.json', 'Cargo.toml'], 'freebsd'), [
        { name: 'Rust', path: 'Rust.gitignore' },
    ]);
});

test('matches templates case-insensitively', () => {
    const available = [{ name: 'node', path: 'Node.gitignore' }];
    assert.deepEqual(detectTemplates(available, ['package.json'], 'freebsd'), available);
});

test('readProjectFiles returns an empty list for an unreadable directory', () => {
    assert.deepEqual(readProjectFiles('definitely-not-a-real-directory-9x8y7z'), []);
});
