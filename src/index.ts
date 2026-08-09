import { loadConfig } from './config/configLoader';
import { createClient } from './bot/client';
import { startup } from './bot/startup';
import { logger } from './utils/logger';
import { acquireInstanceLock } from './bot/instanceLock';

async function main(): Promise<void> {
  const releaseInstanceLock = await acquireInstanceLock();
  const config = await loadConfig();
  logger.configure(config.logging.level, config.logging.rotateAfterBytes, config.logging.keepFiles);
  const client = createClient();

  process.on('unhandledRejection', (error: unknown) =>
    logger.error('Promise rejeitada sem tratamento.', { error: String(error) })
  );
  process.on('uncaughtException', (error: Error) =>
    logger.critical('Exceção não capturada.', { error: error.message, stack: error.stack })
  );
  process.on('SIGINT', () => {
    logger.info('Encerramento solicitado.');
    releaseInstanceLock();
    client.destroy();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    logger.info('Encerramento solicitado pelo ambiente de hospedagem.');
    releaseInstanceLock();
    client.destroy();
    process.exit(0);
  });

  await startup(client, config);
}

main().catch(error => {
  logger.critical('Falha fatal na inicialização.', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
