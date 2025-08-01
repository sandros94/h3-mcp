import {
  H3,
  HTTPError,
  readBody,
  type H3Config,
} from 'h3';
import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { ServerInfo, Capabilities, ToolDefinition, ToolHandler } from './types/index.ts';

export class H3MCP extends H3 {
  private info: ServerInfo
  private capabilities: Capabilities['capabilities']
  private tools: Map<string, { definition: ToolDefinition<StandardSchemaV1>; handler: ToolHandler<StandardSchemaV1> }> = new Map()

  constructor(info: ServerInfo, options: Capabilities = {}, config?: H3Config) {
    super(config)

    this.info = info
    this.capabilities = options.capabilities

    // Define the core routes for the server
    this.setupRoutes()
  }

  /**
   * Defines a new tool and its handler.
   * @param definition The tool definition, including name, description, and Zod schema.
   * @param handler The function to execute when the tool is called.
   */
  public tool<S extends StandardSchemaV1>(definition: ToolDefinition<S>, handler: ToolHandler<S>): void {
    if (this.tools.has(definition.name)) {
      console.warn(`[h3-mcp] Warning: Tool "${definition.name}" is being redefined.`)
    }
    this.tools.set(definition.name, { definition, handler: handler as ToolHandler<StandardSchemaV1> })
  }

  private setupRoutes() {
    // Root endpoint providing server information (TODO: provide SSE support)
    this.get(
      '/mcp',
      () => ({
        ...this.info,
        capabilities: this.capabilities,
      }),
    )

    // Endpoint to list all available tools
    this.get(
      '/tools',
      () => {
        return [...this.tools.values()].map(({ definition }) => ({
          name: definition.name,
          description: definition.description,
          // For now, we are not generating JSON schema.
          schema: {},
        }))
      },
    )

    this.post(
      '/tools/:name/run',
      async (event) => {
        const toolName = event.context.params?.name
        if (!toolName) {
          throw new HTTPError({
            status: 400,
            message: 'Tool name is required.',
          })
        }

        const tool = this.tools.get(toolName)
        if (!tool) {
          throw new HTTPError({
            status: 404,
            message: `Tool "${toolName}" not found.`,
          })
        }

        const body = await readBody(event)
        const parseResult = await tool.definition.schema['~standard'].validate(body)

        if (parseResult.issues) {
          throw new HTTPError({
            status: 400,
            message: `Invalid input for tool "${toolName}".`,
            data: parseResult.issues,
          })
        }

        try {
          const result = await tool.handler(parseResult.value, event)
          return result
        } catch (error) {
          throw new HTTPError({
            status: 500,
            message: `Error executing tool "${toolName}".`,
            data: error instanceof Error ? error.message : 'An unknown error occurred.',
          })
        }
      },
    );
  }
}
