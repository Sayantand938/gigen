import boxen from 'boxen';
import { createSpinner } from 'nanospinner';
import pc from 'picocolors';

/**
 * Terminal presentation.
 *
 * Every user-facing string funnels through this module so the library layer
 * stays silent and the CLI layer stays about control flow.
 */

/** Text status badges (deliberately no ticks and no emojis). */
export const STATUS = {
    ok: pc.green('[OK]'),
    warn: pc.yellow('[WARN]'),
    err: pc.red('[ERROR]'),
};

/** Start a spinner and return its handle so the caller can settle it. */
export function startSpinner(text) {
    return createSpinner(text).start();
}

export function printTemplateList(templates) {
    console.log(pc.bold('\nAvailable Templates:'));
    for (const template of templates) {
        console.log(`  ${pc.cyan('•')} ${template.name} ${pc.dim(`(${template.path})`)}`);
    }
}

export function printDetection(templates) {
    const label = templates.map((template) => pc.green(pc.bold(template.name))).join(', ');
    console.log(`${STATUS.ok} Auto-detected stack: ${label}`);
}

export function printPreview(content) {
    console.log('\n' + pc.bold(pc.underline('.gitignore Preview:')) + '\n');
    console.log(pc.dim(content));
}

export function printSummary({ targetFile, appended, templates }) {
    const verb = appended ? 'Appended to' : 'Generated';
    const included = templates.map((template) => pc.cyan(template.name)).join(', ');

    console.log(
        boxen(`${STATUS.ok} ${verb} ${pc.bold(targetFile)}\n\n${pc.dim('Included:')} ${included}`, {
            padding: 1,
            margin: { top: 1, bottom: 0 },
            borderColor: 'green',
            borderStyle: 'round',
        })
    );
}
