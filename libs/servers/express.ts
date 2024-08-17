import type { Request, Response } from "npm:express@4.19.2";
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
): (req: Request, res: Response) => Promise<unknown> {
  client.registerFunctions(functions);
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
      console.error(e);
      return res.status(400).send(`Internal Server Error: ${e.message}`);
    }
  };
}

export default { serve };
