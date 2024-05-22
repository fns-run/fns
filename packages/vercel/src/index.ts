import { FNS_SIGNATURE_HEADER, Fns } from "@fns-run/sdk";
import type { WorkflowFunction } from "@fns-run/sdk/dist/types";
import type { VercelRequest, VercelResponse } from '@vercel/node'
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
      const buf = await readableToString2(req);
      const event = client.constructEvent(req.body.toString('utf8'), req.headers[FNS_SIGNATURE_HEADER] as string);
      const result = await client.onHandler(event, abortController.signal);
      return res.json(result);
    } catch (err: any) {
      console.log(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
};