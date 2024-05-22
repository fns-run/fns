export const resolveNextTick = () => new Promise((resolve) => setTimeout(resolve));
export const execute = (fn: any) => Promise.race([
  fn.then((data:any) => [true, data]),
  resolveNextTick().then(() => [false, null]),
]);
export const block = () => new Promise(() => {}) as Promise<any>;

export default { resolveNextTick, execute, block }