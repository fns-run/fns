// Run `npm start` to start the demo
import {
  cancel,
  confirm,
  intro,
  isCancel,
  outro,
  select,
  spinner,
  text,
} from "npm:@clack/prompts";
import { setTimeout as sleep } from "node:timers/promises";
import color from "npm:picocolors";

async function main() {
  intro(color.inverse(" create-my-app "));

  const name = await text({
    message: "What is your name?",
    placeholder: "Anonymous",
  });

  if (isCancel(name)) {
    cancel("Operation cancelled");
    return Deno.exit(0);
  }

  const shouldContinue = await confirm({
    message: "Do you want to continue?",
  });

  if (isCancel(shouldContinue)) {
    cancel("Operation cancelled");
    return Deno.exit(0);
  }

  const projectType = await select({
    message: "Pick a project type.",
    options: [
      { value: "ts", label: "TypeScript" },
      { value: "js", label: "JavaScript" },
      { value: "coffee", label: "CoffeeScript", hint: "oh no" },
    ],
  });

  if (isCancel(projectType)) {
    cancel("Operation cancelled");
    return Deno.exit(0);
  }

  const s = spinner();
  s.start("Installing via npm");

  await sleep(3000);

  s.stop("Installed via npm");

  outro("You're all set!");

  await sleep(1000);
}

main().catch(console.error);
