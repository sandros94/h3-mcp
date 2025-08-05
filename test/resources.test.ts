import { describe, it, expect } from "vitest";

import { H3MCP } from "../src/index.ts";

describe("H3MCP", () => {
  const app = new H3MCP({
    name: "Test MCP Server",
    version: "1.0.0",
    description: "A test server for H3 MCP tools",
  });
  app.resource(
    {
      uri: "World",
      name: "Hello Resource",
      title: "A simple resource that returns a greeting",
      description: "Returns a greeting message",
      mimeType: "application/json",
    },
    async ({ uri }) => {
      return { text: `Hello, ${uri}!` };
    },
  );

  describe("Resources", () => {
    it("should list available resources", async () => {
      const result = await app.request("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "resources/list",
          params: {},
          id: 1,
        }),
      });

      const json = await result.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        result: {
          resources: [
            {
              uri: "World",
              name: "Hello Resource",
              title: "A simple resource that returns a greeting",
              description: "Returns a greeting message",
              mimeType: "application/json",
            },
          ],
        },
        id: 1,
      });
    });

    it("should return resource by URI", async () => {
      const result = await app.request("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "resources/read",
          params: {
            uri: "World",
          },
          id: 1,
        }),
      });

      const json = await result.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        result: {
          contents: [
            {
              uri: "World",
              name: "Hello Resource",
              title: "A simple resource that returns a greeting",
              description: "Returns a greeting message",
              mimeType: "application/json",
              text: "Hello, World!",
            },
          ],
        },
        id: 1,
      });
    });
  });
});
