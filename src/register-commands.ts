import { loadConfig } from './config.js';
import { deployCommands } from './discord/deploy.js';
import { createLogger, type LogLevel } from './logger.js';

const config = loadConfig();
const logger = createLogger(config.logLevel as LogLevel);

try {
  await deployCommands(config, logger);
} catch (err) {
  logger.error(`Failed to register commands: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}