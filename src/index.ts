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
  private toolsListHandler?: ListingHandler<
    { tools: Tool[] },
    { tools: Tool[] }
  >;
  private toolsCallHandler?: CallingHandler<{
    name: string;
    arguments?: unknown;
  }>;
  private resourcesListHandler?: ListingHandler<
    { resources: ResourceDef[] },
    ResourceList
  >;
  private resourcesReadHandler?: CallingHandler<
    { uri: string },
    Resource | Resource[]
  >;
  private resourcesTemplatesListHandler?: ListingHandler<
    { templates: ResourceTemplate[] },
    ResourceTemplateList
  >;

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

  public resource(definition: ResourceDef, handler?: ResourceHandler): this;
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

  public resourcesList(
    handler: ListingHandler<{ resources: ResourceDef[] }, ResourceList>,
  ): this {
    this.resourcesListHandler = handler;
    return this;
  }

  public resourcesRead(
    handler: CallingHandler<{ uri: string }, Resource | Resource[]>,
  ): this {
    this.resourcesReadHandler = handler;
    return this;
  }

  public resourceTemplate(definition: ResourceTemplate): this;
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

  public resourcesTemplatesList(
    handler: ListingHandler<
      { templates: ResourceTemplate[] },
      ResourceTemplateList
    >,
  ): this {
    this.resourcesTemplatesListHandler = handler;
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

  public toolsList(
    handler: ListingHandler<{ tools: Tool[] }, { tools: Tool[] }>,
  ): this {
    this.toolsListHandler = handler;
    return this;
  }

  public toolsCall(
    handler: CallingHandler<{ name: string; arguments?: unknown }>,
  ): this {
    this.toolsCallHandler = handler;
    return this;
  }

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
