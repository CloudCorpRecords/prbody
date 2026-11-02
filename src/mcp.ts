/**
 * prbody MCP server. Tools: build_pr_body.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no upstream API, no
 * authentication, no configuration, and no repository is
 * touched — the tool only fills a template.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { buildPrBody, formatPayload, VERSION } from "./prbody.js";

const TOOLS = [
  {
    name: "build_pr_body",
    description:
      "Build a pull request body by filling the repo's PR template with the PR title, a summary of its commits, the full commit list, and the closing line for its linked issue.",
    inputSchema: {
      type: "object" as const,
      properties: {
        template: {
          type: "string",
          description: "The repo's PR template text, with {{...}} placeholders",
        },
        commits: {
          type: "array",
          description: "Commits of the PR, oldest first: {hash, subject}",
          items: {
            type: "object",
            properties: {
              hash: {
                type: "string",
                description: "Commit hash",
              },
              subject: {
                type: "string",
                description: "Commit subject line",
              },
            },
            required: ["hash", "subject"],
          },
        },
        issue_number: {
          type: "integer",
          description: "Linked issue number (optional)",
        },
        title: {
          type: "string",
          description: "Pull request title (optional)",
        },
      },
      required: ["template", "commits"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "prbody", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "build_pr_body") {
      out = buildPrBody(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
