import type { H3Event } from "h3";
import type { MaybePromise } from "./utils.ts";
import type { JsonRpcRequest } from "../utils/json-rpc.ts";

export type * from "../utils/mcp/resources.ts";
export type * from "../utils/mcp/tools.ts";

/**
 * MCP JSON-RPC request.
 * @template I The type of the request parameters.
 */
export type McpRpcRequest<I = unknown> = Omit<JsonRpcRequest<I>, "id"> & {
  id: string | number | null;
};

/**
 * MCP Specification for client/server information.
 */
export interface Implementation {
  /**
   * The name of the server.
   */
  name: string;
  /**
   * The version of the server.
   */
  version: string;
  /**
   * The title of the server.
   */
  title?: string;
  /**
   * A description of the server.
   */
  description?: string;
}

/**
 * MCP Specification for server capabilities.
 */
export interface ServerCapabilities {
  /**
   * Capabilities related to tools.
   */
  tools?: { listChanged?: boolean };
  /**
   * Capabilities related to prompts.
   */
  prompts?: { listChanged?: boolean };
  /**
   * Capabilities related to resources.
   */
  resources?: { listChanged?: boolean; subscribe?: boolean };
}

/**
 * MCP Specification for client capabilities.
 */
export interface ClientCapabilities {
  /**
   * Capabilities related to tools.
   */
  tools?: {};
}

/**
 * MCP Specification for the initialize method request parameters.
 */
export interface InitializeRequestParams {
  /**
   * The protocol version.
   */
  protocolVersion: string;
  /**
   * The client's capabilities.
   */
  capabilities: ClientCapabilities;
  /**
   * Information about the client.
   */
  clientInfo: Implementation;
}

/**
 * MCP Specification for the initialize method response.
 */
export interface InitializeResponse {
  /**
   * The protocol version.
   */
  protocolVersion: string;
  /**
   * The server's capabilities.
   */
  capabilities: ServerCapabilities;
  /**
   * Information about the server.
   */
  serverInfo: Implementation;
}

/**
 * Handler function for calling a method.
 * @template I The type of the input data.
 * @template O The type of the output data.
 * @param data The input data.
 * @param event The H3 event.
 * @param jsonrpc The JSON-RPC request object.
 * @returns A promise that resolves to the output data, a readable stream, or void.
 */
export type CallingHandler<I extends object, O = unknown> = (
  data: I & Record<string, unknown>,
  event: H3Event,
  jsonrpc: McpRpcRequest,
) => MaybePromise<O | ReadableStream | void>;

/**
 * Handler function for listing items.
 * @template I The type of the input data.
 * @template O The type of the output data.
 * @param data The input data, including a cursor for pagination.
 * @param event The H3 event.
 * @param jsonrpc The JSON-RPC request object.
 * @returns A promise that resolves to the output data, a readable stream, or void.
 */
export type ListingHandler<I extends object, O extends object = {}> = (
  data: I & {
    cursor: string | undefined;
  },
  event: H3Event,
  jsonrpc: McpRpcRequest,
) => MaybePromise<
  | Partial<O & { nextCursor?: string | undefined } & Record<string, unknown>>
  | void
>;
