import type { H3Event } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { JsonRpcRequest } from "../utils/json-rpc.ts";

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

// MCP Specification for a single tool
export interface Tool<S extends StandardSchemaV1 = StandardSchemaV1> {
  /**
   * Unique identifier for the tool.
   */
  name: string;
  /**
   * Human-readable name of the tool.
   */
  title?: string;
  description?: string;
  schema?: S; // Standard Schema
  jsonSchema?: Record<string, unknown>; // raw JSON Schema
}

// Handler function for a tool
export type ToolHandler<S extends StandardSchemaV1> = (
  data: StandardSchemaV1.InferOutput<S>,
  event: H3Event,
  jsonrpc: Omit<JsonRpcRequest<StandardSchemaV1.InferInput<S>>, "id"> & {
    id: string | number | null;
  },
) => unknown | Promise<unknown>;

// MCP Specification for content blocks in responses
export interface ContentBlock {
  type: "text" | "image" | "audio" | "resource_link" | "resource";
  [key: string]: any;
}

// MCP Specification for the result of a tools/call
export interface ToolCallResult {
  content: ContentBlock[];
  isError?: boolean;
  structuredContent?: { [key: string]: any };
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
