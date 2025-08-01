import { serve } from 'h3'
import { H3MCP } from 'h3-mcp'
import * as v from 'valibot'

const app = new H3MCP({
  name: 'My MCP Server',
  version: '1.0.0',
  description: 'A sample Model-as-a-Service server using H3 MCP',
})

app.tool({
  name: 'exampleTool',
  description: 'An example tool that echoes back the input',
  schema: v.object({
    input: v.string(),
  }),
}, async ({ input }) => {
  return { output: `You said: ${input}` }
})

serve(app)
