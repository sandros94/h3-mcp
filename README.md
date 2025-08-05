# h3-mcp-tools

<!-- automd:badges bundlephobia style="flat" color="FFDC3B" -->

[![npm version](https://img.shields.io/npm/v/h3-mcp-tools?color=FFDC3B)](https://npmjs.com/package/h3-mcp-tools)
[![npm downloads](https://img.shields.io/npm/dm/h3-mcp-tools?color=FFDC3B)](https://npm.chart.dev/h3-mcp-tools)
[![bundle size](https://img.shields.io/bundlephobia/minzip/h3-mcp-tools?color=FFDC3B)](https://bundlephobia.com/package/h3-mcp-tools)

<!-- /automd -->

Minimal MCP server built with H3 v2 (beta) as a dedicated app or subapp.

## Features

- Built with [H3 v2 (beta)](https://h3.dev) for high performance and runtime agnosticity (it can be mounted as a [nested-app](https://h3.dev/guide/basics/nested-apps)).
- It is based on the JSON-RPC protocol to accept commands and return results.
- **Tools**:
  - Simple Tool registration and invocation with built-in input validation via [Standard-Schema](https://github.com/standard-schema/standard-schema).
  - Automatic JSON Schema generation for supported validation libraries.
  - Tool listing method to retrieve all statically registered tools.
  - Custom handlers for listing and calling dynamic tools.
- **Resources**:
  - Support for static resources definition (including batch definition).
  - Support for resource templates.
  - Custom handlers for listing and reading dynamic resources (like fetched from a remote storage).
- **Streaming**:
  - Streaming responses via `ReadableStream` with a simple utility function.

> [!WARNING]  
> Project currently under heavy development. The main scope of this project is to provide a simple MCP server with minimal dependencies, alongside showcasing H3 v2 (beta). If you are looking for more capabilities out of the box I suggest you to look for the official [MCP TS SDK](https://github.com/modelcontextprotocol/typescript-sdk) or the great [TMCP](https://github.com/paoloricciuti/tmcp).

### TODO

- [ ] Support for prompt templates definition
- [ ] Completion API for resources
- [ ] Built-in Streamable HTTP notifications hooks

## Usage

Install the package:

```sh
# ✨ Auto-detect (supports npm, yarn, pnpm, deno and bun)
npx nypm install h3-mcp-tools
```

### `H3MCP` App

The easiest way to get started is to use the `H3MCP` class, which extends H3.

```ts
import { H3MCP } from "h3-mcp-tools"; // or from CDN via "https://esm.sh/h3-mcp-tools"
import { serve } from "h3";
import * as v from "valibot";

const app = new H3MCP({
  name: "My MCP Server",
  version: "1.0.0",
  description: "A sample MCP server built with H3",
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

serve(app);
```

### Tools

You can define tools using the `tool` method on the `H3MCP` instance.

#### Requesting a Tool Call

Do a `POST` request to the `/mcp` endpoint with the following body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": {
      "input": "hello from h3"
    }
  }
}
```

You should receive a response like this:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "output": "You said: hello from h3"
  }
}
```

#### Requesting Tool Listing

To list all registered tools, you can make a `POST` request to the `/mcp` endpoint with the following body:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

You should receive a response like this:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "echo",
        "description": "Echoes back the input",
        "inputSchema": {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {
            "input": { "type": "string" }
          },
          "required": ["input"]
        }
      }
    ]
  }
}
```

### JSON Schema

Only validation libraries supported by [`@standard-community/standard-json`](https://github.com/standard-community/standard-json) are automatically evaluated at runtime. For Valibot and Zod users you should also install the related json schema package (`@valibot/to-json-schema`, `zod-to-json-schema`).

If your validation library is supported by the [`@standard-schema/spec`](https://github.com/standard-schema/standard-schema) but not from the `@standard-community/standard-json`, you can still use it by providing the `jsonSchema` option in the tool definition, like this:

```ts
app.tool(
  {
    name: "test",
    description: "An example tool that echoes back the input",
    jsonSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        input: { type: "string" },
      },
      required: ["input"],
    },
  },
  async ({ input }) => {
    return { output: `You said: ${input}` };
  },
);
```

### Streaming Responses

While standard SSE (Server-Sent Events) are deprecated in the MCP specification, you can still implement streaming responses using `ReadableStream`. To make things simpler, you can use the `createMcpStream` utility function provided by this package.

You can create a streamable response like this:

```ts
import { H3MCP, createMcpStream } from "h3-mcp-tools";
import { serve } from "h3";
import * as v from "valibot";

const app = new H3MCP({
  name: "My streamable MCP Server",
  version: "1.0.0",
  description: "A sample MCP server built with H3",
});

app.tool(
  {
    name: "stream",
    description: "Streams the current time every second",
    schema: v.optional(
      v.object({
        maxSeconds: v.optional(v.number()),
      }),
    ),
  },
  ({ maxSeconds } = {}, event, { id }) => {
    let count = 0;
    const max = maxSeconds ?? 10;

    const stream = createMcpStream(event, {
      async start(controller) {
        for (let i = 0; i < max; i++) {
          if (count < max) {
            controller.enqueue(
              new TextEncoder().encode(`Time: ${new Date().toISOString()}\n`),
            );
            count++;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      },
      finalResponse: {
        jsonrpc: "2.0",
        id,
        result: { message: "Stream completed" },
      },
    });

    event.res.headers.set("Content-Type", "text/event-stream");

    return stream;
  },
);

serve(app);
```

If you include `finalResponse` in the `createMcpStream` options, it will be sent at the end of the stream, allowing you to send a complete JSON-RPC response with the `jsonrpc`, `id`, and `result` fields and the stream will be closed automatically.

### Resources

You can define static resources using the `resource` method, which accepts a `Resource` object. You can also define dynamic resources with custom handlers.

```ts
import { H3MCP } from "h3-mcp-tools";
import { serve } from "h3";

const app = new H3MCP({
  description: "A sample MCP server built with H3",
});

app.resource(
  {
    uri: "hello/world",
    name: "Welcome Resource",
    title: "A simple resource that returns a greeting",
    description: "Returns a greeting message",
    mimeType: "test/plain",
  },
  async ({ uri }) => {
    // uri = "hello/world"
    return { text: `Hello, ${uri}!` };
  },
);

serve(app);
```

#### Batch Resource Definition

You can also define multiple resources at once using the `resource` method, which accepts an array of `Resource` objects and an optional handler, which will be shared among all resources:

```ts
const remotelyFetchedResources = [
  {
    uri: "foo",
    name: "Foo Resource",
    text: "This is a Foo resource",
  },
  {
    uri: "bar",
    name: "Bar Resource",
    text: "This is a Bar resource",
  },
];

app.resource(remotelyFetchedResources, ({ uri }) => {
  return { text: `This is a ${uri} resource` };
});
```

### Custom Handlers

You can override the default behavior for listing and calling tools, or listing and reading resources, by providing your own handlers. This becomes useful when you want to dynamically manage tools or resources to other sources, like a database or a remote API.

```ts
// Override tools/list
app.toolsList(({ tools }) => {
  return {
    tools: [
      ...tools, // Include statically defined tools
      {
        name: "custom-listed-tool",
        description: "A tool added via a custom handler",
      },
    ],
  };
});

// Override tools/call for non-statically defined tools
app.toolsCall(async (params) => {
  if (params.name === "custom-handled-tool") {
    return { result: "Handled by custom toolsCall" };
  }
  // Fallback to default behavior by returning nothing (undefined)
});
```

### Standalone Handler

For more advanced use cases, you can use `defineMcpHandler` to create a standalone handler that can be used as a sub-app.

```ts
import { defineMcpHandler } from "h3-mcp-tools";
import { serve, H3 } from "h3";
import * as v from "valibot";

const mcpHandler = defineMcpHandler({
  serverInfo: {
    name: "My MCP Server",
    version: "1.0.0",
  },
  tools: [
    {
      definition: {
        name: "echo",
        description: "Echoes back the input",
        schema: v.object({
          input: v.string(),
        }),
      },
      handler: async ({ input }) => {
        return { output: `You said: ${input}` };
      },
    },
  ],
});

const app = new H3().all("/mcp", mcpHandler);

serve(app);
```

## Notes

- SSE have been marked as deprecated since MCP spec "2025-03-26", instead you should use `ReadableStream` for streaming responses with `Content-Type: text/event-stream` header. Please also note that you should send a full JSON-RPC response at the end of the stream, with the `jsonrpc`, `id` and `result` fields.

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

</details>

## Credits

Inspired by:

- the official [ModelContextProtocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Paolo Ricciuti's work on [tmcp](https://github.com/paoloricciuti/tmcp)

## License

<!-- automd:contributors license=MIT -->

Published under the [MIT](https://github.com/sandros94/h3-mcp-tools/blob/main/LICENSE) license.
Made by [community](https://github.com/sandros94/h3-mcp-tools/graphs/contributors) 💛
<br><br>
<a href="https://github.com/sandros94/h3-mcp-tools/graphs/contributors">
<img src="https://contrib.rocks/image?repo=sandros94/h3-mcp-tools" />
</a>

<!-- /automd -->

<!-- automd:with-automd -->

---

_🤖 auto updated with [automd](https://automd.unjs.io)_

<!-- /automd -->
