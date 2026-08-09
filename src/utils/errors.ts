import { randomId } from './ids';
export class R8Error extends Error {
  readonly code: string;
  constructor(message: string, code = randomId(4), readonly causeValue?: unknown) { super(message); this.name = 'R8Error'; this.code = code; }
}
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
