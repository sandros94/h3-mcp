import { HTTPError } from "h3";
import type { H3Event } from "h3";
import type { ListingHandler, CallingHandler } from "../../types/index.ts";
import type { ParseType, MaybePromise } from "../../types/utils.ts";
import type { JsonRpcMethodMap, JsonRpcRequest } from "../json-rpc.ts";

/**
 * Annotations for a resource.
 */
interface ResourceAnnotations {
  /**
   * The intended audience for the resource.
   */
  audience?: ("user" | "assistant")[];
  /**
   * The priority of the resource.
   */
  priority?: number;
  /**
   * The last modified date of the resource.
   */
  lastModified?: Date;
}

/**
 * Base interface for a resource.
 */
interface ResourceBase {
  /**
   * The name of the resource.
   */
  name?: string;
  /**
   * The title of the resource.
   */
  title?: string;
  /**
   * A description of the resource.
   */
  description?: string;
  /**
   * The MIME type of the resource.
   */
  mimeType?: string;
  /**
   * Annotations for the resource.
   */
  annotations?: ResourceAnnotations;
}

/**
 * The data of a resource, which can be either text or a blob.
 */
type ResourceData =
  | {
      /**
       * The text content of the resource.
       */
      text: string;
      blob?: undefined;
    }
  | {
      /**
       * The blob content of the resource, as a base64-encoded string.
       */
      blob: string;
      text?: undefined;
    };

/**
 * MCP Specification for defining a resource.
 */
export type ResourceDef = ParseType<
  ResourceBase & {
    /**
     * The URI of the resource.
     */
    uri: string;
  } & Partial<ResourceData>
>;

/**
 * A list of resources.
 */
export type ResourceList = ParseType<{
  /**
   * An array of resource definitions.
   */
  resources: Omit<ResourceDef, "text" | "blob">[];
  /**
   * A cursor for pagination.
   */
  nextCursor?: string | undefined;
}>;

/**
 * A resource with its data.
 */
export type Resource = ParseType<
  Omit<ResourceDef, "text" | "blob"> & ResourceData
>;

/**
 * A template for creating resources.
 */
export type ResourceTemplate = ParseType<
  ResourceBase & {
    /**
     * The URI template for the resource.
     */
    uriTemplate: string;
  }
>;

/**
 * A list of resource templates.
 */
export type ResourceTemplateList = ParseType<{
  /**
   * An array of resource templates.
   */
  resourceTemplates: ResourceTemplate[];
  /**
   * A cursor for pagination.
   */
  nextCursor?: string | undefined;
}>;

/**
 * Handler function for a resource.
 * @param data The data for the resource.
 * @param event The H3 event.
 * @param jsonrpc The JSON-RPC request object.
 * @returns A promise that resolves to the resource data or void.
 */
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
  | ReadableStream
  | void
>;

/**
 * A resource definition with its handler.
 */
export type McpResource = ParseType<
  ResourceDef & {
    /**
     * The handler for the resource.
     */
    handler?: ResourceHandler;
  }
>;

/**
 * A resource template.
 */
export type McpResourceTemplate = ResourceTemplate;

/**
* A map of JSON-RPC methods for MCP resources.
*/
export type McpResourceMethodMap = JsonRpcMethodMap;

/**
 * Creates a set of JSON-RPC methods for handling MCP resource interactions.
 * @param methods An object containing the resource maps and handlers.
 * @returns A map of JSON-RPC methods for resources.
 */
export function mcpResourcesMethods(methods: {
  /**
   * A map of registered resources.
   */
  resources: Map<string, McpResource>;
  /**
   * An optional map of registered resource templates.
   */
  resourcesTemplates?: Map<string, McpResourceTemplate>;
  /**
   * An optional handler for listing resources.
   */
  resourcesList?: ListingHandler<{ resources: ResourceDef[] }, ResourceList>;
  /**
   * An optional handler for reading resources.
   */
  resourcesRead?: CallingHandler<{ uri: string }, Resource | Resource[]>;
  /**
   * An optional handler for listing resource templates.
   */
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
