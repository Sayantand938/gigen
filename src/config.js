// src/config.js

/**
 * GitHub API & Raw content URLs
 */
export const GITHUB_CONFIG = {
    treeApiUrl: 'https://api.github.com/repos/github/gitignore/git/trees/main?recursive=1',
    rawBaseUrl: 'https://raw.githubusercontent.com/github/gitignore/main',
    headers: {
        'User-Agent': 'gitignore-gen-cli',
    },
};

/**
 * Local cache settings
 */
export const CACHE_CONFIG = {
    projectName: 'gitignore-gen',
    key: 'templates_cache',
    ttl: 1000 * 60 * 60 * 24, // 24 hours in milliseconds
};

/**
 * Fuzzy search options (Fuse.js)
 */
export const FUZZY_SEARCH_OPTIONS = {
    keys: ['name', 'path'],
    threshold: 0.35, // Lower = stricter, Higher = looser match
};

/**
 * Fallback templates used if offline or rate-limited by GitHub
 */
export const FALLBACK_TEMPLATES = [
    { name: 'Node', path: 'Node.gitignore' },
    { name: 'Python', path: 'Python.gitignore' },
    { name: 'Java', path: 'Java.gitignore' },
    { name: 'Go', path: 'Go.gitignore' },
    { name: 'Rust', path: 'Rust.gitignore' },
    { name: 'C++', path: 'C++.gitignore' },
    { name: 'Nextjs', path: 'Nextjs.gitignore' },
    { name: 'VisualStudioCode', path: 'Global/VisualStudioCode.gitignore' },
    { name: 'JetBrains', path: 'Global/JetBrains.gitignore' },
    { name: 'Windows', path: 'Global/Windows.gitignore' },
    { name: 'macOS', path: 'Global/macOS.gitignore' },
    { name: 'Linux', path: 'Global/Linux.gitignore' },
];

/**
 * Rules to automatically detect stacks, frameworks, tools, and editors.
 * Simply add a new object here to support more technologies!
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

    // --- Languages & Package Managers ---
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