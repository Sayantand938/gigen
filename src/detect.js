import { readdirSync } from 'node:fs';

import { OS_TEMPLATE_MAP } from './config.js';

/**
 * Project auto-detection.
 *
 * `detectTemplates` is intentionally pure: give it the file list, the platform
 * and the available templates and it returns matches. That keeps it trivial to
 * unit test and keeps `npm test` offline.
 */

/**
 * Rules mapping project files to github/gitignore templates.
 * Add a new object here to support another technology.
 */
export const DETECTION_RULES = [
    // --- Frameworks ---
    {
        name: 'Nextjs',
        match: (files) => files.some((f) => /^next\.config\.(js|mjs|ts)$/.test(f)),
    },
    {
        name: 'Nestjs',
        match: (files) => files.includes('nest-cli.json'),
    },
    {
        name: 'Flutter',
        match: (files) => files.includes('pubspec.yaml') && files.includes('android'),
    },
    {
        name: 'Dart',
        match: (files) => files.includes('pubspec.yaml'),
    },
    {
        name: 'Godot',
        match: (files) => files.includes('project.godot'),
    },
    {
        name: 'Unity',
        match: (files) => files.includes('ProjectSettings') && files.includes('Assets'),
    },

    // --- Languages & package managers ---
    {
        name: 'Node',
        match: (files) =>
            files.some((f) =>
                ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb'].includes(f)
            ),
    },
    {
        name: 'Python',
        match: (files) =>
            files.some((f) =>
                [
                    'requirements.txt',
                    'pyproject.toml',
                    'Pipfile',
                    'setup.py',
                    'environment.yml',
                    'poetry.lock',
                    'uv.lock',
                ].includes(f)
            ),
    },
    {
        name: 'Rust',
        match: (files) => files.includes('Cargo.toml'),
    },
    {
        name: 'Go',
        match: (files) => files.includes('go.mod'),
    },
    {
        name: 'Java',
        match: (files) =>
            files.some((f) =>
                ['pom.xml', 'build.gradle', 'build.gradle.kts', 'mvnw', 'gradlew'].includes(f)
            ),
    },
    {
        name: 'C++',
        match: (files) =>
            files.some((f) => ['CMakeLists.txt', 'Makefile', 'conanfile.txt'].includes(f) || f.endsWith('.cpp')),
    },
    {
        name: 'Terraform',
        match: (files) => files.some((f) => f.endsWith('.tf') || f.endsWith('.tfvars')),
    },

    // --- Editors & IDEs ---
    {
        name: 'VisualStudioCode',
        match: (files) => files.includes('.vscode'),
    },
    {
        name: 'JetBrains',
        match: (files) => files.includes('.idea'),
    },
];

/**
 * Read the entry names of a directory, tolerating unreadable paths.
 * @param {string} dir
 * @returns {string[]}
 */
export function readProjectFiles(dir) {
    try {
        return readdirSync(dir);
    } catch {
        return [];
    }
}

/**
 * Match a project's files against {@link DETECTION_RULES}.
 *
 * @param {Array<{name: string, path: string}>} availableTemplates templates known to exist upstream
 * @param {string[]} files entry names found in the project root
 * @param {string} platform a `process.platform` value
 * @returns {Array<{name: string, path: string}>} matched templates, deduplicated, in rule order
 */
export function detectTemplates(availableTemplates = [], files = [], platform = process.platform) {
    const byName = new Map(availableTemplates.map((template) => [template.name.toLowerCase(), template]));
    const detected = [];
    const seen = new Set();

    const add = (name) => {
        const key = name.toLowerCase();
        const template = byName.get(key);
        if (template && !seen.has(key)) {
            seen.add(key);
            detected.push(template);
        }
    };

    for (const rule of DETECTION_RULES) {
        if (rule.match(files)) add(rule.name);
    }

    const osTemplate = OS_TEMPLATE_MAP[platform];
    if (osTemplate) add(osTemplate);

    return detected;
}
