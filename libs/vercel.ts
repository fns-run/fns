import { type Fns, FNS_SIGNATURE_HEADER } from "./index.ts";
import type { VercelRequest, VercelResponse } from "npm:@vercel/node@3.1.5";
//import type { Readable } from "node:stream";

export const config = {
  api: {
    bodyParser: false,
  },
};
/*
async function readableToString2(readable: Readable) {
  let result = "";
  for await (const chunk of readable) {
    result += chunk;
  }
  return result;
}*/

export function serve(
  client: Fns,
): (req: VercelRequest, res: VercelResponse) => Promise<unknown> {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (req.method === "GET") return res.json(client.getConfig());
    const abortController = new AbortController();
    try {
      const event = await client.constructEvent(
        req.body.toString("utf8"),
        req.headers[FNS_SIGNATURE_HEADER] as string,
      );
      const result = await client.onHandler(event, abortController.signal);
      return res.json(result);
    } catch (e) {
      console.log(`Webhook Error: ${e.message}`);
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }
  };
}

export default { serve };
