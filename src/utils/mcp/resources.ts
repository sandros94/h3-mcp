import { HTTPError } from "h3";
import type { H3Event } from "h3";
import type { ParseType, MaybePromise } from "../../types/utils.ts";
import type { JsonRpcMethodMap, JsonRpcRequest } from "../json-rpc.ts";

interface ResourceAnnotations {
  audience?: ("user" | "assistant")[];
  priority?: number;
  lastModified?: Date;
}

interface ResourceBase {
  name?: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

// MCP Specification for a single resource
export type Resource = ParseType<
  ResourceBase & {
    uri: string;
    annotations?: ResourceAnnotations;
  } & Partial<
      | {
          blob: undefined;
          text: string;
        }
      | {
          blob: string;
          text: undefined;
        }
    >
>;

export type ResourceTemplate = ParseType<
  ResourceBase & {
    uriTemplate: string;
  }
>;

// Handler function for a resource
export type ResourceHandler = (
  data: {
    uri: string;
  },
  event: H3Event,
  jsonrpc: Omit<JsonRpcRequest, "id"> & {
    id: string | number | null;
  },
) => MaybePromise<Partial<Resource & Record<string, unknown>> | void>;

// Resource definition and handler
export type McpResource = ParseType<
  Resource & {
    handler?: ResourceHandler;
  }
>;

export type McpResourceTemplate = ResourceTemplate;

export type McpResourceMethodMap = JsonRpcMethodMap;

export function mcpResourcesMethods(
  resources: McpResource[] | Map<string, McpResource>,
  templates?: McpResourceTemplate[] | Map<string, McpResourceTemplate>,
): McpResourceMethodMap {
  const resourcesMap =
    resources instanceof Map
      ? resources
      : new Map(resources.map((r) => [r.name, r]));

  const templatesMap = templates
    ? templates instanceof Map
      ? templates
      : new Map(templates.map((t) => [t.name, t]))
    : new Map();

  // List resources
  function resourcesList(request: JsonRpcRequest) {
    const { cursor } = (request.params || {}) as { cursor?: string };
    return {
      resources: [...resourcesMap.values()].map((r) => ({
        uri: r.uri,
        name: r.name,
        title: r.title,
        description: r.description,
        mimeType: r.mimeType,
      })),
      cursor,
    };
  }

  // Read resource
  async function resourcesRead(request: JsonRpcRequest, event: H3Event) {
    const {
      params,
      jsonrpc,
      method,
      id = null,
    } = request as JsonRpcRequest<{ uri?: string }>;
    if (!params || !("uri" in params) || typeof params.uri !== "string") {
      throw new HTTPError({
        status: 400,
        message: 'Missing or invalid "uri" parameter for resources/read.',
      });
    }
    const resource = resourcesMap.get(params.uri);
    if (!resource) {
      throw new HTTPError({
        status: 404,
        message: `Resource "${params.uri}" not found.`,
      });
    }
    const { handler, ..._resource } = resource;
    return {
      contents: [
        {
          ..._resource,
          ...(handler
            ? await handler({ uri: params.uri }, event, {
                jsonrpc,
                method,
                id,
              })
            : {}),
        },
      ],
    };
  }

  // List resource templates
  async function resourcesTemplatesList() {
    return {
      templates: [...templatesMap.values()].map((t) => ({
        name: t.name,
        description: t.description,
        schema: t.schema,
      })),
    };
  }

  return {
    "resources/list": resourcesList,
    "resources/read": resourcesRead,
    "resources/templates/list": resourcesTemplatesList,
  };
}
