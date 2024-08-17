export function block<T = unknown>(): Promise<T> {
  return new Promise<T>(() => {});
}

export default { block };
