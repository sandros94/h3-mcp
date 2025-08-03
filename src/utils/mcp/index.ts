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
} from "../../types/index.ts";
import { mcpToolsMethods, type McpTool } from "./tools.ts";
import { defineJsonRpcHandler, type JsonRpcRequest } from "../json-rpc.ts";

import type { McpMethodMap } from "./tools.ts";

export * from "./tools.ts";

export interface DefineMcpHandlerOptions {
  tools: McpTool[] | Map<string, McpTool>;
  serverCapabilities: ServerCapabilities;
  serverInfo: Implementation;
  middleware?: Middleware[];
}

export function defineMcpHandler<
  RequestT extends EventHandlerRequest = EventHandlerRequest,
>(options: DefineMcpHandlerOptions): EventHandler<RequestT> {
  const { tools, serverCapabilities, serverInfo, middleware } = options;
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

    console.log(
      `[MCP Server] Initialized session ${sessionId} for client ${params.clientInfo.name} with version ${negotiatedVersion}`,
    );

    return {
      protocolVersion: negotiatedVersion,
      capabilities: serverCapabilities,
      serverInfo,
    };
  }

  const toolMethods = mcpToolsMethods(tools);

  const allMethods: McpMethodMap = {
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
    ...toolMethods,
    // TODO: Add methods for prompts and resources
  };

  return defineJsonRpcHandler(allMethods, middleware);
}
