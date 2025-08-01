import {
  H3,
  HTTPError,
  type H3Config,
  type H3Event,
} from 'h3';
import type { StandardSchemaV1 } from '@standard-schema/spec';

import { jsonRpcHandler, type JsonRpcMethodMap } from './utils/json-rpc.ts';
import type { ServerInfo, Capabilities, ToolDefinition, ToolHandler } from './types/index.ts';

export class H3MCP extends H3 {
  private info: ServerInfo;
  private capabilities: Capabilities['capabilities'];
  private tools: Map<string, { definition: ToolDefinition<StandardSchemaV1>; handler: ToolHandler<StandardSchemaV1> }> = new Map();

  constructor(info: ServerInfo, options: Capabilities = {}, config?: H3Config) {
    super(config);

    this.info = info;
    this.capabilities = options.capabilities;

    // Define the core routes for the server
    this.setupRoutes();
  }

  public tool<S extends StandardSchemaV1>(definition: ToolDefinition<S>, handler: ToolHandler<S>): void {
    if (this.tools.has(definition.name)) {
      console.warn(`[h3-mcp] Warning: Tool "${definition.name}" is being redefined.`);
    }
    this.tools.set(definition.name, { definition, handler: handler as ToolHandler<StandardSchemaV1> });
  }

  private setupRoutes() {
    // GET /mcp for server info (TODO: provide notifications via SSE)
    this.get(
      '/mcp',
      () => ({
        ...this.info,
        capabilities: this.capabilities,
      }),
    );

    // Define the methods for the JSON-RPC handler.
    const methods: JsonRpcMethodMap = {
      'tools/list': () => this.listTools(),
      'tools/call': (params, event) => this.runTool(params, event),
      // TODO: add methods for prompts and resources
    };

    // Create the JSON-RPC handler with the defined methods.
    const rpcHandler = jsonRpcHandler(methods);

    // Register the handler for all POST requests to /mcp.
    this.post('/mcp', rpcHandler);
  }

  /**
   * Lists available tools. This method is now called by the RPC handler.
   */
  private listTools() {
    return [...this.tools.values()].map(({ definition }) => ({
      name: definition.name,
      description: definition.description,
      schema: definition.jsonSchema || {}, // TODO: add json schema parser for supported validation libraries
    }));
  }

  /**
   * Runs a specific tool. This method is now called by the RPC handler.
   */
  private async runTool(params: unknown, event: H3Event) {
    // Validate the parameters for running a tool
    if (typeof params !== 'object' || params === null || !('name' in params) || typeof params.name !== 'string') {
      // This error will be caught by jsonRpcHandler and formatted correctly.
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

    let parseResult: StandardSchemaV1.Result<unknown> | undefined = undefined;

    if (tool.definition.schema) {
      const mcpArguments = 'arguments' in params ? params.arguments : undefined;
  
      parseResult = await tool.definition.schema['~standard'].validate(mcpArguments);
      if (parseResult.issues) {
        throw new HTTPError({
          status: 400,
          message: `Invalid arguments for tool "${toolName}".`,
          data: parseResult.issues,
        });
      }
    }

    try {
      const result = await tool.handler(parseResult?.value, event);
      return result;
    } catch (error) {
      // Re-throw execution errors as HTTPErrors so the jsonRpcHandler can format them.
      throw new HTTPError({
        status: 500,
        message: `Error executing tool "${toolName}".`,
        data: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  }
}

export { jsonRpcHandler, type JsonRpcMethodMap };
