import type { H3Event } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";

// Server Information
export interface ServerInfo {
  name: string;
  version: string;
  description: string;
}

// Capabilities
export interface Capabilities {
  capabilities?: {
    tools?: { listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    resources?: { listChanged?: boolean };
  };
}

// Tool Definition
export interface ToolDefinition<S extends StandardSchemaV1> {
  name: string;
  description: string;
  schema?: S;
  jsonSchema?: Record<string, unknown>; // Manual JSON Schema representation
}

// Tool Handler
export type ToolHandler<S extends StandardSchemaV1> = (
  data: StandardSchemaV1.InferOutput<S>,
  event: H3Event,
) => unknown | Promise<unknown>;
