export const resolveNextTick = (timeouts: number[]) =>
  new Promise((resolve) => timeouts.push(Number(setTimeout(resolve, 0))));
export async function execute(
  fn: Promise<unknown>,
): Promise<[boolean, unknown]> {
  const timeouts: number[] = [];
  function clear() {
    for (let i = 0; i < timeouts.length; i++) {
      clearTimeout(timeouts[i]);
    }
  }
  try {
    const result = await Promise.race([
      fn.then((data: unknown) => [true, data]),
      resolveNextTick(timeouts).then(() => [false, null]),
    ]) as [boolean, unknown];
    clear();
    return result;
  } catch (err) {
    clear();
    throw err;
  }
}
export function block<T = unknown>(): Promise<T> {
  return new Promise(() => {});
}

export default { resolveNextTick, execute, block };
