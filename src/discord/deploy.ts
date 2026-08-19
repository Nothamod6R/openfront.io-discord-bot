import { REST, Routes } from 'discord.js';
import type { Config } from '../config.js';
import type { Logger } from '../logger.js';
import { COMMANDS } from './commands.js';

/**
 * Registers slash commands. Registers to a single guild when GUILD_ID is set
 * (fast updates) and globally otherwise.
 */
export async function deployCommands(config: Config, logger: Logger): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const body = COMMANDS.map((command) => command.toJSON());

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.guildId), { body });
    logger.info(`Registered ${body.length} command(s) to guild ${config.guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(config.discordClientId), { body });
    logger.info(`Registered ${body.length} global command(s)`);
  }
}