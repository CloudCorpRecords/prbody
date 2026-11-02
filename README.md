# prbody

Every repo has a PR template, and every PR author fills it
in differently — or pastes over it, or leaves the headings
empty. prbody takes the mechanical part out of the author's
hands: you hand it the template, the PR's commits, and the
issue it closes, and it hands back the body with the
template's placeholders filled in, the same way every time.

Four placeholders are pinned, spelled exactly like this:

- **`{{title}}`** — the PR title, or the empty string when
  no title is supplied.
- **`{{summary}}`** — one line per commit, in the order the
  commits were given: `- <subject>`.
- **`{{commits}}`** — one line per commit, in the same
  order, with the short hash appended:
  `- <subject> (<hash7>)`, where `<hash7>` is the first 7
  characters of the commit's hash (the whole hash when it is
  shorter than 7).
- **`{{issue_link}}`** — `Closes #<issue_number>` when an
  issue number is supplied, or the empty string when it is
  not.

Every occurrence of each known placeholder is replaced.
Any other `{{...}}` span — anything from `{{` to the next
`}}` — is left in the body exactly as written, and its
inner name, trimmed of surrounding whitespace, is reported
in `unfilled_placeholders` (distinct, sorted ascending), so
a template asking for something prbody does not know about
is visible instead of silently dropped. A `{{` with no
later `}}` is not a placeholder at all: it is left untouched
and unreported. Replacement text is never rescanned, so a
`{{...}}` sequence that arrives inside a title or a commit
subject stays literal.

The result also reports `commit_count` (the number of
commits) and `closes_issue` (true exactly when an issue
number was supplied). Malformed input — a missing, empty,
or non-string `template`; `commits` missing, not an array,
or empty; a commit entry that is not an object or whose
`hash` or `subject` is missing, empty, or non-string; an
`issue_number` that is not an integer of at least 1; or a
`title` that is empty or non-string when present — is a
validation error naming the offending path (for example
`commits[1].subject must be a non-empty string`), with no
partial result. Unknown extra fields are ignored, including
extra fields inside commit entries. The computation is
pure and local: no network, no configuration, and no
repository is read or touched — prbody only fills the
template it is given.

## CLI

```bash
npx @reneturcios/prbody build --input args.json
npx @reneturcios/prbody --version
```

`args.json` contains the full arguments object:

```json
{
  "template": "## {{title}}\n\n### Commits\n{{commits}}\n\n{{issue_link}}",
  "commits": [
    { "hash": "abc1234def5678", "subject": "Add login form" },
    { "hash": "9876fedcba4321", "subject": "Fix redirect loop" }
  ],
  "issue_number": 42,
  "title": "Login rework"
}
```

The result is printed as JSON:

```json
{
  "body": "## Login rework\n\n### Commits\n- Add login form (abc1234)\n- Fix redirect loop (9876fed)\n\nCloses #42",
  "unfilled_placeholders": [],
  "commit_count": 2,
  "closes_issue": true
}
```

Exit codes: `0` on success, `1` on a runtime error (including
an unreadable or invalid input file, or invalid input), `2`
on a usage error.

## MCP server

```bash
npx -y @reneturcios/prbody mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "prbody": {
      "command": "npx",
      "args": ["-y", "@reneturcios/prbody", "mcp"]
    }
  }
}
```

### Tools

- `build_pr_body` — Build a pull request body by filling
  the repo's PR template with the PR title, a summary of
  its commits, the full commit list, and the closing line
  for its linked issue.
  - `template` (string, required, non-empty) — the repo's
    PR template text, with `{{...}}` placeholders
  - `commits` (array, required, non-empty) — commits of
    the PR, oldest first; each entry is an object with
    `hash` (string, required, non-empty) and `subject`
    (string, required, non-empty)
  - `issue_number` (integer, optional, at least 1) — the
    linked issue number
  - `title` (string, optional, non-empty when present) —
    the pull request title

  Returns `{body, unfilled_placeholders, commit_count,
  closes_issue}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/prbody
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/prbody build --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
