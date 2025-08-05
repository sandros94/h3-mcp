import { type H3Config, H3 } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defineMcpHandler } from "./utils/mcp/index.ts";
import type {
  Resource,
  ResourceTemplate,
  ResourceHandler,
  McpResource,
  McpResourceTemplate,
} from "./utils/mcp/resources.ts";
import type { Tool, ToolHandler, McpTool } from "./utils/mcp/tools.ts";
import type { Implementation, ServerCapabilities } from "./types/index.ts";

export * from "./types/index.ts";
export * from "./utils/json-rpc.ts";
export * from "./utils/mcp/index.ts";

export class H3MCP extends H3 {
  private info: Implementation;
  private capabilities: ServerCapabilities;
  private toolsMap = new Map<string, McpTool>();
  private resourcesMap = new Map<string, McpResource>();
  private resourceTemplatesMap = new Map<string, McpResourceTemplate>();

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

  public resource(definition: Resource, handler?: ResourceHandler): this {
    if (this.resourcesMap.has(definition.uri)) {
      console.warn(
        `[h3-mcp] Warning: Resource "${definition.uri}" is being redefined.`,
      );
    }
    this.resourcesMap.set(definition.uri, {
      ...definition,
      handler,
    });
    return this;
  }
  public resources(data: Resource[], handler?: ResourceHandler): this {
    for (const resource of data) {
      this.resource(resource, handler);
    }
    return this;
  }

  public resourceTemplate(definition: ResourceTemplate): this {
    if (this.resourceTemplatesMap.has(definition.uriTemplate)) {
      console.warn(
        `[h3-mcp] Warning: Resource Template "${definition.uriTemplate}" is being redefined.`,
      );
    }
    this.resourceTemplatesMap.set(definition.uriTemplate, definition);
    return this;
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
      resources: this.resourcesMap,
      tools: this.toolsMap,
      serverCapabilities: this.capabilities,
      serverInfo: this.info,
    });

    this.all("/mcp", mcpHandler);
  }
}
