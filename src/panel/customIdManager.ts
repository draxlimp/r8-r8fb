import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
export class CustomIdManager {
  private constructor(private readonly secret:Buffer){}
  static async create():Promise<CustomIdManager>{const dir=path.resolve('data','system');const file=path.join(dir,'panel-secret.json');await mkdir(dir,{recursive:true});let hex:string;try{hex=(JSON.parse(await readFile(file,'utf8')) as {secret:string}).secret;}catch{hex=randomBytes(32).toString('hex');await writeFile(file,JSON.stringify({secret:hex},null,2)+'\n','utf8');}return new CustomIdManager(Buffer.from(hex,'hex'));}
  encode(sessionId:string,action:string,arg=''):string{const safeArg=arg.replace(/\|/g,'').slice(0,45);const body=`p|${sessionId}|${action}|${safeArg}`;const sig=createHmac('sha256',this.secret).update(body).digest('base64url').slice(0,8);return `${body}|${sig}`;}
  decode(value:string):{sessionId:string;action:string;arg:string}|null{const parts=value.split('|');if(parts.length!==5||parts[0]!=='p')return null;const body=parts.slice(0,4).join('|');const sig=createHmac('sha256',this.secret).update(body).digest('base64url').slice(0,8);if(sig!==parts[4])return null;return {sessionId:parts[1]!,action:parts[2]!,arg:parts[3]!};}
}
