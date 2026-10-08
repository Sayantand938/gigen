import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    assertWritable,
    buildGitignore,
    formatTemplateBlock,
    OverwriteError,
    resolveTarget,
    writeGitignore,
} from '../src/generator.js';

const NODE = { name: 'Node', path: 'Node.gitignore' };
const PYTHON = { name: 'Python', path: 'Python.gitignore' };

async function tempDir(t) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gigen-'));
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    return dir;
}

test('formatTemplateBlock labels the block and trims trailing whitespace', () => {
    assert.equal(formatTemplateBlock(NODE, 'node_modules/\n\n'), '### Node (Node.gitignore) ###\nnode_modules/\n');
});

test('buildGitignore separates blocks with a blank line', () => {
    const output = buildGitignore([NODE, PYTHON], ['node_modules/\n', '__pycache__/\n']);

    assert.equal(
        output,
        '### Node (Node.gitignore) ###\nnode_modules/\n\n### Python (Python.gitignore) ###\n__pycache__/\n'
    );
});

test('assertWritable refuses to clobber an existing file', () => {
    assert.throws(() => assertWritable({ exists: true, targetFile: '.gitignore' }), OverwriteError);
});

test('assertWritable allows the documented escape hatches', () => {
    for (const options of [{ force: true }, { append: true }, { print: true }]) {
        assert.doesNotThrow(() => assertWritable({ exists: true, ...options, targetFile: '.gitignore' }));
    }
});

test('assertWritable allows writing a fresh file', () => {
    assert.doesNotThrow(() => assertWritable({ exists: false, targetFile: '.gitignore' }));
});

test('OverwriteError names the offending file', () => {
    const error = new OverwriteError('.gitignore');

    assert.equal(error.name, 'OverwriteError');
    assert.match(error.message, /\.gitignore/);
    assert.equal(error.targetFile, '.gitignore');
});

test('resolveTarget reports existence relative to the given directory', async (t) => {
    const dir = await tempDir(t);

    const missing = resolveTarget(dir);
    assert.equal(missing.targetFile, '.gitignore');
    assert.equal(missing.fileExists, false);

    await fs.writeFile(missing.targetPath, 'node_modules/');
    assert.equal(resolveTarget(dir).fileExists, true);
});

test('resolveTarget honours a custom output name', async (t) => {
    const dir = await tempDir(t);
    const target = resolveTarget(dir, 'nested/custom.ignore');

    assert.equal(target.targetFile, 'nested/custom.ignore');
    assert.equal(target.targetPath, path.join(dir, 'nested', 'custom.ignore'));
});

test('writeGitignore writes a new file', async (t) => {
    const target = path.join(await tempDir(t), '.gitignore');

    assert.equal(await writeGitignore(target, 'node_modules/\n'), 'written');
    assert.equal(await fs.readFile(target, 'utf8'), 'node_modules/\n');
});

test('writeGitignore appends to an existing file with a blank line separation', async (t) => {
    const target = path.join(await tempDir(t), '.gitignore');
    await writeGitignore(target, 'node_modules/\n');

    assert.equal(await writeGitignore(target, 'dist/\n', { append: true, fileExists: true }), 'appended');
    assert.equal(await fs.readFile(target, 'utf8'), 'node_modules/\n\n\ndist/\n');
});

test('writeGitignore creates missing parent directories', async (t) => {
    const dir = await tempDir(t);
    const target = path.join(dir, '.docker', 'nested', '.gitignore');

    assert.equal(await writeGitignore(target, 'node_modules/\n'), 'written');
    assert.equal(await fs.readFile(target, 'utf8'), 'node_modules/\n');
});

test('writeGitignore overwrites when append is requested but no file exists', async (t) => {
    const target = path.join(await tempDir(t), '.gitignore');

    assert.equal(await writeGitignore(target, 'dist/\n', { append: true, fileExists: false }), 'written');
    assert.equal(await fs.readFile(target, 'utf8'), 'dist/\n');
});
