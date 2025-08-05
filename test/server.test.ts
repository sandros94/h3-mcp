import { describe, it, expect } from "vitest";
import * as v from "valibot";

import { H3MCP, defineMcpHandler } from "../src/index.ts";

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

  describe("Initialization", () => {
    it("should initialize with correct server info", async () => {
      const result = await app.request("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            clientInfo: { name: "Test Client", version: "1.0.0" },
          },
          id: 1,
        }),
      });

      const json = await result.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "Test MCP Server",
            version: "1.0.0",
            description: "A test server for H3 MCP tools",
          },
        },
        id: 1,
      });
    });
  });

  describe("Generic Methods", () => {
    it("should override GET", async () => {
      // Override the default SSE endpoint for testing
      app.get("/mcp", () => {
        return "My Custom fake SSE endpoint";
      });

      const result = await app.request("/mcp");
      const text = await result.text();
      expect(text).toEqual("My Custom fake SSE endpoint");
    });

    it("should create a custom mcp endpoint", async () => {
      app.all(
        "/custom",
        defineMcpHandler({
          serverInfo: {
            name: "Ciao MCP Server",
            version: "1.0.0",
            description: "A sample server for Ciao MCP",
          },
          serverCapabilities: {
            tools: { listChanged: true },
          },
          toolsCall: [
            {
              definition: {
                name: "ciao",
                description: "A tool that says Ciao",
                schema: v.object({
                  name: v.string(),
                }),
              },
              // @ts-ignore `tools` type is not able to infer the schema output
              handler: async ({ name }) => {
                return { output: `Ciao, ${name}!` };
              },
            },
          ],
        }),
      );

      const result = await app.request("/custom", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "ciao",
            arguments: { name: "Test Client" },
          },
          id: 1,
        }),
      });
      const json = await result.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        result: { output: "Ciao, Test Client!" },
        id: 1,
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw on non-allowed methods", async () => {
      const result = await app.request("/mcp", {
        method: "PUT",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            clientInfo: { name: "Test Client", version: "1.0.0" },
          },
          id: 1,
        }),
      });

      const json = await result.json();
      expect(json).toEqual({
        status: 405,
        message: "Method Not Allowed",
      });
    });
  });
});
