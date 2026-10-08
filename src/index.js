/**
 * Programmatic API for gigen.
 *
 * The CLI is the primary interface, but the whole pipeline is exported so it can
 * be reused, embedded or tested without spawning a process.
 */

export {
    CACHE_CONFIG,
    DEFAULT_OUTPUT_FILE,
    FALLBACK_TEMPLATES,
    FUZZY_SEARCH_OPTIONS,
    GITHUB_CONFIG,
    OS_TEMPLATE_MAP,
    PACKAGE_NAME,
} from './config.js';

export { DETECTION_RULES, detectTemplates, readProjectFiles } from './detect.js';

export {
    buildRawUrl,
    clearCache,
    createCache,
    downloadTemplate,
    listTemplates,
    parseTemplateTree,
    readCachedTemplates,
} from './templates.js';

export {
    assertWritable,
    buildGitignore,
    formatTemplateBlock,
    OverwriteError,
    resolveTarget,
    writeGitignore,
} from './generator.js';
