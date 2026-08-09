declare interface ProcessLike { pid:number; exitCode:number; cwd():string; exit(code?:number):never; on(event:string, listener:(...args:any[])=>any):any; once(event:string, listener:(...args:any[])=>any):any; kill(pid:number, signal?:number|string):boolean; }
declare const process:ProcessLike;
declare class Buffer { static from(...args:any[]):Buffer; }
declare namespace NodeJS { interface Timeout { unref():void } }
declare function setInterval(handler:(...args:any[])=>void, timeout?:number, ...args:any[]):NodeJS.Timeout;
declare module 'node:fs/promises' { export const appendFile:any; export const mkdir:any; export const readdir:any; export const rename:any; export const stat:any; export const unlink:any; export const readFile:any; export const writeFile:any; export const copyFile:any; export const rm:any; export const open:any; }
declare module 'node:path' { const path:any; export default path; }
declare module 'node:crypto' { export const randomBytes:any; export const createHmac:any; }

declare module 'node:fs' { export const existsSync:any; export const unlinkSync:any; export const readFileSync:any; }
declare function require(name:string):any;
