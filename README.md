# gigen

**Fast, non-interactive `.gitignore` generator backed by the [github/gitignore](https://github.com/github/gitignore) template collection.**

`gigen` inspects your project, works out which templates apply, and writes a single
`.gitignore` composed of the official upstream rules — no prompts, no menus, and no
hand-copied snippets.

```console
$ gigen
[OK] Loaded 312 templates from cache
[OK] Auto-detected stack: Node, VisualStudioCode, Windows
[OK] Downloaded templates successfully!

╭───────────────────────────────────────────────╮
│                                               │
│   [OK] Generated .gitignore                   │
│                                               │
│   Included: Node, VisualStudioCode, Windows   │
│                                               │
╰───────────────────────────────────────────────╯
```

The template count is whatever upstream currently offers; `gigen --list` prints the live list.

## Features

- **Auto-detects your stack** from the files in the current directory, plus the OS you are on.
- **Fuzzy template matching**, so `gigen node vsc` finds `Node` and `VisualStudioCode`.
- **Composes multiple templates** into one file with a labelled header per section.
- **Non-destructive by default** — it refuses to overwrite an existing file unless you pass `--force` or `--append`.
- **Preview mode** (`--print`) writes to stdout, so you can pipe or inspect before committing.
- **24-hour local cache** of the template list, with a bundled offline fallback.
- **No prompts, no colours-only output** — safe to use in scripts and CI.

## Installation

```bash
# Run once without installing
npx @sayantand938/gigen node vsc

# Or install globally
npm install --global @sayantand938/gigen
```

Requires **Node.js 22 or newer**. You can also run it straight from source:

```bash
git clone https://github.com/SayantanD938/gigen.git
cd gigen
npm install
npm start
```

## Usage

```bash
gigen [options] [templates...]
```

Pass template names explicitly, or pass nothing and let `gigen` detect the stack.

```bash
# Detect the stack and write .gitignore
gigen

# Specific templates
gigen node vsc windows

# Fuzzy names are fine
gigen react python3

# Preview without writing anything
gigen node --print

# Overwrite an existing .gitignore
gigen node python --force

# Add rules to an existing .gitignore instead of replacing it
gigen macos --append

# Write somewhere else
gigen go --output .docker/.gitignore

# See every template available upstream
gigen --list

# Drop the cached template list and refetch on next run
gigen clean
```

## Options

| Option | Description | Default |
| --- | --- | --- |
| `-f, --force` | Overwrite the output file if it already exists | `false` |
| `-a, --append` | Append to the output file instead of replacing it | `false` |
| `-o, --output <file>` | Destination path (missing parent directories are created) | `.gitignore` |
| `-p, --print` | Print to stdout instead of writing a file | `false` |
| `-l, --list` | List all available templates | `false` |
| `-r, --refresh` | Bypass the cache and refetch the template list | `false` |
| `-v, --version` | Print the version | |
| `-h, --help` | Show help | |

### Commands

| Command | Description |
| --- | --- |
| `gigen clean` | Clear the cached template list |

Without `--force`, `--append` or `--print`, `gigen` exits with status `1` rather than
overwriting an existing file.

## Auto-detection

When you do not name any templates, `gigen` reads the current directory and matches it
against the rules in [`src/detect.js`](src/detect.js). The first matching rule for a
template wins, and each template is only included once.

| Template | Detected from |
| --- | --- |
| `Nextjs` | `next.config.js`, `next.config.mjs`, `next.config.ts` |
| `Nestjs` | `nest-cli.json` |
| `Flutter` | `pubspec.yaml` + `android/` |
| `Dart` | `pubspec.yaml` |
| `Godot` | `project.godot` |
| `Unity` | `ProjectSettings/` + `Assets/` |
| `Node` | `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lockb` |
| `Python` | `requirements.txt`, `pyproject.toml`, `Pipfile`, `setup.py`, `environment.yml`, `poetry.lock`, `uv.lock` |
| `Rust` | `Cargo.toml` |
| `Go` | `go.mod` |
| `Java` | `pom.xml`, `build.gradle`, `build.gradle.kts`, `mvnw`, `gradlew` |
| `C++` | `CMakeLists.txt`, `Makefile`, `conanfile.txt`, `*.cpp` |
| `Terraform` | `*.tf`, `*.tfvars` |
| `VisualStudioCode` | `.vscode/` |
| `JetBrains` | `.idea/` |
| `macOS` / `Windows` / `Linux` | The host platform |

Framework rules are listed before the language rules they build on, so a Next.js project
gets `Nextjs` and `Node`.

To support another technology, add one entry to `DETECTION_RULES`:

```js
{
    name: 'SvelteKit',
    match: (files) => files.includes('svelte.config.js'),
}
```

## Output format

Each selected template is written as a labelled section, so it is always obvious where a
rule came from and re-running with a different set is easy to review:

```gitignore
### Node (Node.gitignore) ###
node_modules/
dist/

### Windows (Global/Windows.gitignore) ###
Thumbs.db
```

## Caching and offline behaviour

The template *list* is cached for 24 hours in your OS config directory (via
[`conf`](https://github.com/sindresorhus/conf)); template *bodies* are always fetched
fresh from `raw.githubusercontent.com`. Resulting cache behaviour:

| Situation | What happens |
| --- | --- |
| Cache is fresh | Template list is read locally, no API call |
| Cache expired or `--refresh` | Template list is refetched and re-cached |
| GitHub unreachable or rate-limited | The last cached list is used, or a bundled fallback list |

If the network is down entirely, selecting an explicit template will still fail with a
download error — the cached list only covers *which* templates exist.

## Programmatic use

The CLI is the main interface, but the pipeline is exported for reuse:

```js
import { detectTemplates, listTemplates, buildGitignore } from '@sayantand938/gigen';

const { templates, source } = await listTemplates({});
const selected = detectTemplates(templates, ['package.json'], 'linux');
```

## Development

```bash
npm install
npm test          # node:test suite, fully offline
npm start -- --list
```

The suite uses the built-in `node:test` runner and mocks all network access, so it runs
without a connection. `npm publish` runs it first via `prepublishOnly`.

### Project structure

```
bin/cli.js        Commander wiring: arguments, flags, exit codes
src/index.js      Programmatic API surface
src/config.js     URLs, cache settings, fallback list (data only)
src/detect.js     Project auto-detection rules and matcher
src/templates.js  Template discovery, downloading and caching
src/generator.js  Output assembly and safe file writing
src/ui.js         Spinners, status badges and all terminal output
test/             node:test suites for the modules above
```

## License

[MIT](LICENSE) © Sayantan Das
