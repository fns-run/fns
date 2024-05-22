import { FnsRuntime } from "@fns-run/sdk";
import { serve } from "@fns-run/express";
import express from "express";

const fns = new FnsRuntime({ dev: true, token: "helloworld" });

fns.createFunction({ name: "WorkflowTest", version: 1 }, ({ useState, useQuery, useSignal }) => {
  let newName = "lucas";
  useSignal("setName", (name: string) => {
    newName = name;
  });
  return async ({ event, step, abortSignal }) => {      
    const firstName = await step.run("Set Firstname = Lucas", async () => {
      return "lucas";
    });
    await step.sleep("Wait 10s then finish", "5s");
    const lastName = await step.run("Set Lastname = Fernandes", async () => {
      return "fernandes";
    });
    if(!await step.condition("Is Lucas Fernandes?", () => {
      return firstName === "lucas" && lastName === newName
    }, "3s")) {
      console.log("Not Lucas Fernandes", "val", newName);
    }
    return `Hello ${firstName} ${lastName}`;
  }
});
const app = express();
app.use("/api-fns", express.raw({ type: "application/json" }), serve(fns));
app.use(express.json());
app.get("/", (req, res) => res.json({ message: "Hello World" }));
app.listen(3100, () => console.log("Server running on port 3100"));