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
    name: "fns",
    version: Deno.args[0],
    description: "Fns is a function as a service runtime",
    license: "Apache-2",
    repository: {
      type: "git",
      url: "git+https://github.com/fns-run/fns.git",
    },
    bugs: {
      url: "https://github.com/fns-run/fns/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
