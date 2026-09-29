#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { createSpinner } from 'nanospinner';
import pc from 'picocolors';
import Fuse from 'fuse.js';
import Conf from 'conf';
import boxen from 'boxen';

import {
    GITHUB_CONFIG,
    CACHE_CONFIG,
    FUZZY_SEARCH_OPTIONS,
    FALLBACK_TEMPLATES,
    DETECTION_RULES,
} from '../src/config.js';

const config = new Conf({ projectName: CACHE_CONFIG.projectName });

// Text badges (no ticks, no emojis)
const STATUS = {
    ok: pc.green('[OK]'),
    warn: pc.yellow('[WARN]'),
    err: pc.red('[ERROR]'),
};

/**
 * Scan current directory and return matched templates based on DETECTION_RULES
 */
function scanProject(availableTemplates) {
    let projectFiles = [];
    try {
        projectFiles = readdirSync(process.cwd());
    } catch {
        return [];
    }

    const detectedTemplates = [];
    const addedNames = new Set();

    for (const rule of DETECTION_RULES) {
        if (rule.match(projectFiles)) {
            const match = availableTemplates.find(
                (t) => t.name.toLowerCase() === rule.name.toLowerCase()
            );
            if (match && !addedNames.has(match.name)) {
                detectedTemplates.push(match);
                addedNames.add(match.name);
            }
        }
    }

    // OS detection
    const osMap = { darwin: 'macos', win32: 'windows', linux: 'linux' };
    const currentOS = osMap[process.platform];
    if (currentOS) {
        const osTemplate = availableTemplates.find((t) => t.name.toLowerCase() === currentOS);
        if (osTemplate && !addedNames.has(osTemplate.name)) {
            detectedTemplates.push(osTemplate);
        }
    }

    return detectedTemplates;
}

/**
 * Fetch or load cached templates list
 */
async function fetchTemplateList(forceRefresh = false) {
    const cached = config.get(CACHE_CONFIG.key);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_CONFIG.ttl) {
        return cached.data;
    }

    const spinner = createSpinner('Fetching template list from GitHub...').start();

    try {
        const res = await fetch(GITHUB_CONFIG.treeApiUrl, { headers: GITHUB_CONFIG.headers });
        if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);

        const data = await res.json();
        const templates = data.tree
            .filter((file) => file.type === 'blob' && file.path.endsWith('.gitignore'))
            .map((file) => ({
                name: path.basename(file.path, '.gitignore'),
                path: file.path,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        config.set(CACHE_CONFIG.key, { timestamp: Date.now(), data: templates });
        spinner.success({
            text: pc.green(`Loaded ${templates.length} templates (cached locally)`),
            mark: STATUS.ok,
        });
        return templates;
    } catch {
        spinner.warn({
            text: pc.yellow('Using fallback templates (offline or rate-limited)'),
            mark: STATUS.warn,
        });
        return cached?.data || FALLBACK_TEMPLATES;
    }
}

/**
 * Download raw template text from GitHub
 */
async function fetchTemplateContent(filePath) {
    const res = await fetch(`${GITHUB_CONFIG.rawBaseUrl}/${filePath}`, {
        headers: GITHUB_CONFIG.headers,
    });
    if (!res.ok) throw new Error(`Failed to download ${filePath}`);
    return await res.text();
}

/**
 * Generate and write .gitignore
 */
async function generateGitignore(selectedTemplates, options) {
    if (!selectedTemplates || selectedTemplates.length === 0) {
        console.error(`${STATUS.err} No templates selected. Aborted.`);
        process.exit(1);
    }

    const targetFile = options.output || '.gitignore';
    const targetPath = path.resolve(process.cwd(), targetFile);
    const fileExists = existsSync(targetPath);

    // Guard against accidental overwrite without prompts
    if (fileExists && !options.append && !options.force && !options.print) {
        console.error(
            `${STATUS.err} "${targetFile}" already exists.\n` +
            `      Use ${pc.cyan('-f, --force')} to overwrite or ${pc.cyan('-a, --append')} to append.`
        );
        process.exit(1);
    }

    const downloadSpinner = createSpinner(
        `Downloading ${selectedTemplates.map((t) => pc.cyan(t.name)).join(', ')}...`
    ).start();

    const contents = await Promise.all(
        selectedTemplates.map(async (t) => {
            const text = await fetchTemplateContent(t.path);
            return `### ${t.name} (${t.path}) ###\n${text.trim()}\n`;
        })
    );

    downloadSpinner.success({
        text: pc.green('Downloaded templates successfully!'),
        mark: STATUS.ok,
    });

    const finalOutput = contents.join('\n');

    if (options.print) {
        console.log('\n' + pc.bold(pc.underline('.gitignore Preview:')) + '\n');
        console.log(pc.dim(finalOutput));
        return;
    }

    if (options.append && fileExists) {
        await fs.appendFile(targetPath, `\n\n${finalOutput}`, 'utf8');
    } else {
        await fs.writeFile(targetPath, finalOutput, 'utf8');
    }

    console.log(
        boxen(
            `${STATUS.ok} ${options.append && fileExists ? 'Appended to' : 'Generated'} ${pc.bold(targetFile)}\n\n` +
            `${pc.dim('Included:')} ${selectedTemplates.map((t) => pc.cyan(t.name)).join(', ')}`,
            {
                padding: 1,
                margin: { top: 1, bottom: 0 },
                borderColor: 'green',
                borderStyle: 'round',
            }
        )
    );
}

// -------------------------------------------------------------
// Commander Setup
// -------------------------------------------------------------
const program = new Command();

program
    .name('gitignore-gen')
    .description('Fast, non-interactive .gitignore generator backed by github/gitignore')
    .version('1.0.0', '-v, --version', 'Output the current version')
    .argument('[templates...]', 'Template name(s) (e.g. node vsc windows)')
    .option('-f, --force', 'Force overwrite if .gitignore already exists', false)
    .option('-a, --append', 'Append to existing file instead of overwriting', false)
    .option('-o, --output <file>', 'Output destination path', '.gitignore')
    .option('-p, --print', 'Print to stdout instead of writing to a file', false)
    .option('-l, --list', 'List all available templates', false)
    .option('-r, --refresh', 'Force refresh templates cache from GitHub', false)
    .action(async (templatesArg, options) => {
        try {
            const availableTemplates = await fetchTemplateList(options.refresh);

            if (options.list) {
                console.log(pc.bold('\nAvailable Templates:'));
                availableTemplates.forEach((t) =>
                    console.log(`  ${pc.cyan('•')} ${t.name} ${pc.dim(`(${t.path})`)}`)
                );
                return;
            }

            let selectedTemplates = [];

            // 1. Direct templates provided by user
            if (templatesArg && templatesArg.length > 0) {
                const fuse = new Fuse(availableTemplates, FUZZY_SEARCH_OPTIONS);
                for (const arg of templatesArg) {
                    const results = fuse.search(arg);
                    if (results.length > 0) {
                        selectedTemplates.push(results[0].item);
                    } else {
                        console.log(`${STATUS.warn} No match found for "${arg}". Skipping.`);
                    }
                }
            }
            // 2. No arguments given -> Auto-detect automatically
            else {
                const detected = scanProject(availableTemplates);
                if (detected.length === 0) {
                    console.error(
                        `${STATUS.err} No templates specified and nothing could be auto-detected.\n` +
                        `      Provide template names (e.g. ${pc.cyan('gitignore-gen node vsc')}) or run ${pc.cyan('gitignore-gen --list')}.`
                    );
                    process.exit(1);
                }

                console.log(
                    `🔍 Auto-detected stack: ${detected.map((d) => pc.green(pc.bold(d.name))).join(', ')}`
                );
                selectedTemplates = detected;
            }

            await generateGitignore(selectedTemplates, options);
        } catch (err) {
            console.error(`\n${STATUS.err} Error: ${err.message}`);
            process.exit(1);
        }
    });

// Subcommand: `clean`
program
    .command('clean')
    .description('Clear locally cached template list')
    .action(() => {
        config.delete(CACHE_CONFIG.key);
        console.log(`${STATUS.ok} Cache cleared.`);
    });

// Examples in help screen
program.addHelpText(
    'after',
    `
${pc.bold('Examples:')}
  $ ${pc.cyan('gitignore-gen')}                  ${pc.dim('# Auto-detects stack and generates .gitignore')}
  $ ${pc.cyan('gitignore-gen -f')}               ${pc.dim('# Auto-detects and force overwrites existing file')}
  $ ${pc.cyan('gitignore-gen node vsc -f')}      ${pc.dim('# Force overwrite with Node + VS Code')}
  $ ${pc.cyan('gitignore-gen macos -a')}         ${pc.dim('# Append macOS rules to existing .gitignore')}
  $ ${pc.cyan('gitignore-gen python --print')}   ${pc.dim('# Preview Python gitignore to console')}
  $ ${pc.cyan('gitignore-gen clean')}            ${pc.dim('# Clear 24-hour cache')}
`
);

program.parse(process.argv);