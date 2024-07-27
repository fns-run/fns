import { Fns } from "../src/index.ts";
import { serve } from "../src/express.ts";
import express from "npm:express";

const fns = new Fns({ dev: true, token: "helloworld" });
fns.createFunction({ name: "WorkflowTest", version: 1 }, ({ useState, useQuery, useSignal, useFunctions }) => {
  return async ({ ctx, step, abortSignal }) => {
    
    const firstName = await step.run("Set Firstname = Lucas", async () => {
      return "lucas";
    });
    await step.sleep("Wait 10s then finish", "5s");
    const lastName = await step.run("Set Lastname = Fernandes", async () => {
      return "fernandes";
    });
    return `Hello ${firstName} ${lastName}`;
  }
});
fns.createFunction({ name: "helloworld", version: 1 }, ({ useState, useQuery, useSignal }) => {
  const [name, setName] = useState<string>("name", "John Travolta")
  useSignal<string>("setName", (newName) => setName(newName))
  
  return async ({ ctx, step }) => {
    const firstName = await step.run("set-firstname", async () => await fetch("https://api.namefake.com/")
        .then((res) => res.json())
        .then((res) => res.name))
    await step.sleep("wait-10s-then-finish", "5s");
    const lastName = await step.run("set-lastname-Fernandes", async () => await fetch("https://api.namefake.com/")
        .then((res) => res.json())
        .then((res) => res.name))
    
    await step.condition("wait-until-name-is-good", () => name() === `${firstName} ${lastName}`)
    
    return `Hello ${firstName} ${lastName}`
  }
});
const app = express();
app.use("/api-fns", express.raw({ type: "application/json" }), serve(fns));
app.use(express.json());
app.get("/", (req, res) => res.json({ message: "Hello World" }));
app.listen(3100, () => console.log("Server running on port 3100"));