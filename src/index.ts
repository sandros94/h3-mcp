import { type H3Config, H3 } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defineMcpHandler } from "./utils/mcp/index.ts";
import type { McpTool } from "./utils/mcp/tools.ts";
import type {
  Implementation,
  ServerCapabilities,
  Tool,
  ToolHandler,
} from "./types/index.ts";

export * from "./types/index.ts";
export * from "./utils/json-rpc.ts";
export * from "./utils/mcp/index.ts";

export class H3MCP extends H3 {
  private info: Implementation;
  private capabilities: ServerCapabilities;
  private toolsMap = new Map<string, McpTool>();

  constructor(
    info: Implementation,
    capabilities: ServerCapabilities = {},
    config?: H3Config,
  ) {
    super(config);

    this.info = info;
    this.capabilities = capabilities;

    // Define the core routes for the server
    this.setupRoutes();
  }

  public tool<S extends StandardSchemaV1>(
    definition: Tool<S>,
    handler: ToolHandler<S>,
  ): this {
    if (this.toolsMap.has(definition.name)) {
      console.warn(
        `[h3-mcp] Warning: Tool "${definition.name}" is being redefined.`,
      );
    }
    this.toolsMap.set(definition.name, {
      definition,
      handler: handler as ToolHandler<StandardSchemaV1>,
    });
    return this;
  }

  private setupRoutes() {
    const mcpHandler = defineMcpHandler({
      tools: this.toolsMap,
      serverCapabilities: this.capabilities,
      serverInfo: this.info,
    });

    this.all("/mcp", mcpHandler);
  }
}
