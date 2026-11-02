/**
 * prbody core: build a pull request body from a template.
 *
 *   buildPrBody(args) -> { body, unfilled_placeholders,
 *                          commit_count, closes_issue }
 *
 * The template is filled by a single left-to-right scan.
 * The known placeholders (exact spellings) are:
 *
 *   {{title}}       the title value, or "" when absent
 *   {{summary}}     one line per commit, in input order:
 *                   "- <subject>"
 *   {{commits}}     one line per commit, in input order:
 *                   "- <subject> (<hash7>)", where <hash7>
 *                   is the first 7 characters of the hash
 *                   (the whole hash when shorter)
 *   {{issue_link}}  "Closes #<issue_number>" when an issue
 *                   number is present, else ""
 *
 * Every occurrence of each known placeholder is replaced.
 * Any other span from "{{" to the next "}}" is left
 * untouched in the body, and its inner name — trimmed of
 * surrounding whitespace — is collected into
 * unfilled_placeholders (distinct, sorted ascending). A
 * "{{" with no later "}}" is not a placeholder span: it is
 * left untouched and unreported. Replacement text is never
 * rescanned, so a "{{...}}" sequence arriving inside a
 * title or a commit subject stays literal and unreported.
 *
 * Validation is strict and path-naming: any malformed
 * input throws an Error naming the offending path (for
 * example "commits[1].subject must be a non-empty string")
 * and no partial result is produced. Unknown extra fields
 * are ignored, including extra fields inside commit
 * entries; a non-object top-level argument is treated
 * as {}.
 */
import type { PrBodyResult, PrCommit } from "./types.js";

export const VERSION = "0.1.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate the raw arguments object and return the
 * normalised input.
 */
function validateArgs(args: unknown): {
  template: string;
  commits: PrCommit[];
  issueNumber?: number;
  title?: string;
} {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.template === undefined) throw new Error("template is required");
  if (typeof raw.template !== "string" || raw.template.length === 0) {
    throw new Error("template must be a non-empty string");
  }

  if (raw.commits === undefined) throw new Error("commits is required");
  if (!Array.isArray(raw.commits)) {
    throw new Error("commits must be an array");
  }
  if (raw.commits.length === 0) {
    throw new Error("commits must be a non-empty array");
  }
  const commits: PrCommit[] = raw.commits.map((entry, i) => {
    if (!isRecord(entry)) {
      throw new Error(`commits[${i}] must be an object`);
    }
    if (typeof entry.hash !== "string" || entry.hash.length === 0) {
      throw new Error(`commits[${i}].hash must be a non-empty string`);
    }
    if (typeof entry.subject !== "string" || entry.subject.length === 0) {
      throw new Error(`commits[${i}].subject must be a non-empty string`);
    }
    return { hash: entry.hash, subject: entry.subject };
  });

  let issueNumber: number | undefined;
  if (raw.issue_number !== undefined) {
    if (
      typeof raw.issue_number !== "number" ||
      !Number.isInteger(raw.issue_number) ||
      raw.issue_number < 1
    ) {
      throw new Error("issue_number must be an integer >= 1");
    }
    issueNumber = raw.issue_number;
  }

  let title: string | undefined;
  if (raw.title !== undefined) {
    if (typeof raw.title !== "string" || raw.title.length === 0) {
      throw new Error("title must be a non-empty string");
    }
    title = raw.title;
  }

  return { template: raw.template, commits, issueNumber, title };
}

/** Build a pull request body by filling the repo's PR template. */
export function buildPrBody(args: unknown): PrBodyResult {
  const { template, commits, issueNumber, title } = validateArgs(args);

  const replacements: Record<string, string> = {
    "{{title}}": title ?? "",
    "{{summary}}": commits.map((c) => `- ${c.subject}`).join("\n"),
    "{{commits}}": commits
      .map((c) => `- ${c.subject} (${c.hash.slice(0, 7)})`)
      .join("\n"),
    "{{issue_link}}": issueNumber !== undefined ? `Closes #${issueNumber}` : "",
  };

  const unfilled = new Set<string>();
  let body = "";
  let cursor = 0;
  while (cursor < template.length) {
    const open = template.indexOf("{{", cursor);
    if (open === -1) {
      body += template.slice(cursor);
      break;
    }
    const close = template.indexOf("}}", open + 2);
    if (close === -1) {
      // Unterminated "{{": not a placeholder span; the rest
      // of the template is copied verbatim and unreported.
      body += template.slice(cursor);
      break;
    }
    body += template.slice(cursor, open);
    const span = template.slice(open, close + 2);
    if (Object.prototype.hasOwnProperty.call(replacements, span)) {
      body += replacements[span];
    } else {
      body += span;
      unfilled.add(template.slice(open + 2, close).trim());
    }
    cursor = close + 2;
  }

  return {
    body,
    unfilled_placeholders: [...unfilled].sort(),
    commit_count: commits.length,
    closes_issue: issueNumber !== undefined,
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
