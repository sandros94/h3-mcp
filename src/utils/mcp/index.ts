import type {
  H3Event,
  EventHandler,
  Middleware,
  EventHandlerRequest,
} from "h3";
import { HTTPError, isMethod } from "h3";
import type {
  Implementation,
  ServerCapabilities,
  InitializeRequestParams,
  InitializeResponse,
  ListingHandler,
  CallingHandler,
} from "../../types/index.ts";
import { defineJsonRpcHandler, type JsonRpcRequest } from "../json-rpc.ts";

import type {
  McpResource,
  McpResourceTemplate,
  McpResourceMethodMap,
  ResourceDef,
  Resource,
  ResourceList,
  ResourceTemplate,
  ResourceTemplateList,
} from "./resources.ts";
import { mcpResourcesMethods } from "./resources.ts";
import type { Tool, ToolList, McpTool, McpToolMethodMap } from "./tools.ts";
import { mcpToolsMethods } from "./tools.ts";

export * from "./stream.ts";
export * from "./tools.ts";

/**
 * Options for defining an MCP handler.
 */
export interface DefineMcpHandlerOptions {
  /**
   * Information about the server implementation.
   */
  serverInfo: Implementation;
  /**
   * The capabilities of the server.
   */
  serverCapabilities: ServerCapabilities;
  /**
   * An array of middleware to apply to the handler.
   */
  middleware?: Middleware[];
  /**
   * A map or array of tools to be available.
   */
  tools?: McpTool[] | Map<string, McpTool>;
  /**
   * A map or array of resources to be available.
   */
  resources?: McpResource[] | Map<string, McpResource>;
  /**
   * A map or array of resource templates to be available.
   */
  resourcesTemplates?: McpResourceTemplate[] | Map<string, McpResourceTemplate>;
  /**
   * An optional handler for listing tools.
   */
  toolsList?: ListingHandler<{ tools: Tool[] }, ToolList>;
  /**
   * An optional handler for calling tools.
   */
  toolsCall?: CallingHandler<{ name: string; arguments?: unknown }>;
  /**
   * An optional handler for listing resources.
   */
  resourcesList?: ListingHandler<{ resources: ResourceDef[] }, ResourceList>;
  /**
   * An optional handler for reading resources.
   */
  resourcesRead?: CallingHandler<{ uri: string }, Resource | Resource[]>;
  /**
   * An optional handler for listing resource templates.
   */
  resourcesTemplatesList?: ListingHandler<
    { templates: ResourceTemplate[] },
    ResourceTemplateList
  >;
}

/**
 * Defines an MCP handler for H3.
 * @param options The options for the MCP handler.
 * @returns An H3 event handler.
 */
export function defineMcpHandler<
  RequestT extends EventHandlerRequest = EventHandlerRequest,
>(options: DefineMcpHandlerOptions): EventHandler<RequestT> {
  const {
    serverInfo,
    serverCapabilities,
    middleware,
    toolsList,
    toolsCall,
    resourcesList,
    resourcesRead,
    resourcesTemplatesList,
  } = options;

  // --- START: Maps ---
  const tools =
    !options.tools || options.tools instanceof Map
      ? (options.tools ?? new Map())
      : new Map(options.tools.map((t) => [t.definition.name, t]));

  const resources =
    !options.resources || options.resources instanceof Map
      ? (options.resources ?? new Map())
      : new Map(options.resources.map((r) => [r.uri, r]));

  const resourcesTemplates =
    !options.resourcesTemplates || options.resourcesTemplates instanceof Map
      ? (options.resourcesTemplates ?? new Map())
      : new Map(options.resourcesTemplates.map((t) => [t.name, t]));
  // --- END: Maps ---

  (middleware || []).push((event) => {
    if (!isMethod(event, ["POST", "GET", "DELETE"])) {
      throw new HTTPError({
        status: 405,
        message: "[mcp] Method Not Allowed.",
      });
    }

    if (event.req.method === "DELETE") {
      // TODO: Storage hook

      event.req.headers.delete("Mcp-Session-Id");
      event.res.status = 202;
      return "";
    }

    if (event.req.method === "GET") {
      // TODO: implement SSE

      throw new HTTPError({
        status: 405,
        message:
          "[mcp] Method Not Allowed. Currently `GET` (SSE) is not automatically supported.",
      });
    }
  });

  /**
   * RPC Method: 'initialize'
   * Handles the MCP handshake.
   */
  function initialize(
    data: JsonRpcRequest<InitializeRequestParams>,
    event: H3Event,
  ): InitializeResponse {
    const { params } = data;
    if (!params || !params.protocolVersion || !params.clientInfo) {
      throw new HTTPError({
        status: 400,
        message:
          "Invalid request parameters. 'protocolVersion' and 'clientInfo' are required.",
      });
    }

    // 1. Version Negotiation
    const clientVersion = params.protocolVersion;
    const supportedVersions = ["2025-06-18", "2025-03-26"];
    const negotiatedVersion = supportedVersions.includes(clientVersion)
      ? clientVersion
      : "2025-06-18";

    // 2. Session Management
    const sessionId = crypto.randomUUID();
    // TODO: Storage hook

    // Set session ID in response header
    event.res.headers.set("Mcp-Session-Id", sessionId);

    console.info(
      `[MCP Server] Initialized session ${sessionId} for client ${params.clientInfo.name} with version ${negotiatedVersion}`,
    );

    return {
      serverInfo,
      protocolVersion: negotiatedVersion,
      capabilities: {
        tools: tools.size > 0 ? {} : undefined,
        resources: resources.size > 0 ? {} : undefined,
        ...serverCapabilities,
      },
    };
  }

  const resourceMethods = mcpResourcesMethods({
    resources,
    resourcesTemplates,
    resourcesList,
    resourcesRead,
    resourcesTemplatesList,
  });
  const toolMethods = mcpToolsMethods({ tools, toolsList, toolsCall });

  const allMethods: McpToolMethodMap | McpResourceMethodMap = {
    // @ts-ignore `initialize` is a special method, not part of the tools
    initialize,
    "notifications/initialized": (data, event) => {
      if ((data.id !== undefined && data.id !== null) || data.params) {
        throw new HTTPError({
          status: 400,
          message:
            "The 'notifications/initialized' method does not accept parameters.",
        });
      }

      // const sessionId = event.res.headers.get('Mcp-Session-Id');
      // TODO: Storage hook

      event.res.status = 202; // Accepted
      return "";
    },
    ...resourceMethods,
    ...toolMethods,
    // TODO: Add methods for prompts
  };

  return defineJsonRpcHandler(allMethods, middleware);
}
