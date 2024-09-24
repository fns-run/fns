<p align="center">
  <a href="https://www.fns.run">
    <img src="assets/logo.svg" alt="fns" width="180" />
  </a>
</p>

<p align="center">
  <a href="https://jsr.io/@fns-run/fns"> <img src="https://jsr.io/badges/@fns-run/fns" alt="" /></a>
  <a href="https://jsr.io/@fns-run/fns"><img src="https://jsr.io/badges/@fns-run/fns/score" alt="" /></a>
</p>

## Fns SDK

<a href="https://www.fns.run">Website</a> -
<a href="https://tg.fns.run">Telegram</a> -
<a href="https://docs.fns.run">Documentation</a>

> **⚠ Warning**<br> Fns is currently in the early stages of development and is
> not yet ready for daily use. Please do not use it in production environments.

Welcome to **Fns** – your go-to solution for building **blazing fast**,
**serverless**, and **stateful** durable functions. Whether you're managing
workflows, automating tasks, or orchestrating microservices, Fns delivers high
performance with ease and reliability.

## 🤔 Motivation

Fns emerged from our internal need to manage complex, distributed workflows in
an increasingly serverless world. As our teams grew and our applications became
more sophisticated, we encountered challenges that only stateful, serverless
architectures could solve. Thus, Fns was born—a solution to the hurdles we faced
and a tool to power your next great application.

The journey was anything but easy. We tackled every challenge that comes with
building stateful functions in a serverless environment. Just to highlight a
few:

- How do we manage state across distributed functions?
- How can we ensure reliable, durable execution in a serverless context?
- How do we orchestrate workflows across multiple microservices with minimal
  latency?
- How do we handle event-driven architectures efficiently?

After overcoming these obstacles and refining our approach, we distilled our
learnings into **Fns**, a minimal yet powerful framework that can handle the
toughest challenges in serverless computing. Today, Fns is the backbone of
numerous production applications, and we're excited to share it with you.

**TL;DR:** Fns is your ultimate solution for building fast, serverless, and
stateful applications 🚀.

## ✨ Keys

- **Serverless Architecture**: Focus on your code, not the infrastructure. Fns
  takes care of scalability and availability.
- **Stateful Workflows**: Seamlessly manage state across distributed functions
  without worrying about the underlying complexities.
- **Blazing Fast**: Optimized for performance, ensuring your workflows execute
  with lightning speed.
- **Durable Functions**: Built to handle failure scenarios, ensuring your
  functions are reliable and resilient.
- **Event-driven**: Perfect for building event-driven architectures with robust
  and scalable processing.
- **Platform Agnostic**: Works with any framework and platform, allowing you to
  build with the tools you love.

## 🚀 Quick Start

**NPM**

```shell
$ npm i @fns-run/fns
```

**Deno**

```shell
$ deno add @fns-run/fns
```

### Example

```typescript
import { Fns } from "@fns-run/fns";

const fns = new Fns({ baseUrl: "https://api.fns.run" });
```

## 👥 Contributors

Thanks to all the contributors!

## License

<a href="https://opensource.org/license/apache-2-0">
  <img align="right" height="96" alt="MIT License" src="https://opensource.org/wp-content/themes/osi/assets/img/osi-badge-dark.svg" />
</a>

The Fns SDK and its integrations are licensed under the **Apache-2 License**.

The full text of the license can be accessed via
[this link](https://opensource.org/license/apache-2-0) and is also included in
the [LICENSE.md](LICENSE.md) file of this software package.
