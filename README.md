# h3-mcp

<!-- automd:badges bundlephobia style="flat" color="FFDC3B" -->

[![npm version](https://img.shields.io/npm/v/h3-mcp?color=FFDC3B)](https://npmjs.com/package/h3-mcp)
[![npm downloads](https://img.shields.io/npm/dm/h3-mcp?color=FFDC3B)](https://npm.chart.dev/h3-mcp)
[![bundle size](https://img.shields.io/bundlephobia/minzip/h3-mcp?color=FFDC3B)](https://bundlephobia.com/package/h3-mcp)

<!-- /automd -->

Minimal MCP server built with H3 v2 (beta) as a dedicated app or subapp.

## Features

- Built with H3 v2 (beta) for high performance and runtime agnosticity (in can be mounted as a [nested-app](https://h3.dev/guide/basics/nested-apps)).
- It is based on the JSON-RPC protocol to accept commands and return results.
- Built-in validation for tool calls, with JSON Schema for supported validation libraries.
- Simple Tool registration and invocation, allowing you to define tools with input validation.
- Tool listing method to retrieve all registered tools.

> [!WARNING]  
> Project currently under heavy development. The main scope of this project is to provide a simple MCP server with minimal dependencies, alogside showcasing H3 v2 (beta). If you are looking for more capabilities out of the box I suggest you to look for the official [MCP TS SDK](https://github.com/modelcontextprotocol/typescript-sdk) or the great [TMCP](https://github.com/paoloricciuti/tmcp). Or, at least, once once you consider this project more mature.

### TODO

- [ ] Support for static resources definition
- [ ] Support for prompt templates definition
- [ ] Main `GET` endpoint, for:
  - [ ] server capabilities
  - [ ] notifications

## Usage

Install the package:

```sh
# ✨ Auto-detect (supports npm, yarn, pnpm, deno and bun)
npx nypm install h3-mcp
```

Minimal example:

```js
import { H3MCP } from "h3-mcp"; // or from CDN via "https://esm.sh/h3-mcp"
import { serve } from "h3";
import * as v from "valibot";

const app = new H3MCP({
  name: "My MCP Server",
  version: "1.0.0",
  description: "A sample Model-as-a-Service server using H3 MCP",
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

#### JSON Schema

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

Published under the [MIT](https://github.com/sandros94/h3-mcp/blob/main/LICENSE) license.
Made by [community](https://github.com/sandros94/h3-mcp/graphs/contributors) 💛
<br><br>
<a href="https://github.com/sandros94/h3-mcp/graphs/contributors">
<img src="https://contrib.rocks/image?repo=sandros94/h3-mcp" />
</a>

<!-- /automd -->

<!-- automd:with-automd -->

---

_🤖 auto updated with [automd](https://automd.unjs.io)_

<!-- /automd -->
