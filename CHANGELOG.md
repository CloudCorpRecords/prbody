# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `build_pr_body` MCP tool and `build`
  CLI command building a pull request body by filling the
  repo's PR template from the PR's commits, its title, and
  its linked issue.
- Pinned placeholders, replaced at every occurrence:
  `{{title}}` (the title, or "" when absent), `{{summary}}`
  (one "- <subject>" line per commit), `{{commits}}` (one
  "- <subject> (<hash7>)" line per commit, hash7 being the
  first 7 characters of the hash or the whole hash when
  shorter), and `{{issue_link}}` ("Closes #<n>" when an
  issue number is present, else "").
- Unknown `{{...}}` spans are left untouched in the body
  and reported in `unfilled_placeholders` by their trimmed
  inner name, distinct and sorted ascending; an
  unterminated "{{" is left untouched and unreported.
- Path-naming validation errors for malformed input,
  including per-entry commit paths such as
  `commits[1].subject must be a non-empty string`.
