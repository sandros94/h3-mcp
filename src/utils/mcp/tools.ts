import { type H3Event, HTTPError } from "h3";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { toJsonSchema } from "@standard-community/standard-json";
import type { ToolDefinition, ToolHandler } from "../../types/index.ts";
import { type JsonRpcMethodMap } from "../json-rpc.ts";

/**
 * A Map containing tool definitions and their corresponding handlers.
 */
export interface McpTool<S extends StandardSchemaV1 = StandardSchemaV1> {
  definition: ToolDefinition<S>;
  handler: ToolHandler<S>;
}

/**
 * A Map of JSON-RPC methods for MCP tools, resources, and prompts.
 */
export type McpMethodMap<T = unknown, D = unknown> = JsonRpcMethodMap<T, D>;

/**
 * Creates a set of JSON-RPC methods for handling MCP tool interactions.
 * This includes listing available tools and calling a specific tool.
 *
 * @param tools A Map of tool definitions and their handlers.
 * @returns A JsonRpcMethodMap to be used with `jsonRpcHandler`.
 */
export function mcpTools<S extends StandardSchemaV1>(
  tools: McpTool<S>[] | Map<string, McpTool<S>>,
): JsonRpcMethodMap<
  StandardSchemaV1.InferInput<S>,
  StandardSchemaV1.InferOutput<S>
> {
  const toolsMap =
    tools instanceof Map
      ? tools
      : new Map<string, McpTool<S>>(
          tools.map((tool) => [tool.definition.name, tool]),
        );
  /**
   * RPC method: 'tools/list'
   * Lists available tools and their schemas.
   */
  async function listTools() {
    return await Promise.all(
      [...toolsMap.values()].map(async ({ definition }) => ({
        name: definition.name,
        description: definition.description,
        schema:
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
  }

  /**
   * RPC method: 'tools/call'
   * Runs a specific tool with the given arguments.
   */
  async function runTool(params: unknown, event: H3Event) {
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
    const tool = toolsMap.get(toolName);

    if (!tool) {
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
      const result = await tool.handler(parseResult?.value, event);
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
    "tools/list": listTools,
    "tools/call": runTool,
  };
}
