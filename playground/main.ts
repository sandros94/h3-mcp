import { H3MCP, createMcpStream } from "h3-mcp-tools";
import { serve } from "h3";
import * as v from "valibot";

const app = new H3MCP({
  name: "My MCP Server",
  version: "1.0.0",
  description: "A sample MCP server using H3",
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

app.tool(
  {
    name: "add",
    description: "Adds two numbers together",
    schema: v.object({
      a: v.number(),
      b: v.number(),
    }),
  },
  async ({ a, b }) => {
    return { output: a + b };
  },
);

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
