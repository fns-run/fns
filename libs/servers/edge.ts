import {
  type Fns,
  FNS_SIGNATURE_HEADER,
  type FnsDefinition,
} from "../index.ts";
type ServeParams = {
  client: Fns;
  functions: Array<FnsDefinition>;
};
export function serve(
  { client, functions }: ServeParams,
): (req: Request) => Promise<unknown> {
  client.registerFunctions(functions);
  return async (req: Request) => {
    if (req.method === "GET") {
      return new Response(JSON.stringify(client.getConfig()), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const abortController = new AbortController();
    try {
      const body = await req.text();
      const signature = req.headers.get(FNS_SIGNATURE_HEADER);
      const event = await client.constructEvent(
        body,
        signature as string,
      );
      const result = await client.onHandler(event, abortController.signal);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.log(`Webhook Error: ${e.message}`);
      return new Response(`Webhook Error: ${e.message}`, { status: 400 });
    }
  };
}

export default { serve };
