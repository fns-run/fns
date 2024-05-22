import { FNS_SIGNATURE_HEADER, Fns } from "@fns-run/sdk";
import type { Request, Response } from "express";

export const serve = (client: Fns) => {
  return async (req: Request, res: Response) => {
    if(req.method === "GET") return res.json(client.getConfig());
    const abortController = new AbortController();

    try {
      const event = client.constructEvent(req.body.toString('utf8'), req.headers[FNS_SIGNATURE_HEADER] as string);
      const result = await client.onHandler(event, abortController.signal);
      return res.json(result);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
};
export default { };