# h3-mcp-tools

<!-- automd:badges bundlephobia style="flat" color="FFDC3B" -->

[![npm version](https://img.shields.io/npm/v/h3-mcp-tools?color=FFDC3B)](https://npmjs.com/package/h3-mcp-tools)
[![npm downloads](https://img.shields.io/npm/dm/h3-mcp-tools?color=FFDC3B)](https://npm.chart.dev/h3-mcp-tools)
[![bundle size](https://img.shields.io/bundlephobia/minzip/h3-mcp-tools?color=FFDC3B)](https://bundlephobia.com/package/h3-mcp-tools)

<!-- /automd -->

Minimal MCP server built with H3 v2 (beta) as a dedicated app or subapp.

## Features

- Built with H3 v2 (beta) for high performance and runtime agnosticity (in can be mounted as a [nested-app](https://h3.dev/guide/basics/nested-apps)).
- It is based on the JSON-RPC protocol to accept commands and return results.
- Tools
  - Built-in validation, generating JSON Schema automatically with supported validation libraries.
  - Simple Tool registration and invocation, allowing you to define tools with input validation.
  - Tool listing method to retrieve all registered tools.
- Resources
  - Support for static resources definition, allowing you to serve them statically. (batch definition via dedicated method)
  - Support for dynamic resources, allowing you to define custom handlers for specific URIs.
  - Support for resource templates, allowing you to define dynamic URIs. (Completion API is still under development)

> [!WARNING]  
> Project currently under heavy development. The main scope of this project is to provide a simple MCP server with minimal dependencies, alogside showcasing H3 v2 (beta). If you are looking for more capabilities out of the box I suggest you to look for the official [MCP TS SDK](https://github.com/modelcontextprotocol/typescript-sdk) or the great [TMCP](https://github.com/paoloricciuti/tmcp). Or, at least, once once you consider this project more mature.

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

Minimal example:

```js
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
    name: "test",
    description: "An example tool that echoes back the input",
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

### Requesting a Tool call

Do a `POST` request to `/mcp` endpoint with the following body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "test",
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

### Requesting Tool listing

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
  "result": [
    {
      "name": "test",
      "description": "An example tool that echoes back the input",
      "schema": {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "input": {
            "type": "string"
          }
        },
        "required": ["input"]
      }
    }
  ]
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
    schema: v.object({
      input: v.string(),
    }),
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
    return { text: "Hello, world!" };
  },
);

serve(app);
```

#### Batch Resource Definition

You can also define multiple resources at once using the `resources` method, which accepts an array of `Resource` objects:

```ts
const remotelyFetchedResources = [
  {
    uri: "foo",  // URI must be defined and unique
    name: "Foo Resource",
    title: "A resource that returns Foo",
    description: "Returns a Foo message",
    mimeType: "test/plain",
    text: "This is a Foo resource",
  },
  {
    uri: "bar",  // URI must be defined and unique
    name: "Bar Resource",
    title: "A resource that returns Bar",
    description: "Returns a Bar message",
    mimeType: "test/plain",
    text: "This is a Bar resource",
  },
  {
    uri: "baz",  // URI must be defined and unique
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
