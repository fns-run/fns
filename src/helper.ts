export const resolveNextTick = (timeouts: number[]) =>
  new Promise((resolve) => timeouts.push(setTimeout(resolve, 0)));
export const execute = async (fn: any) => {
  const timeouts: number[] = [];
  function clear() {
    for (let i = 0; i < timeouts.length; i++) {
      clearTimeout(timeouts[i]);
    }
  }
  try {
    const result = await Promise.race([
      fn.then((data: any) => [true, data]),
      resolveNextTick(timeouts).then(() => [false, null]),
    ]);
    clear();
    return result;
  } catch (err) {
    clear();
    throw err;
  }
};
export const block = () => new Promise(() => {}) as Promise<any>;

export default { resolveNextTick, execute, block };
