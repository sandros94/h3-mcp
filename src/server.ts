import {
  H3,
  HTTPError,
  readBody,
  type H3Config,
  type H3Event,
} from 'h3';
import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { ServerInfo, Capabilities, ToolDefinition, ToolHandler } from './types/index.ts';

// Define the structure for an RPC call
interface RpcCall {
  method: string;
  params?: unknown;
}

// Type guard to check if the body is a valid RpcCall
function isRpcCall(body: unknown): body is RpcCall {
  return typeof body === 'object' && body !== null && 'method' in body && typeof (body as RpcCall).method === 'string';
}

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

  public tool<S extends StandardSchemaV1>(definition: ToolDefinition<S>, handler: ToolHandler<S>): void {
    if (this.tools.has(definition.name)) {
      console.warn(`[h3-mcp] Warning: Tool "${definition.name}" is being redefined.`)
    }
    this.tools.set(definition.name, { definition, handler: handler as ToolHandler<StandardSchemaV1> })
  }

  private setupRoutes() {
    // GET /mcp for server info (TODO: provide notifications via  SSE)
    this.get(
      '/mcp',
      () => ({
        ...this.info,
        capabilities: this.capabilities,
      }),
    )

    // POST /mcp for all RPC calls (tools, prompts, resources)
    this.post(
      '/mcp',
      async (event) => {
        const body = await readBody(event);

        if (!isRpcCall(body)) {
          throw new HTTPError({
            status: 400,
            message: 'Invalid RPC call. Body must be an object with a "method" property.',
          });
        }

        const { method, params } = body;

        // Dispatch based on the method
        switch (method) {
          case 'tools.list': {
            return this.listTools();
          }
          case 'tools.run': {
            return this.runTool(params, event);
          }
          // TODO: add methods for prompts and resources
          default: {
            throw new HTTPError({
              status: 404,
              message: `Method "${method}" not found.`,
            });
          }
        }
      },
    );
  }

  /**
   * Lists available tools.
   */
  private listTools() {
    return [...this.tools.values()].map(({ definition }) => ({
      name: definition.name,
      description: definition.description,
      schema: definition.jsonSchema || {}, // TODO: add json schema perser for supported validation libraries
    }));
  }

  /**
   * Runs a specific tool.
   */
  private async runTool(params: unknown, event: H3Event) {
    // Validate the parameters for running a tool
    if (typeof params !== 'object' || params === null || !('name' in params) || typeof params.name !== 'string') {
      throw new HTTPError({
        status: 400,
        message: 'Invalid parameters for "tools.run". It must be an object with a "name" property.',
      });
    }

    const toolName = params.name;
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new HTTPError({
        status: 404,
        message: `Tool "${toolName}" not found.`,
      });
    }
    
    const input = 'input' in params ? params.input : undefined;

    const parseResult = await tool.definition.schema['~standard'].validate(input);
    if (parseResult.issues) {
      throw new HTTPError({
        status: 400,
        message: `Invalid input for tool "${toolName}".`,
        data: parseResult.issues,
      });
    }

    try {
      const result = await tool.handler(parseResult.value, event);
      return result;
    } catch (error) {
      throw new HTTPError({
        status: 500,
        message: `Error executing tool "${toolName}".`,
        data: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  }
}
