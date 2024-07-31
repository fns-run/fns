import { build, emptyDir } from "jsr:@deno/dnt@^0.41.1";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "@fns-run/fns",
    version: Deno.args[0],
    description:
      "Fns is the React for backend development, making serverless functions invincible. It offers a zero-infrastructure platform with reliable execution, signal handling, all with built-in observability.",
    license: "Apache-2.0",
    homepage: "https://github.com/fns-run/fns",
    repository: {
      type: "git",
      url: "git+https://github.com/fns-run/fns.git",
    },
    bugs: {
      url: "https://github.com/fns-run/fns/issues",
    },
    keywords: [
      "cloud",
      "microservices",
      "typescript",
      "sdk",
      "serverless",
      "backend",
      "functions",
      "scalability",
      "reliability",
      "react-style",
      "edge",
      "developer-tools",
      "event-driven",
      "observability",
      "signal-handling",
      "queue-management",
      "durable-execution",
      "zero-infrastructure",
    ],
    devDependencies: {
      "@types/express": "^4.17.15",
    }
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
