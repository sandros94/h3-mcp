import { type H3Event, HTTPError } from "h3";
import type { JsonRpcResponse } from "../json-rpc.ts";

export interface McpStreamOptions<T = any> extends UnderlyingSource<T> {
  finalResponse?: JsonRpcResponse<T>;
}

export function createMcpStream(
  event: H3Event,
  options: McpStreamOptions,
): ReadableStream {
  const headers = event.req.headers;
  if (
    !headers.get("Accept")?.includes("*/*") &&
    !headers.get("Accept")?.includes("text/event-stream") &&
    !headers.get("Content-Type")?.includes("text/event-stream")
  ) {
    throw new HTTPError({
      status: 406,
      message: "Not Acceptable",
    });
  }

  const { finalResponse, ...opts } = options;

  const stream = new ReadableStream({
    ...opts,
    async start(controller) {
      await opts.start?.(controller);
      if (finalResponse) {
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(finalResponse)),
        );
        controller.close();
      }
    },
  });

  event.res.headers.set("Content-Type", "text/event-stream");

  return stream;
}
