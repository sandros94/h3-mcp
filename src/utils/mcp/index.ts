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
  InitializeResult,
  ListingHandler,
} from "../../types/index.ts";
import { defineJsonRpcHandler, type JsonRpcRequest } from "../json-rpc.ts";

import type {
  McpResource,
  McpResourceTemplate,
  McpResourceMethodMap,
  Resource,
} from "./resources.ts";
import { mcpResourcesMethods } from "./resources.ts";
import type { McpTool, McpToolMethodMap, Tool } from "./tools.ts";
import { mcpToolsMethods } from "./tools.ts";

export * from "./stream.ts";
export * from "./tools.ts";

export interface DefineMcpHandlerOptions {
  serverInfo: Implementation;
  serverCapabilities: ServerCapabilities;
  middleware?: Middleware[];
  toolsCall?: McpTool[] | Map<string, McpTool>;
  toolsList?: ListingHandler<{ tools: Tool[] }, { tools: Tool[] }>;
  resourcesRead?: McpResource[] | Map<string, McpResource>;
  resourcesList?: ListingHandler<
    { resources: Resource[] },
    { resources: Resource[] }
  >;
  resourcesTemplatesList?:
    | McpResourceTemplate[]
    | Map<string, McpResourceTemplate>;
}

export function defineMcpHandler<
  RequestT extends EventHandlerRequest = EventHandlerRequest,
>(options: DefineMcpHandlerOptions): EventHandler<RequestT> {
  const {
    serverInfo,
    serverCapabilities,
    middleware,
    toolsList,
    resourcesList,
  } = options;

  // --- START: Maps ---
  const toolsCall =
    !options.toolsCall || options.toolsCall instanceof Map
      ? (options.toolsCall ?? new Map())
      : new Map(options.toolsCall.map((t) => [t.definition.name, t]));

  const resourcesRead =
    !options.resourcesRead || options.resourcesRead instanceof Map
      ? (options.resourcesRead ?? new Map())
      : new Map(options.resourcesRead.map((r) => [r.uri, r]));

  const resourcesTemplatesList =
    !options.resourcesTemplatesList ||
    options.resourcesTemplatesList instanceof Map
      ? (options.resourcesTemplatesList ?? new Map())
      : new Map(options.resourcesTemplatesList.map((t) => [t.name, t]));
  // --- END: Maps ---

  (middleware || []).push((event) => {
    if (!isMethod(event, ["POST", "GET", "DELETE"])) {
      throw new HTTPError({
        status: 405,
        message: "Method Not Allowed",
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
        message: "Method Not Allowed",
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
  ): InitializeResult {
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
        ...serverCapabilities,
        tools: toolsCall.size > 0 ? {} : undefined,
        resources: resourcesRead.size > 0 ? {} : undefined,
      },
    };
  }

  const resourceMethods = mcpResourcesMethods({
    resourcesRead,
    resourcesList,
    resourcesTemplatesList,
  });
  const toolMethods = mcpToolsMethods({ toolsCall, toolsList });

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
