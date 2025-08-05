import { HTTPError } from "h3";
import type { H3Event } from "h3";
import type { ListingHandler, CallingHandler } from "../../types/index.ts";
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
  annotations?: ResourceAnnotations;
}

type ResourceData =
  | {
      blob?: undefined;
      text: string;
    }
  | {
      blob: string;
      text?: undefined;
    };

// MCP Specification for defining a resource
export type ResourceDef = ParseType<
  ResourceBase & {
    uri: string;
  } & Partial<ResourceData>
>;

export type ResourceList = ParseType<{
  resources: Omit<ResourceDef, "text" | "blob">[];
  nextCursor?: string | undefined;
}>;

export type Resource = ParseType<
  Omit<ResourceDef, "text" | "blob"> & ResourceData
>;

export type ResourceTemplate = ParseType<
  ResourceBase & {
    uriTemplate: string;
  }
>;

export type ResourceTemplateList = ParseType<{
  resourceTemplates: ResourceTemplate[];
  nextCursor?: string | undefined;
}>;

// Handler function for a resource
export type ResourceHandler = (
  data: {
    uri: string;
  },
  event: H3Event,
  jsonrpc: Omit<JsonRpcRequest, "id"> & {
    id: string | number | null;
  },
) => MaybePromise<
  | (Partial<Resource> &
      ({ text: string } | { blob: string }) &
      Record<string, unknown>)
  | void
>;

// ResourceDef definition and handler
export type McpResource = ParseType<
  ResourceDef & {
    handler?: ResourceHandler;
  }
>;

export type McpResourceTemplate = ResourceTemplate;

export type McpResourceMethodMap = JsonRpcMethodMap;

export function mcpResourcesMethods(methods: {
  resources: Map<string, McpResource>;
  resourcesTemplates?: Map<string, McpResourceTemplate>;
  resourcesList?: ListingHandler<{ resources: ResourceDef[] }, ResourceList>;
  resourcesRead?: CallingHandler<{ uri: string }, Resource | Resource[]>;
  resourcesTemplatesList?: ListingHandler<
    { templates: ResourceTemplate[] },
    ResourceTemplateList
  >;
}): McpResourceMethodMap {
  // List resources
  async function resourcesList(data: JsonRpcRequest, event: H3Event) {
    const { cursor } = (data.params || {}) as { cursor?: string };
    const _resources = [...methods.resources.values()].map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { handler, blob, text, ..._resource } = r;
      return _resource;
    }) as Omit<ResourceDef, "text" | "blob">[];

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

    if (
      !params ||
      !("uri" in params) ||
      !params.uri ||
      typeof params.uri !== "string"
    ) {
      throw new HTTPError({
        status: 400,
        message: 'Missing or invalid "uri" parameter for resources/read.',
      });
    }

    const resource = methods.resources.get(params.uri);

    if (!resource) {
      if (methods.resourcesRead) {
        const read = await methods.resourcesRead(
          params as { uri: string },
          event,
          {
            jsonrpc,
            id,
            method,
          },
        );

        if (read) {
          return {
            contents: Array.isArray(read) ? read : [read],
          };
        }
      }
      throw new HTTPError({
        status: 404,
        message: `ResourceDef "${params.uri}" not found.`,
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
  async function resourcesTemplatesList(data: JsonRpcRequest, event: H3Event) {
    const templates = [...(methods.resourcesTemplates?.values() || [])];
    const { cursor } = (data.params || {}) as { cursor?: string };

    if (methods.resourcesTemplatesList) {
      return await methods.resourcesTemplatesList(
        { templates, cursor },
        event,
        {
          ...data,
          id: data.id ?? null,
        },
      );
    }

    return {
      templates,
    };
  }

  return {
    "resources/list": resourcesList,
    "resources/read": resourcesRead,
    "resources/templates/list": resourcesTemplatesList,
  };
}
