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
