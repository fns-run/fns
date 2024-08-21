import { Fns } from "../libs/index.ts";
import { serve } from "../libs/servers/express.ts";
import express from "npm:express";

const fns = new Fns({
  dev: true,
  baseUrl: "https://api.fns.run",
});

const workflowtest = fns.createFunction(
  { name: "WorkflowTest", version: 1 },
  ({ useSignal }) => {
    let name: string = "";
    useSignal<string>("setName", (newName) => name = newName);
    return async ({ step, logger }) => {
      const firstName = await step.run(
        "Set Firstname = Lucas",
        () => "lucas",
      );
      for await (
        const counter of step.repeat("repeat-10-times", {
          every: "1s",
          times: 10,
        })
      ) {
        logger.info(`Counter: ${counter}`);
      }
      await step.sleep("Wait 5s then finish", "5s");
      const lastName = await step.run(
        "Set Lastname = Fernandes",
        () =>
          fetch("https://api.namefake.com/")
            .then((res) => res.json())
            .then((res) => res.name),
      );
      logger.info("Setup", firstName, "=", lastName);
      if (
        await step.condition(
          "Check if guess is correct",
          () => name === firstName,
        )
      ) {
        logger.info("Guess is correct");
      } else {
        logger.info("Guess is incorrect");
      }
      return `Hello ${firstName} ${lastName}`;
    };
  },
);
const workflowtest2 = fns.createFunction(
  { name: "WorkflowTest2", version: 1 },
  () => {
    return async ({ step, logger }) => {
      const firstName = await step.run("Set Firstname = Lucas", () => {
        return "lucas";
      });
      for await (
        const counter of step.repeat("repeat-10-times", {
          every: "1s",
          times: 100,
        })
      ) {
        logger.info(`Counter: ${counter}`);
      }
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
    const [_, setName] = useState<string>("name", "John Travolta");
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
