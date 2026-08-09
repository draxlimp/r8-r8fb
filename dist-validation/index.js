"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configLoader_1 = require("./config/configLoader");
const client_1 = require("./bot/client");
const startup_1 = require("./bot/startup");
const logger_1 = require("./utils/logger");
const instanceLock_1 = require("./bot/instanceLock");
async function main() {
    const releaseInstanceLock = await (0, instanceLock_1.acquireInstanceLock)();
    const config = await (0, configLoader_1.loadConfig)();
    logger_1.logger.configure(config.logging.level, config.logging.rotateAfterBytes, config.logging.keepFiles);
    const client = (0, client_1.createClient)();
    process.on('unhandledRejection', (error) => logger_1.logger.error('Promise rejeitada sem tratamento.', { error: String(error) }));
    process.on('uncaughtException', (error) => logger_1.logger.critical('Exceção não capturada.', { error: error.message, stack: error.stack }));
    process.on('SIGINT', () => {
        logger_1.logger.info('Encerramento solicitado.');
        releaseInstanceLock();
        client.destroy();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        logger_1.logger.info('Encerramento solicitado pelo ambiente de hospedagem.');
        releaseInstanceLock();
        client.destroy();
        process.exit(0);
    });
    await (0, startup_1.startup)(client, config);
}
main().catch(error => {
    logger_1.logger.critical('Falha fatal na inicialização.', {
        error: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map