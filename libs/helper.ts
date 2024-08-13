export const resolveNextTick = (timeouts: number[]) =>
  new Promise((resolve) => timeouts.push(Number(setTimeout(resolve, 0))));
export async function execute(
  fn: Promise<unknown>,
): Promise<[boolean, unknown]> {
  const timeouts: number[] = [];
  try {
    const result = await Promise.race([
      fn.then((data: unknown) => [true, data]),
      resolveNextTick(timeouts).then(() => [false, null]),
    ]) as [boolean, unknown];
    return result;
  } catch (err) {
    throw err;
  } finally {
    for (let i = 0; i < timeouts.length; i++) {
      clearTimeout(timeouts[i]);
    }
  }
}
export function block<T = unknown>(): Promise<T> {
  return new Promise(() => {});
}

export default { resolveNextTick, execute, block };
