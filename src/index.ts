import { type H3Config, H3 } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defineMcpHandler } from "./utils/mcp/index.ts";
import type {
  ResourceDef,
  Resource,
  ResourceList,
  ResourceHandler,
  ResourceTemplate,
  ResourceTemplateList,
  McpResource,
  McpResourceTemplate,
} from "./utils/mcp/resources.ts";
import type { ListingHandler, CallingHandler } from "./types/index.ts";
import type { Tool, ToolList, McpTool, ToolHandler } from "./utils/mcp/tools.ts";
import type { Implementation, ServerCapabilities } from "./types/index.ts";

export * from "./types/index.ts";
export * from "./utils/json-rpc.ts";
export * from "./utils/mcp/index.ts";

/**
 * A class that extends H3 to provide MCP (Model-Centric Protocol) functionalities.
 * It allows defining tools and resources that can be accessed via a JSON-RPC interface.
 */
export class H3MCP extends H3 {
  /**
   * Information about the server implementation.
   */
  private info: Implementation;
  /**
   * The capabilities of the server.
   */
  private capabilities: ServerCapabilities;
  /**
   * A map of registered tools.
   */
  private toolsMap = new Map<string, McpTool>();
  /**
   * A map of registered resources.
   */
  private resourcesMap = new Map<string, McpResource>();
  /**
   * A map of registered resource templates.
   */
  private resourceTemplatesMap = new Map<string, McpResourceTemplate>();
  /**
   * An optional handler for listing tools.
   */
  private toolsListHandler?: ListingHandler<
    { tools: Tool[] },
    ToolList
  >;
  /**
   * An optional handler for calling tools.
   */
  private toolsCallHandler?: CallingHandler<{
    name: string;
    arguments?: unknown;
  }>;
  /**
   * An optional handler for listing resources.
   */
  private resourcesListHandler?: ListingHandler<
    { resources: ResourceDef[] },
    ResourceList
  >;
  /**
   * An optional handler for reading resources.
   */
  private resourcesReadHandler?: CallingHandler<
    { uri: string },
    Resource | Resource[]
  >;
  /**
   * An optional handler for listing resource templates.
   */
  private resourcesTemplatesListHandler?: ListingHandler<
    { templates: ResourceTemplate[] },
    ResourceTemplateList
  >;

  /**
   * Creates an instance of H3MCP.
   * @param info Information about the server implementation.
   * @param capabilities The capabilities of the server.
   * @param config H3 configuration object.
   */
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

  /**
   * Registers a resource or a list of resources.
   * @param definition A single resource definition or an array of resource definitions.
   * @param handler An optional handler for the resource(s).
   * @returns The H3MCP instance for chaining.
   */
  public resource(definition: ResourceDef, handler?: ResourceHandler): this;
  /**
   * Registers a resource or a list of resources.
   * @param definition A single resource definition or an array of resource definitions.
   * @param handler An optional handler for the resource(s).
   * @returns The H3MCP instance for chaining.
   */
  public resource(definition: ResourceDef[], handler?: ResourceHandler): this;
  public resource(
    definition: ResourceDef | ResourceDef[],
    handler?: ResourceHandler,
  ): this {
    const def = Array.isArray(definition) ? definition : [definition];

    for (const d of def) {
      if (this.resourcesMap.has(d.uri)) {
        console.warn(
          `[h3-mcp] Warning: ResourceDef "${d.uri}" is being redefined.`,
        );
      }
      this.resourcesMap.set(d.uri, {
        ...d,
        handler,
      });
    }

    return this;
  }

  /**
   * Sets a custom handler for listing resources.
   * @param handler The handler function for listing resources.
   * @returns The H3MCP instance for chaining.
   */
  public resourcesList(
    handler: ListingHandler<{ resources: ResourceDef[] }, ResourceList>,
  ): this {
    this.resourcesListHandler = handler;
    return this;
  }

  /**
   * Sets a custom handler for reading resources.
   * @param handler The handler function for reading resources.
   * @returns The H3MCP instance for chaining.
   */
  public resourcesRead(
    handler: CallingHandler<{ uri: string }, Resource | Resource[]>,
  ): this {
    this.resourcesReadHandler = handler;
    return this;
  }

  /**
   * Registers a resource template or a list of resource templates.
   * @param definition A single resource template or an array of resource templates.
   * @returns The H3MCP instance for chaining.
   */
  public resourceTemplate(definition: ResourceTemplate): this;
  /**
   * Registers a resource template or a list of resource templates.
   * @param definition A single resource template or an array of resource templates.
   * @returns The H3MCP instance for chaining.
   */
  public resourceTemplate(definition: ResourceTemplate[]): this;
  public resourceTemplate(
    definition: ResourceTemplate | ResourceTemplate[],
  ): this {
    const templates = Array.isArray(definition) ? definition : [definition];
    for (const template of templates) {
      if (this.resourceTemplatesMap.has(template.uriTemplate)) {
        console.warn(
          `[h3-mcp] Warning: ResourceDef Template "${template.uriTemplate}" is being redefined.`,
        );
      }
      this.resourceTemplatesMap.set(template.uriTemplate, template);
    }
    return this;
  }

  /**
   * Sets a custom handler for listing resource templates.
   * @param handler The handler function for listing resource templates.
   * @returns The H3MCP instance for chaining.
   */
  public resourcesTemplatesList(
    handler: ListingHandler<
      { templates: ResourceTemplate[] },
      ResourceTemplateList
    >,
  ): this {
    this.resourcesTemplatesListHandler = handler;
    return this;
  }

  /**
   * Registers a tool.
   * @template S The schema type for the tool's input.
   * @param definition The tool definition.
   * @param handler The handler for the tool.
   * @returns The H3MCP instance for chaining.
   */
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

  /**
   * Sets a custom handler for listing tools.
   * @param handler The handler function for listing tools.
   * @returns The H3MCP instance for chaining.
   */
  public toolsList(
    handler: ListingHandler<{ tools: Tool[] }, ToolList>,
  ): this {
    this.toolsListHandler = handler;
    return this;
  }

  /**
   * Sets a custom handler for calling tools.
   * @param handler The handler function for calling tools.
   * @returns The H3MCP instance for chaining.
   */
  public toolsCall(
    handler: CallingHandler<{ name: string; arguments?: unknown }>,
  ): this {
    this.toolsCallHandler = handler;
    return this;
  }

  /**
   * Sets up the MCP routes.
   * @private
   */
  private setupRoutes() {
    this.all("/mcp", (event) => {
      return defineMcpHandler({
        serverInfo: this.info,
        serverCapabilities: this.capabilities,
        tools: this.toolsMap,
        resources: this.resourcesMap,
        resourcesTemplates: this.resourceTemplatesMap,
        toolsList: this.toolsListHandler,
        toolsCall: this.toolsCallHandler,
        resourcesList: this.resourcesListHandler,
        resourcesRead: this.resourcesReadHandler,
        resourcesTemplatesList: this.resourcesTemplatesListHandler,
      })(event);
    });
  }
}
