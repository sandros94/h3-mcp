import { describe, it, expect } from "vitest";

import { H3MCP } from "../src/index.ts";

describe("H3MCP", async () => {
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

  const remotelyFetchedResources = [
    {
      uri: "Foo",
      name: "Foo Resource",
      title: "A resource that returns Foo",
      description: "Returns a Foo message",
      mimeType: "test/plain",
      text: "This is a Foo resource",
    },
    {
      uri: "Bar",
      name: "Bar Resource",
      title: "A resource that returns Bar",
      description: "Returns a Bar message",
      mimeType: "test/plain",
      text: "This is a Bar resource",
    },
    {
      uri: "baz",
      name: "Baz Resource",
      title: "A resource that returns a base64 Baz",
      description: "Returns a Baz message in base64",
      mimeType: "application/octet-stream",
      blob: Buffer.from(
        await new Blob(["This is a Baz resource"], {
          type: "application/octet-stream",
        }).arrayBuffer(),
      ).toString("base64"),
    },
  ];
  app.resources(remotelyFetchedResources);

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
            {
              uri: "Foo",
              name: "Foo Resource",
              title: "A resource that returns Foo",
              description: "Returns a Foo message",
              mimeType: "test/plain",
            },
            {
              uri: "Bar",
              name: "Bar Resource",
              title: "A resource that returns Bar",
              description: "Returns a Bar message",
              mimeType: "test/plain",
            },
            {
              uri: "baz",
              name: "Baz Resource",
              title: "A resource that returns a base64 Baz",
              description: "Returns a Baz message in base64",
              mimeType: "application/octet-stream",
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

    it("should return a blob resource by URI", async () => {
      const result = await app.request("/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "resources/read",
          params: {
            uri: "baz",
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
              uri: "baz",
              name: "Baz Resource",
              title: "A resource that returns a base64 Baz",
              description: "Returns a Baz message in base64",
              mimeType: "application/octet-stream",
              blob: "VGhpcyBpcyBhIEJheiByZXNvdXJjZQ==",
            },
          ],
        },
        id: 1,
      });
    });
  });
});
