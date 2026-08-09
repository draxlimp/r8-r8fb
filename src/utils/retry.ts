export async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < Math.max(1, attempts); i++) {
    try { return await fn(); }
    catch (error) { last = error; if (i + 1 < attempts) await new Promise(r => setTimeout(r, delayMs)); }
  }
  throw last;
}
