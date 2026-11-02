/**
 * prbody types.
 *
 * prbody builds one pull request body for one PR. The caller
 * supplies the repo's PR template text (with {{...}}
 * placeholders), the PR's commits oldest first, and
 * optionally the PR title and the number of the issue the
 * PR closes. From that data alone, as pure local
 * computation, prbody reports:
 *
 *   - the filled body
 *   - the distinct names of template placeholders it did
 *     not know and therefore left in place, sorted ascending
 *   - the number of commits
 *   - whether the PR closes an issue
 *
 * The placeholder rules are pinned: {{title}}, {{summary}},
 * {{commits}}, and {{issue_link}} are replaced everywhere
 * they occur; any other {{...}} span is left untouched and
 * reported by its trimmed inner name; a "{{" with no later
 * "}}" is not a placeholder and is neither replaced nor
 * reported.
 */

/** One commit of the PR, as accepted after validation. */
export interface PrCommit {
  /** Commit hash; non-empty. Only its first 7 characters are rendered. */
  hash: string;
  /** Commit subject line; non-empty. */
  subject: string;
}

/** The arguments accepted by buildPrBody, after validation. */
export interface PrBodyInput {
  /** The repo's PR template text, with {{...}} placeholders; non-empty. */
  template: string;
  /** Commits of the PR, oldest first; non-empty. */
  commits: PrCommit[];
  /** Linked issue number; an integer of at least 1 when present. */
  issue_number?: number;
  /** Pull request title; non-empty when present. */
  title?: string;
}

/** The pull request body built from a template and its commits. */
export interface PrBodyResult {
  /** The template with every known placeholder filled in. */
  body: string;
  /** Distinct unknown placeholder names, sorted ascending. */
  unfilled_placeholders: string[];
  /** The number of commits the body was built from. */
  commit_count: number;
  /** True exactly when an issue number was supplied. */
  closes_issue: boolean;
}
