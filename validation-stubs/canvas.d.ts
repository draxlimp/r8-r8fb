declare module '@napi-rs/canvas' {
  export function createCanvas(width: number, height: number): any;
  export function loadImage(source: string | Buffer): Promise<any>;
}
