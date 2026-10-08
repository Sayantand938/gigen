import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_OUTPUT_FILE } from './config.js';

/**
 * Turning downloaded templates into a `.gitignore` on disk.
 *
 * The guard rails (refusing to clobber an existing file) live here as testable
 * functions rather than as `process.exit` calls buried in the CLI.
 */

/** Thrown when writing would destroy an existing file the user did not ask to replace. */
export class OverwriteError extends Error {
    constructor(targetFile) {
        super(`"${targetFile}" already exists.`);
        this.name = 'OverwriteError';
        this.targetFile = targetFile;
    }
}

/**
 * Work out the destination file and whether it already exists.
 * @returns {{targetFile: string, targetPath: string, fileExists: boolean}}
 */
export function resolveTarget(cwd, outputFile = DEFAULT_OUTPUT_FILE) {
    const targetPath = path.resolve(cwd, outputFile);
    return { targetFile: outputFile, targetPath, fileExists: existsSync(targetPath) };
}

/**
 * Refuse to overwrite an existing file unless the user asked for one of the
 * destructive/benign escape hatches.
 *
 * @throws {OverwriteError}
 */
export function assertWritable({ exists, append = false, force = false, print = false, targetFile = DEFAULT_OUTPUT_FILE }) {
    if (exists && !append && !force && !print) {
        throw new OverwriteError(targetFile);
    }
}

/** Render one template as a labelled, newline terminated block. */
export function formatTemplateBlock(template, content) {
    return `### ${template.name} (${template.path}) ###\n${String(content).trim()}\n`;
}

/** Render every selected template into the final file body. */
export function buildGitignore(templates, contents) {
    return templates.map((template, index) => formatTemplateBlock(template, contents[index])).join('\n');
}

/**
 * Persist the generated rules.
 * @returns {Promise<'written'|'appended'>} what actually happened
 */
export async function writeGitignore(targetPath, content, { append = false, fileExists = false } = {}) {
    // `--output .docker/.gitignore` must work even when the directory is missing.
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    if (append && fileExists) {
        await fs.appendFile(targetPath, `\n\n${content}`, 'utf8');
        return 'appended';
    }

    await fs.writeFile(targetPath, content, 'utf8');
    return 'written';
}
