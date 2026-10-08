/**
 * Static configuration for gigen.
 *
 * This module is data only: no I/O, no side effects. Anything that decides how
 * the tool behaves at runtime lives in the sibling modules.
 */

/** Command name used in help text and error hints. */
export const PACKAGE_NAME = 'gigen';

/** Default file that generated rules are written to. */
export const DEFAULT_OUTPUT_FILE = '.gitignore';

/** Where the upstream template collection lives. */
export const GITHUB_CONFIG = {
    /** Recursive tree listing of github/gitignore, used to discover templates. */
    treeApiUrl: 'https://api.github.com/repos/github/gitignore/git/trees/main?recursive=1',
    /** Raw file host, used to download template bodies. */
    rawBaseUrl: 'https://raw.githubusercontent.com/github/gitignore/main',
    headers: {
        'User-Agent': 'gigen-cli',
    },
};

/** Local cache used to avoid hammering the GitHub API. */
export const CACHE_CONFIG = {
    projectName: 'gigen',
    key: 'templates_cache',
    ttl: 1000 * 60 * 60 * 24, // 24 hours
};

/** Fuse.js tuning for matching a user supplied name to a template. */
export const FUZZY_SEARCH_OPTIONS = {
    keys: ['name', 'path'],
    threshold: 0.35, // lower is stricter, higher is looser
};

/** Used when GitHub is unreachable or rate limiting us. */
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

/** Maps a Node platform to the matching github/gitignore template. */
export const OS_TEMPLATE_MAP = {
    darwin: 'macos',
    win32: 'windows',
    linux: 'linux',
};
