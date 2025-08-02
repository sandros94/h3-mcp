import { H3, type H3Config } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { McpTool, McpMethodMap } from "./utils/mcp/index.ts";
import { mcpTools, mcpHandler } from "./utils/mcp/index.ts";
import type {
  ServerInfo,
  Capabilities,
  ToolDefinition,
  ToolHandler,
} from "./types/index.ts";

export * from "./utils/json-rpc.ts";
export * from "./utils/mcp/index.ts";
export * from "./types/index.ts";

export class H3MCP extends H3 {
  private info: ServerInfo;
  private capabilities: Capabilities["capabilities"];
  private toolsMap = new Map<string, McpTool>();

  constructor(info: ServerInfo, options: Capabilities = {}, config?: H3Config) {
    super(config);

    this.info = info;
    this.capabilities = options.capabilities;

    // Define the core routes for the server
    this.setupRoutes();
  }

  public tool<S extends StandardSchemaV1>(
    definition: ToolDefinition<S>,
    handler: ToolHandler<S>,
  ): void {
    if (this.toolsMap.has(definition.name)) {
      console.warn(
        `[h3-mcp-tools] Warning: Tool "${definition.name}" is being redefined.`,
      );
    }
    this.toolsMap.set(definition.name, {
      definition,
      handler: handler as ToolHandler<StandardSchemaV1>,
    });
  }

  private setupRoutes() {
    // GET /mcp for server info (TODO: provide notifications via SSE)
    this.get("/mcp", () => ({
      ...this.info,
      capabilities: this.capabilities,
    }));

    // Generate tool-related RPC methods
    const toolMethods = mcpTools(this.toolsMap);

    // Combine with other methods
    const methods: McpMethodMap = {
      ...toolMethods,
      // TODO: add methods for prompts and resources
    };

    // Create the main JSON-RPC handler
    const rpcHandler = mcpHandler(methods);

    // Register the handler for all POST requests to /mcp.
    this.post("/mcp", rpcHandler);
  }
}
