import { FNS_SIGNATURE_HEADER, Fns } from "./index.ts";
import type { VercelRequest, VercelResponse } from 'npm:@vercel/node'
import type { Readable } from 'node:stream';

export const config = {
  api: {
    bodyParser: false,
  },
};
async function readableToString2(readable: Readable) {
  let result = '';
  for await (const chunk of readable) {
    result += chunk;
  }
  return result;
}

export const serve = (client: Fns) => {
  return async(req: VercelRequest, res: VercelResponse) => {
    if(req.method === "GET") return res.json(client.getConfig());
    const abortController = new AbortController();
    try {
      const event = client.constructEvent(req.body.toString('utf8'), req.headers[FNS_SIGNATURE_HEADER] as string);
      const result = await client.onHandler(event, abortController.signal);
      return res.json(result);
    } catch (err: any) {
      console.log(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
};

export default { serve };