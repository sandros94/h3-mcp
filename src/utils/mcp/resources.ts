import { HTTPError } from "h3";
import type { H3Event } from "h3";
import type { ListingHandler } from "../../types/index.ts";
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

export function mcpResourcesMethods(methods: {
  resourcesRead: Map<string, McpResource>;
  resourcesList?: ListingHandler<
    { resources: Resource[] },
    { resources: Resource[] }
  >;
  resourcesTemplatesList?: Map<string, McpResourceTemplate>;
}): McpResourceMethodMap {
  // List resources
  async function resourcesList(data: JsonRpcRequest, event: H3Event) {
    const { cursor } = (data.params || {}) as { cursor?: string };
    const _resources = [...methods.resourcesRead.values()].map((r) => ({
      uri: r.uri,
      name: r.name,
      title: r.title,
      description: r.description,
      mimeType: r.mimeType,
    }));

    if (methods.resourcesList) {
      return await methods.resourcesList(
        { cursor, resources: _resources },
        event,
        {
          ...data,
          id: data.id ?? null,
        },
      );
    }

    return {
      resources: _resources,
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
    const resource = methods.resourcesRead.get(params.uri);
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
    if (!methods.resourcesTemplatesList) {
      return {
        templates: [],
      };
    }
    return {
      templates: [...methods.resourcesTemplatesList.values()],
    };
  }

  return {
    "resources/list": resourcesList,
    "resources/read": resourcesRead,
    "resources/templates/list": resourcesTemplatesList,
  };
}
