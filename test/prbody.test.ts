import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPrBody } from "../src/prbody.js";

/**
 * All tests are pure local computation over inline templates
 * and commit lists: no filesystem and no network. The four
 * pinned placeholders (including repeated occurrences), the
 * summary vs commits line formats, hash truncation at 7
 * characters (and shorter hashes kept whole), the issue
 * line present/absent, unknown-placeholder collection
 * (multiple, duplicates, whitespace inside braces,
 * unterminated "{{"), the empty unfilled list, and every
 * validation path including per-entry commits[i].hash /
 * commits[i].subject paths are each pinned.
 */

const COMMITS = [
  { hash: "abc1234def5678", subject: "Add login form" },
  { hash: "9876fedcba4321", subject: "Fix redirect loop" },
];

describe("buildPrBody — the pinned placeholders", () => {
  it("{{title}} is replaced with the title value", () => {
    const out = buildPrBody({
      template: "# {{title}}",
      commits: COMMITS,
      title: "Login rework",
    });
    assert.equal(out.body, "# Login rework");
  });

  it("{{title}} is replaced with the empty string when title is absent", () => {
    const out = buildPrBody({ template: "# {{title}}!", commits: COMMITS });
    assert.equal(out.body, "# !");
  });

  it("{{summary}} renders one '- <subject>' line per commit, in input order", () => {
    const out = buildPrBody({ template: "{{summary}}", commits: COMMITS });
    assert.equal(out.body, "- Add login form\n- Fix redirect loop");
  });

  it("{{commits}} renders one '- <subject> (<hash7>)' line per commit, in input order", () => {
    const out = buildPrBody({ template: "{{commits}}", commits: COMMITS });
    assert.equal(out.body, "- Add login form (abc1234)\n- Fix redirect loop (9876fed)");
  });

  it("summary lines carry no hash and commits lines carry no extra text", () => {
    const out = buildPrBody({
      template: "S:\n{{summary}}\nC:\n{{commits}}",
      commits: [{ hash: "0123456789", subject: "Only change" }],
    });
    assert.equal(out.body, "S:\n- Only change\nC:\n- Only change (0123456)");
  });

  it("a hash of exactly 7 characters is rendered whole", () => {
    const out = buildPrBody({
      template: "{{commits}}",
      commits: [{ hash: "abc1234", subject: "Seven" }],
    });
    assert.equal(out.body, "- Seven (abc1234)");
  });

  it("a hash shorter than 7 characters is rendered whole", () => {
    const out = buildPrBody({
      template: "{{commits}}",
      commits: [{ hash: "ab12", subject: "Short hash" }],
    });
    assert.equal(out.body, "- Short hash (ab12)");
  });

  it("a one-character hash is rendered whole", () => {
    const out = buildPrBody({
      template: "{{commits}}",
      commits: [{ hash: "f", subject: "Tiny" }],
    });
    assert.equal(out.body, "- Tiny (f)");
  });

  it("{{issue_link}} renders 'Closes #<n>' when issue_number is present", () => {
    const out = buildPrBody({
      template: "{{issue_link}}",
      commits: COMMITS,
      issue_number: 42,
    });
    assert.equal(out.body, "Closes #42");
    assert.equal(out.closes_issue, true);
  });

  it("{{issue_link}} is replaced with the empty string when issue_number is absent", () => {
    const out = buildPrBody({ template: "[{{issue_link}}]", commits: COMMITS });
    assert.equal(out.body, "[]");
    assert.equal(out.closes_issue, false);
  });

  it("every occurrence of each known placeholder is replaced", () => {
    const out = buildPrBody({
      template: "{{title}} / {{title}} / {{summary}} / {{summary}}",
      commits: [{ hash: "aaaaaaa1", subject: "One" }],
      title: "T",
    });
    assert.equal(out.body, "T / T / - One / - One");
    assert.deepEqual(out.unfilled_placeholders, []);
  });

  it("a full template fills end to end with the exact result object", () => {
    const out = buildPrBody({
      template:
        "## {{title}}\n\n### Summary\n{{summary}}\n\n### Commits\n{{commits}}\n\n{{issue_link}}",
      commits: COMMITS,
      issue_number: 7,
      title: "Login rework",
    });
    assert.deepEqual(out, {
      body: "## Login rework\n\n### Summary\n- Add login form\n- Fix redirect loop\n\n### Commits\n- Add login form (abc1234)\n- Fix redirect loop (9876fed)\n\nCloses #7",
      unfilled_placeholders: [],
      commit_count: 2,
      closes_issue: true,
    });
  });

  it("commit_count is the number of commits", () => {
    assert.equal(buildPrBody({ template: "x", commits: COMMITS }).commit_count, 2);
    assert.equal(
      buildPrBody({ template: "x", commits: [COMMITS[0]] }).commit_count,
      1,
    );
  });

  it("closes_issue is true exactly when issue_number is present", () => {
    assert.equal(
      buildPrBody({ template: "x", commits: COMMITS, issue_number: 1 }).closes_issue,
      true,
    );
    assert.equal(buildPrBody({ template: "x", commits: COMMITS }).closes_issue, false);
  });

  it("a template with no placeholders is returned verbatim", () => {
    const out = buildPrBody({ template: "plain body text", commits: COMMITS });
    assert.deepEqual(out, {
      body: "plain body text",
      unfilled_placeholders: [],
      commit_count: 2,
      closes_issue: false,
    });
  });

  it("replacement text is never rescanned for placeholders (pinned judgement call)", () => {
    const out = buildPrBody({
      template: "{{title}}",
      commits: [{ hash: "abc12345", subject: "Mention {{summary}} literally" }],
      title: "About {{unknown}} things",
    });
    assert.equal(out.body, "About {{unknown}} things");
    assert.deepEqual(out.unfilled_placeholders, []);
  });
});

describe("buildPrBody — unknown placeholders", () => {
  it("an unknown placeholder is left untouched and reported by name", () => {
    const out = buildPrBody({
      template: "Checklist: {{checklist}}",
      commits: COMMITS,
    });
    assert.equal(out.body, "Checklist: {{checklist}}");
    assert.deepEqual(out.unfilled_placeholders, ["checklist"]);
  });

  it("multiple unknown placeholders are collected distinct and sorted ascending", () => {
    const out = buildPrBody({
      template: "{{zebra}} {{apple}} {{mango}}",
      commits: COMMITS,
    });
    assert.equal(out.body, "{{zebra}} {{apple}} {{mango}}");
    assert.deepEqual(out.unfilled_placeholders, ["apple", "mango", "zebra"]);
  });

  it("a repeated unknown placeholder is reported once but left in place everywhere", () => {
    const out = buildPrBody({
      template: "{{todo}} and {{todo}} again",
      commits: COMMITS,
    });
    assert.equal(out.body, "{{todo}} and {{todo}} again");
    assert.deepEqual(out.unfilled_placeholders, ["todo"]);
  });

  it("whitespace inside the braces is trimmed from the reported name, span untouched", () => {
    const out = buildPrBody({
      template: "{{  reviewer  }}",
      commits: COMMITS,
    });
    assert.equal(out.body, "{{  reviewer  }}");
    assert.deepEqual(out.unfilled_placeholders, ["reviewer"]);
  });

  it("a known name with whitespace inside the braces is NOT the pinned placeholder (pinned judgement call)", () => {
    const out = buildPrBody({
      template: "{{ title }}",
      commits: COMMITS,
      title: "Login rework",
    });
    assert.equal(out.body, "{{ title }}");
    assert.deepEqual(out.unfilled_placeholders, ["title"]);
  });

  it("an empty span is reported under the empty name (pinned judgement call)", () => {
    const out = buildPrBody({ template: "a {{}} b", commits: COMMITS });
    assert.equal(out.body, "a {{}} b");
    assert.deepEqual(out.unfilled_placeholders, [""]);
  });

  it("known and unknown placeholders mix: known filled, unknown left and reported", () => {
    const out = buildPrBody({
      template: "{{title}} — {{owner}} — {{issue_link}}",
      commits: COMMITS,
      issue_number: 3,
      title: "Hi",
    });
    assert.equal(out.body, "Hi — {{owner}} — Closes #3");
    assert.deepEqual(out.unfilled_placeholders, ["owner"]);
  });

  it("an unterminated '{{' is left untouched and unreported", () => {
    const out = buildPrBody({
      template: "start {{title",
      commits: COMMITS,
      title: "Hi",
    });
    assert.equal(out.body, "start {{title");
    assert.deepEqual(out.unfilled_placeholders, []);
  });

  it("an unterminated '{{' after filled placeholders keeps the tail verbatim", () => {
    const out = buildPrBody({
      template: "{{summary}} tail {{oops",
      commits: [{ hash: "abc12345", subject: "One" }],
    });
    assert.equal(out.body, "- One tail {{oops");
    assert.deepEqual(out.unfilled_placeholders, []);
  });

  it("a span runs from '{{' to the NEXT '}}' (pinned judgement call)", () => {
    const out = buildPrBody({
      template: "{{ {{title}} }}",
      commits: COMMITS,
      title: "Hi",
    });
    // The first span is "{{ {{title}}" (inner " {{title"), unknown;
    // the trailing " }}" is plain text.
    assert.equal(out.body, "{{ {{title}} }}");
    assert.deepEqual(out.unfilled_placeholders, ["{{title"]);
  });

  it("the unfilled list is empty when every placeholder is known", () => {
    const out = buildPrBody({
      template: "{{title}}{{summary}}{{commits}}{{issue_link}}",
      commits: COMMITS,
    });
    assert.deepEqual(out.unfilled_placeholders, []);
  });
});

describe("buildPrBody — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => buildPrBody(args), { message });

  it("template missing is an error naming template", () => {
    throws({ commits: COMMITS }, "template is required");
    throws({}, "template is required");
  });

  it("a non-object top-level argument is treated as {} (pinned judgement call)", () => {
    throws(null, "template is required");
    throws([], "template is required");
    throws("text", "template is required");
    throws(42, "template is required");
  });

  it("template empty or non-string names template", () => {
    throws({ template: "", commits: COMMITS }, "template must be a non-empty string");
    throws({ template: 42, commits: COMMITS }, "template must be a non-empty string");
    throws({ template: null, commits: COMMITS }, "template must be a non-empty string");
    throws(
      { template: ["x"], commits: COMMITS },
      "template must be a non-empty string",
    );
  });

  it("commits missing is an error naming commits", () => {
    throws({ template: "x" }, "commits is required");
  });

  it("commits not an array names commits", () => {
    throws({ template: "x", commits: "nope" }, "commits must be an array");
    throws({ template: "x", commits: {} }, "commits must be an array");
    throws({ template: "x", commits: null }, "commits must be an array");
    throws({ template: "x", commits: 3 }, "commits must be an array");
  });

  it("commits empty names commits", () => {
    throws({ template: "x", commits: [] }, "commits must be a non-empty array");
  });

  it("a non-object commit entry names its index path", () => {
    throws(
      { template: "x", commits: ["nope"] },
      "commits[0] must be an object",
    );
    throws(
      { template: "x", commits: [COMMITS[0], null] },
      "commits[1] must be an object",
    );
    throws(
      { template: "x", commits: [COMMITS[0], ["hash", "subject"]] },
      "commits[1] must be an object",
    );
  });

  it("a commit entry with a missing, empty, or non-string hash names commits[i].hash", () => {
    throws(
      { template: "x", commits: [{ subject: "S" }] },
      "commits[0].hash must be a non-empty string",
    );
    throws(
      { template: "x", commits: [{ hash: "", subject: "S" }] },
      "commits[0].hash must be a non-empty string",
    );
    throws(
      { template: "x", commits: [{ hash: 123, subject: "S" }] },
      "commits[0].hash must be a non-empty string",
    );
    throws(
      { template: "x", commits: [COMMITS[0], { hash: null, subject: "S" }] },
      "commits[1].hash must be a non-empty string",
    );
  });

  it("a commit entry with a missing, empty, or non-string subject names commits[i].subject", () => {
    throws(
      { template: "x", commits: [{ hash: "abc1234" }] },
      "commits[0].subject must be a non-empty string",
    );
    throws(
      { template: "x", commits: [{ hash: "abc1234", subject: "" }] },
      "commits[0].subject must be a non-empty string",
    );
    throws(
      { template: "x", commits: [{ hash: "abc1234", subject: 9 }] },
      "commits[0].subject must be a non-empty string",
    );
    throws(
      { template: "x", commits: [COMMITS[0], COMMITS[1], { hash: "abc1234", subject: null }] },
      "commits[2].subject must be a non-empty string",
    );
  });

  it("issue_number present but not an integer >= 1 names issue_number", () => {
    for (const bad of [0, -2, 1.5, "12", true, null]) {
      throws(
        { template: "x", commits: COMMITS, issue_number: bad },
        "issue_number must be an integer >= 1",
      );
    }
  });

  it("issue_number of 1 is valid", () => {
    const out = buildPrBody({
      template: "{{issue_link}}",
      commits: COMMITS,
      issue_number: 1,
    });
    assert.equal(out.body, "Closes #1");
  });

  it("title present but empty or non-string names title", () => {
    throws(
      { template: "x", commits: COMMITS, title: "" },
      "title must be a non-empty string",
    );
    throws(
      { template: "x", commits: COMMITS, title: 42 },
      "title must be a non-empty string",
    );
    throws(
      { template: "x", commits: COMMITS, title: null },
      "title must be a non-empty string",
    );
  });

  it("unknown extra fields are ignored, including inside commit entries (pinned judgement call)", () => {
    const out = buildPrBody({
      template: "{{commits}}",
      commits: [{ hash: "abc12345", subject: "One", author: "rene", extra: [1] }],
      labels: ["bug"],
    });
    assert.equal(out.body, "- One (abc1234)");
    assert.equal(out.commit_count, 1);
  });

  it("no partial result is produced on invalid input", () => {
    assert.throws(() =>
      buildPrBody({ template: "{{title}}", commits: COMMITS, title: "" }),
    );
    assert.throws(() =>
      buildPrBody({ template: "{{title}}", commits: [{ hash: "abc1234" }] }),
    );
  });
});
