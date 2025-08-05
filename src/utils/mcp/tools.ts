import { type H3Event, HTTPError } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { toJsonSchema } from "@standard-community/standard-json";
import type { MaybePromise } from "../../types/utils.ts";
import type { ListingHandler, CallingHandler } from "../../types/index.ts";
import type { JsonRpcMethodMap, JsonRpcRequest } from "../json-rpc.ts";

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
) => MaybePromise<unknown>;

/**
 * Tool definition and its corresponding handler.
 */
export interface McpTool<S extends StandardSchemaV1 = StandardSchemaV1> {
  definition: Tool<S>;
  handler: ToolHandler<S>;
}

/**
 * A Map of JSON-RPC methods for MCP tools, resources, and prompts.
 */
export type McpToolMethodMap = JsonRpcMethodMap;

/**
 * Creates a set of JSON-RPC methods for handling MCP tool interactions.
 * This includes listing available tools and calling a specific tool.
 *
 * @param tools A Map of tool definitions and their handlers.
 * @returns A JsonRpcMethodMap to be used with `jsonRpcHandler`.
 */

export function mcpToolsMethods(methods: {
  tools: Map<string, McpTool>;
  toolsList?: ListingHandler<{ tools: Tool[] }, { tools: Tool[] }>;
  toolsCall?: CallingHandler<{ name: string; arguments?: unknown }>;
}): McpToolMethodMap {
  /**
   * RPC method: 'tools/list'
   * Lists available tools and their schemas, optionally using a custom handler.
   */
  async function toolsList(data: JsonRpcRequest, event: H3Event) {
    const toolDefs = await Promise.all(
      [...methods.tools.values()].map(async ({ definition }) => ({
        name: definition.name,
        description: definition.description,
        inputSchema:
          definition.jsonSchema ||
          (definition.schema
            ? await toJsonSchema(definition.schema).catch(() => {
                console.warn(
                  `[h3-mcp-tools] Warning: Failed to convert schema for tool "${definition.name}".`,
                );
                return undefined;
              })
            : undefined),
      })),
    );

    if (methods.toolsList) {
      // Provide a cursor if present, else default
      let cursor: string | undefined = undefined;
      if (
        data.params &&
        typeof data.params === "object" &&
        "cursor" in data.params &&
        typeof data.params.cursor === "string"
      ) {
        cursor = data.params.cursor;
      }
      return methods.toolsList({ cursor, tools: toolDefs }, event, {
        ...data,
        id: data.id ?? null,
      });
    }

    return {
      tools: toolDefs,
    };
  }

  /**
   * RPC method: 'tools/call'
   * Runs a specific tool with the given arguments.
   */
  async function toolsCall(request: JsonRpcRequest, event: H3Event) {
    const {
      params,
      jsonrpc,
      method,
      id = null,
    } = request as JsonRpcRequest<{ name: string; arguments?: unknown }>;
    // Validate the parameters for running a tool
    if (
      typeof params !== "object" ||
      params === null ||
      !("name" in params) ||
      typeof params.name !== "string"
    ) {
      throw new HTTPError({
        status: 400,
        message:
          'Invalid parameters for "tools/call". It must be an object with a "name" property.',
      });
    }

    const toolName = params.name;
    const tool = methods.tools.get(toolName);

    if (!tool) {
      if (methods.toolsCall) {
        const exec = await methods.toolsCall(params, event, {
          jsonrpc,
          id,
          method,
        });

        if (exec && id !== null) {
          return exec;
        }
      }
      throw new HTTPError({
        status: 404,
        message: `Tool "${toolName}" not found.`,
      });
    }

    let parseResult: StandardSchemaV1.Result<unknown> | undefined = undefined;

    if (tool.definition.schema) {
      const mcpArguments = "arguments" in params ? params.arguments : undefined;

      parseResult =
        await tool.definition.schema["~standard"].validate(mcpArguments);
      if (parseResult.issues) {
        throw new HTTPError({
          status: 400,
          message: `Invalid arguments for tool "${toolName}".`,
          data: parseResult.issues,
        });
      }
    }

    try {
      const result = await tool.handler(parseResult?.value, event, {
        jsonrpc,
        id,
        method,
        params,
      });
      return result;
    } catch (error) {
      // Re-throw execution errors as HTTPErrors so the jsonRpcHandler can catch them.
      throw new HTTPError({
        status: 500,
        message: `Error executing tool "${toolName}".`,
        data:
          error instanceof Error ? error.message : "An unknown error occurred.",
      });
    }
  }

  return {
    "tools/list": toolsList,
    "tools/call": toolsCall,
  };
}
