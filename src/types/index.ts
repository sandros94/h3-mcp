import type { H3Event } from "h3";
import type { MaybePromise } from "./utils.ts";
import type { JsonRpcRequest } from "../utils/json-rpc.ts";

export type * from "../utils/mcp/resources.ts";
export type * from "../utils/mcp/tools.ts";

// MCP Specification for client/server information
export interface Implementation {
  name: string;
  version: string;
  title?: string;
  description?: string;
}

// MCP Specification for server capabilities
export interface ServerCapabilities {
  tools?: { listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  resources?: { listChanged?: boolean; subscribe?: boolean };
}

// MCP Specification for client capabilities
export interface ClientCapabilities {
  tools?: {};
}

// MCP Specification for the initialize method
export interface InitializeRequestParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: Implementation;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
}

// Handler function for listing
export type ListingHandler<I extends object, O extends object = {}> = (
  data: I & {
    cursor: string | undefined;
  },
  event: H3Event,
  jsonrpc: Omit<JsonRpcRequest, "id"> & {
    id: string | number | null;
  },
) => MaybePromise<
  | Partial<O & { nextCursor?: string | undefined } & Record<string, unknown>>
  | ReadableStream
  | void
>;
