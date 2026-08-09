import type { PanelManager } from '../panel/panelManager';
export async function runPanelCommand(message:any,panel:PanelManager):Promise<void>{await panel.open(message);}
