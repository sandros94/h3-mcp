import { describe, it, expect } from "vitest";
import * as v from "valibot";

import { H3MCP } from "../src/index.ts";

describe("H3MCP", () => {
  const app = new H3MCP({
    name: "Test MCP Server",
    version: "1.0.0",
    description: "A test server for H3 MCP tools",
  });
  app.tool(
    {
      name: "echo",
      description: "Echoes back the input",
      schema: v.object({
        input: v.string(),
      }),
    },
    async ({ input }) => {
      return { output: `You said: ${input}` };
    },
  );
  app.toolsList(({ tools }) => {
    return {
      tools: [
        ...tools,
        {
          name: "testTool",
          description: "A test tool",
        },
      ],
    };
  });
  app.toolsCall(async (params) => {
    if (params.name === "customTool") {
      return {
        result: `Custom tool called with args: ${JSON.stringify(params.arguments)}`,
      };
    }
  });

  describe("Tools", () => {
    it("should list available tools", async () => {
      const result = await app.request("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          params: {},
          id: 1,
        }),
      });

      const json = await result.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: "echo",
              description: "Echoes back the input",
              inputSchema: {
                $schema: "http://json-schema.org/draft-07/schema#",
                type: "object",
                properties: {
                  input: { type: "string" },
                },
                required: ["input"],
              },
            },
            {
              name: "testTool",
              description: "A test tool",
            },
          ],
        },
        id: 1,
      });
    });

    it("should echo input", async () => {
      const result = await app.request("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "echo",
            arguments: { input: "Hello, World!" },
          },
          id: 1,
        }),
      });

      const json = await result.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        result: { output: "You said: Hello, World!" },
        id: 1,
      });
    });

    it("should call custom tool", async () => {
      const result = await app.request("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "customTool",
            arguments: { key: "value" },
          },
          id: 1,
        }),
      });

      const json = await result.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        result: { result: 'Custom tool called with args: {"key":"value"}' },
        id: 1,
      });
    });
  });
});
