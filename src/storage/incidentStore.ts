import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Incident } from '../types/incident';
export async function saveIncident(incident: Incident): Promise<void> {
  const dir = path.resolve('data','incidents',incident.guildId); await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,`${incident.id}.json`), JSON.stringify(incident,null,2)+'\n','utf8');
}
