import type { EventHandler } from "h3";
import { jsonRpcHandler } from "../json-rpc.ts";

import type { McpMethodMap } from "./tools.ts";

export * from "./tools.ts";

/**
 * Creates an H3 EventHandler for handling MCP protocol requests.
 * This handler uses the JSON-RPC protocol to manage tool interactions.
 *
 * @param methods A map of JSON-RPC method names to their handlers.
 * @returns An H3 EventHandler that implements the MCP protocol.
 */
export function mcpHandler<T = unknown, D = unknown>(
  methods: McpMethodMap<T, D>,
): EventHandler {
  return jsonRpcHandler(methods);
}
