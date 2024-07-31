![Fns Screenshot](assets/fns.png)

## About

<a href="https://www.fns.run">Website</a> -
<a href="https://discord.fns.run">Discord</a> -
<a href="https://docs.fns.run">Documentation</a>

> **⚠ Warning**<br> Fns is currently in the early stages of development and is
> not yet ready for daily use. Please do not use it in production environments.

**Fns SDK** is a serverless stateless durable function design pattern. Works
with any framework and platform.

## Key Features

- **Infinite Loop**: Run durable function for an infinite amount of time with
  auto snapshot.
- **Scalability**: Scale your durable function to infinity, the only limit is
  your provider.
- **Serverless**: No need to manage servers or infrastructure.
- **Signals & Queries**: Trigger signals or query to other functions.
- **Mutexes**: Solve race conditions at scale with intuitively.
- **Awaitable**: Await for the result of a function or signal.

## Example

```ts
fns.createFunction(
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
```

```ts
fns.createFunction(
  { name: "LockerBox", version: 1 },
  ({ useSignal, useQuery, useState }) => {
    const [locked, setLocked] = useState<boolean>("isLocked", true);
    useSignal("unlock", () => setLocked(false));
    useQuery("isLocked", () => locked());
    return async ({ step, ctx }) => {
      const data = ctx.data as { isLocked: boolean };
      if (data && data.isLocked !== undefined) {
        setLocked(data.isLocked);
      }
      await step.condition("wait-unlock", () => locked() === false);
      return "unlocked";
    };
  },
);
```

## License

<a href="https://opensource.org/license/apache-2-0">
  <img align="right" height="96" alt="MIT License" src="https://opensource.org/wp-content/themes/osi/assets/img/osi-badge-dark.svg" />
</a>

The Fns SDK and its integrations are licensed under the **Apache-2 License**.

The full text of the license can be accessed via
[this link](https://opensource.org/license/apache-2-0) and is also included in
the [LICENSE.md](LICENSE.md) file of this software package.
