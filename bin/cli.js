#!/usr/bin/env node

import { createRequire } from 'node:module';
import process from 'node:process';

import { Command } from 'commander';
import Fuse from 'fuse.js';
import pc from 'picocolors';

import { DEFAULT_OUTPUT_FILE, FUZZY_SEARCH_OPTIONS, PACKAGE_NAME } from '../src/config.js';
import { detectTemplates, readProjectFiles } from '../src/detect.js';
import {
    assertWritable,
    buildGitignore,
    OverwriteError,
    resolveTarget,
    writeGitignore,
} from '../src/generator.js';
import { clearCache, createCache, downloadTemplate, listTemplates } from '../src/templates.js';
import {
    printDetection,
    printPreview,
    printSummary,
    printTemplateList,
    startSpinner,
    STATUS,
} from '../src/ui.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const cache = createCache();

/** Load the template list, reporting where it came from. */
async function loadTemplates(options) {
    const pending = startSpinner('Loading templates from github/gitignore...');
    const { templates, source } = await listTemplates({ cache, forceRefresh: options.refresh });

    if (source === 'network') {
        pending.success({
            text: pc.green(`Loaded ${templates.length} templates (cached locally)`),
            mark: STATUS.ok,
        });
    } else if (source === 'cache') {
        pending.success({
            text: pc.green(`Loaded ${templates.length} templates from cache`),
            mark: STATUS.ok,
        });
    } else {
        pending.warn({
            text: pc.yellow('Using fallback templates (offline or rate-limited)'),
            mark: STATUS.warn,
        });
    }

    return templates;
}

/**
 * Resolve templates from explicit names (fuzzy matched) or from the project.
 * Returns `null` when nothing was requested and nothing could be detected.
 */
function selectTemplates(templatesArg, availableTemplates) {
    if (templatesArg.length > 0) {
        const fuse = new Fuse(availableTemplates, FUZZY_SEARCH_OPTIONS);
        const selected = [];

        for (const arg of templatesArg) {
            const [best] = fuse.search(arg);
            if (best) selected.push(best.item);
            else console.log(`${STATUS.warn} No match found for "${arg}". Skipping.`);
        }

        return selected;
    }

    const detected = detectTemplates(availableTemplates, readProjectFiles(process.cwd()));
    if (detected.length === 0) {
        console.error(`${STATUS.err} No templates specified and nothing could be auto-detected.`);
        console.error(
            `      Provide template names (e.g. ${pc.cyan(`${PACKAGE_NAME} node vsc`)}) ` +
                `or run ${pc.cyan(`${PACKAGE_NAME} --list`)}.`
        );
        process.exitCode = 1;
        return null;
    }

    printDetection(detected);
    return detected;
}

/** Download the selected templates and write (or preview) the result. */
async function generate(selectedTemplates, options) {
    const unique = [...new Map(selectedTemplates.map((t) => [t.name.toLowerCase(), t])).values()];
    if (unique.length === 0) {
        console.error(`${STATUS.err} No templates selected. Aborted.`);
        process.exitCode = 1;
        return;
    }

    const target = resolveTarget(process.cwd(), options.output);
    assertWritable({
        exists: target.fileExists,
        append: options.append,
        force: options.force,
        print: options.print,
        targetFile: target.targetFile,
    });

    const pending = startSpinner(`Downloading ${unique.map((t) => pc.cyan(t.name)).join(', ')}...`);

    let contents;
    try {
        contents = await Promise.all(unique.map((t) => downloadTemplate(t.path)));
    } catch (error) {
        pending.error({ text: pc.red(`Download failed: ${error.message}`), mark: STATUS.err });
        throw error;
    }

    pending.success({ text: pc.green('Downloaded templates successfully!'), mark: STATUS.ok });

    const output = buildGitignore(unique, contents);

    if (options.print) {
        printPreview(output);
        return;
    }

    const action = await writeGitignore(target.targetPath, output, {
        append: options.append,
        fileExists: target.fileExists,
    });

    printSummary({ targetFile: target.targetFile, appended: action === 'appended', templates: unique });
}

// ---------------------------------------------------------------------------
// Commander wiring
// ---------------------------------------------------------------------------
const program = new Command();

program
    .name(PACKAGE_NAME)
    .description('Fast, non-interactive .gitignore generator backed by github/gitignore')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .argument('[templates...]', 'Template name(s) (e.g. node vsc windows)')
    .option('-f, --force', 'Force overwrite if the output file already exists', false)
    .option('-a, --append', 'Append to existing file instead of overwriting', false)
    .option('-o, --output <file>', 'Output destination path', DEFAULT_OUTPUT_FILE)
    .option('-p, --print', 'Print to stdout instead of writing to a file', false)
    .option('-l, --list', 'List all available templates', false)
    .option('-r, --refresh', 'Force refresh templates cache from GitHub', false)
    .action(async (templatesArg, options) => {
        try {
            const availableTemplates = await loadTemplates(options);

            if (options.list) {
                printTemplateList(availableTemplates);
                return;
            }

            const selected = selectTemplates(templatesArg, availableTemplates);
            if (!selected) return;

            await generate(selected, options);
        } catch (error) {
            // Set the exit code instead of calling process.exit(): an explicit
            // exit while the HTTP client still holds keep-alive sockets aborts
            // the process on Windows, yielding a bogus non-1 exit status.
            process.exitCode = 1;

            if (error instanceof OverwriteError) {
                console.error(`${STATUS.err} ${error.message}`);
                console.error(
                    `      Use ${pc.cyan('-f, --force')} to overwrite or ${pc.cyan('-a, --append')} to append.`
                );
                return;
            }

            console.error(`\n${STATUS.err} Error: ${error.message}`);
        }
    });

program
    .command('clean')
    .description('Clear locally cached template list')
    .action(() => {
        clearCache(cache);
        console.log(`${STATUS.ok} Cache cleared.`);
    });

program.addHelpText(
    'after',
    `
${pc.bold('Examples:')}
  $ ${pc.cyan(PACKAGE_NAME)}                  ${pc.dim('# Auto-detect the stack and generate .gitignore')}
  $ ${pc.cyan(`${PACKAGE_NAME} -f`)}               ${pc.dim('# Auto-detect and force overwrite an existing file')}
  $ ${pc.cyan(`${PACKAGE_NAME} node vsc -f`)}      ${pc.dim('# Force overwrite with Node + VS Code')}
  $ ${pc.cyan(`${PACKAGE_NAME} macos -a`)}         ${pc.dim('# Append macOS rules to an existing .gitignore')}
  $ ${pc.cyan(`${PACKAGE_NAME} python --print`)}   ${pc.dim('# Preview the Python rules in the terminal')}
  $ ${pc.cyan(`${PACKAGE_NAME} clean`)}            ${pc.dim('# Clear the cached template list')}
`
);

program.parse(process.argv);
