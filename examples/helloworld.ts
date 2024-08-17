import { Fns } from "../libs/index.ts";
import { serve } from "../libs/servers/express.ts";
import express from "npm:express";

const fns = new Fns({
  dev: true,
  baseUrl: "https://api.fns.run",
});
const workflowtest = fns.createFunction(
  { name: "WorkflowTest", version: 1 },
  () => {
    return async ({ step }) => {
      const firstName = await step.run("Set Firstname = Lucas", () => {
        return "lucas";
      });
      await step.sleep("Wait 10s then finish", "5s");
      const lastName = await step.run("Set Lastname = Fernandes", () => {
        return "fernandes";
      });
      return `Hello ${firstName} ${lastName}`;
    };
  },
);
const realapitest = fns.createFunction(
  { name: "helloworld", version: 1 },
  ({ useState, useSignal }) => {
    const [name, setName] = useState<string>("name", "John Travolta");
    useSignal<string>("setName", (newName) => setName(newName));

    return async ({ step }) => {
      const firstName = await step.run(
        "set-firstname",
        async () =>
          await fetch("https://api.namefake.com/")
            .then((res) => res.json())
            .then((res) => res.name),
      );
      await step.sleep("wait-10s-then-finish", "5s");
      const lastName = await step.run(
        "set-lastname-Fernandes",
        async () =>
          await fetch("https://api.namefake.com/")
            .then((res) => res.json())
            .then((res) => res.name),
      );

      return `Hello ${firstName} ${lastName}`;
    };
  },
);
const app = express();
app.use(
  "/api-fns",
  express.raw({ type: "application/json" }),
  serve({ client: fns, functions: [workflowtest, realapitest] }),
);
app.use(express.json());
app.get("/", (_, res) => res.json({ message: "Hello World" }));
app.listen(3100, () => console.log("Server running on port 3100"));
