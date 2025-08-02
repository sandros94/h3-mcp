import { H3MCP, mcpHandler, mcpTools } from "h3-mcp-tools";
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

app.post(
  "/ciao",
  mcpHandler(
    mcpTools([
      {
        definition: {
          name: "test",
          description: "An example tool that echoes back the input",
          schema: v.object({
            input: v.string(),
          }),
        },
        handler: async ({ input }) => {
          return { output: `You said: ${input}` };
        },
      },
    ]),
  ),
);

serve(app);
