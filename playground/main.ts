import { H3MCP } from "h3-mcp-tools";
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

serve(app);
