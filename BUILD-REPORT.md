# prbody — Build Report

MCP Rebuild 1000, Batch 17. Original program build from the
packages-100 plan (cluster A #7), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch17/prbody.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `prbody`, npm `@reneturcios/prbody`,
MCP name `io.github.CloudCorpRecords/prbody`, version
`0.1.0`, bin `prbody` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Build a PR body
  from its commits, the linked issue, and the repo's PR
  template." — 79 chars, verified by count; npm entry
  carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/prbody:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/prbody"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`build --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/prbody.ts` (core,
  `VERSION = "0.1.0"`, exporting `buildPrBody` and
  `formatPayload`)
- `test/prbody.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/prbody`,
  smoke-test server-name assertion `prbody`)

Plus the parity fixture at
`harness/fixtures/prbody-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster A #7.

## Tools implemented (1)

- `build_pr_body` — arguments: `template` (string, required,
  non-empty), `commits` (array, required, non-empty; each
  entry an object with `hash` and `subject`, both string,
  required, non-empty — the nested item schema is expressed
  in the literal exactly as the spec describes),
  `issue_number` (integer, optional, >= 1), and `title`
  (string, optional, non-empty when present).

  Placeholder filling is pinned and done by a single
  left-to-right scan of the template. The known placeholders
  (exact spellings) are replaced at every occurrence:
  `{{title}}` → the title value, or "" when absent;
  `{{summary}}` → one "- <subject>" line per commit in input
  order; `{{commits}}` → one "- <subject> (<hash7>)" line
  per commit in input order, where <hash7> is the first 7
  characters of the hash (the whole hash when shorter);
  `{{issue_link}}` → "Closes #<issue_number>" when an issue
  number is present, else "". Any other span from "{{" to
  the next "}}" is left untouched in the body, and its inner
  name — trimmed of surrounding whitespace — is collected
  into `unfilled_placeholders` (distinct, sorted ascending).
  A "{{" with no later "}}" is not a placeholder span: left
  untouched and unreported. Returns `{body,
  unfilled_placeholders, commit_count, closes_issue}`:
  `commit_count` is the number of commits and
  `closes_issue` is true exactly when `issue_number` is
  present.

  The fixture literal
  (`harness/fixtures/prbody-tools-original.json`) and the
  `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties` — confirmed by the parity
  run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object (`{template, commits, issue_number?,
  title?}`).
- The scan appends replacement text directly and continues
  scanning the template after the replaced span, so a
  "{{...}}" sequence arriving inside a title or a commit
  subject is never rescanned: it stays literal in the body
  and is not reported as unfilled (pinned by a dedicated
  test).
- Validation is path-naming and total: a missing, empty,
  or non-string `template`; `commits` missing, not an
  array, or empty; a non-object commit entry or an entry
  with a missing, empty, or non-string `hash` or `subject`
  (e.g. "commits[1].subject must be a non-empty string");
  an `issue_number` present but not an integer >= 1; or a
  `title` present but empty or non-string throws an Error
  naming the offending path and produces no partial result
  (MCP: `isError`; CLI: exit 1).

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **41 tests,
  41 pass, 0 fail** — every pinned placeholder (title
  present/absent, summary vs commits line formats,
  repeated occurrences of each placeholder, a full template
  filled end to end with the exact result object); hash
  rendering (exactly 7 characters kept whole, longer hashes
  cut to 7, hashes shorter than 7 — including a
  one-character hash — kept whole); the issue line present
  ("Closes #42") and absent (empty string), `commit_count`,
  and `closes_issue` true exactly when an issue number is
  present; unknown placeholders (single, multiple sorted
  ascending, duplicates reported once but left in place
  everywhere, whitespace inside braces trimmed from the
  reported name, a whitespace-padded known name reported as
  unknown, an empty span reported under the empty name,
  known/unknown mixing, unterminated "{{" left untouched
  and unreported both alone and after filled placeholders,
  a span running to the NEXT "}}", and the empty unfilled
  list); replacement text never rescanned; and every
  validation path (missing/empty/non-string `template`,
  non-object top-level treated as {}, `commits` missing /
  non-array / empty, non-object entries at their index
  paths, missing/empty/non-string `hash` and `subject` at
  `commits[0]` / `commits[1]` / `commits[2]` paths,
  `issue_number` 0 / negative / fractional / string /
  boolean / null plus 1 valid, `title` empty / non-string /
  null, unknown extra fields ignored including inside
  commit entries, and no partial result on invalid input).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `build` with no `--input` exits 2;
  `build --input <missing file>` exits 1 naming the file;
  `build --input <valid file>` exits 0 and prints
  `{"body": "## Login rework\n\n- Add login form (abc1234)\n\nCloses #42", "unfilled_placeholders": [], "commit_count": 1, "closes_issue": true}`
  for the hand-checked input
  `{"template": "## {{title}}\n\n{{commits}}\n\n{{issue_link}}", "commits": [{"hash": "abc1234def5678", "subject": "Add login form"}], "issue_number": 42, "title": "Login rework"}`;
  `build --input <invalid file>` (commit entry missing its
  subject) exits 1 with `commits[0].subject must be a
  non-empty string`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/prbody-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/prbody`, **128 package entries**.
Resolved versions match the sibling reference tree
(`@modelcontextprotocol/sdk` 1.32.2, `zod` 3.25.76,
`tsx` 4.23.15, `typescript` 5.9.3, `@types/node`
20.19.43, `qs` 6.17.0). The subsequent offline
`npm install --ignore-scripts --offline`, build, tests,
and parity all ran against this lockfile's tree.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated
  test): (1) a known placeholder name written with
  whitespace inside the braces (e.g. `{{ title }}`) is
  NOT the pinned placeholder — the exact spellings are
  pinned — so the span is left untouched and reported
  under its trimmed name ("title"); (2) an empty span
  `{{}}` is an unknown placeholder reported under the
  empty name ""; (3) a placeholder span runs from "{{"
  to the NEXT "}}" (no nesting), so in `{{ {{title}} }}`
  the first span's inner name is "{{title"; (4)
  replacement text is never rescanned, so "{{...}}"
  sequences inside a title or a commit subject stay
  literal and unreported; (5) unknown extra fields are
  ignored rather than rejected, including extra fields
  inside commit entries (the spec states this one
  outright); (6) a non-object top-level arguments value
  is treated as an empty object, so it fails as
  `template is required` (also stated by the spec);
  (7) error-message wording follows the fleet's
  path-naming pattern (e.g. `commits must be a non-empty
  array`, `commits[0] must be an object`). No other spec
  ambiguity was found in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
