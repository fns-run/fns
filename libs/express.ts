// @deno-types=npm:@types/express
import { type Fns, FNS_SIGNATURE_HEADER } from "./index.ts";
import type { Request, Response } from "npm:express@4.19.2";

export function serve(
  client: Fns,
): (req: Request, res: Response) => Promise<unknown> {
  return async (req: Request, res: Response) => {
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
      return res.status(400).send(`Internal Server Error: ${e.message}`);
    }
  };
}

export default { serve };
