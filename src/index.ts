import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadConfig } from './config.js';
import { deployCommands } from './discord/deploy.js';
import { errorEmbed } from './discord/errors.js';
import { PaginatorRegistry } from './discord/pagination.js';
import { routeCommand } from './discord/router.js';
import { startHealthServer } from './health.js';
import { createLogger, type LogLevel } from './logger.js';
import { buildClient } from './openfront/index.js';

const config = loadConfig();
const logger = createLogger(config.logLevel as LogLevel);

const apiClient = buildClient(config);
const paginators = new PaginatorRegistry();

const discord = new Client({ intents: [GatewayIntentBits.Guilds] });

discord.once(Events.ClientReady, async (readyClient) => {
  logger.info(`Logged in as ${readyClient.user.tag}`);

  try {
    await deployCommands(config, logger);
  } catch (err) {
    logger.error(`Failed to deploy commands: ${err instanceof Error ? err.message : String(err)}`);
  }

  startHealthServer(config.port, logger);
  setInterval(() => paginators.cleanup(), 60_000).unref();
});

discord.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await routeCommand(interaction, { client: apiClient, paginators });
      return;
    }

    if (interaction.isButton()) {
      const paginatorId = interaction.customId.split(':')[0] ?? '';
      const paginator = paginators.get(paginatorId);
      if (!paginator) {
        await interaction.reply({ content: 'This pagination has expired. Please run the command again.', ephemeral: true });
        return;
      }
      await paginator.handle(interaction);
    }
  } catch (err) {
    logger.error(`Interaction error: ${err instanceof Error ? err.message : String(err)}`);
    const payload = { embeds: [errorEmbed(err).toJSON()] };
    try {
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({ ...payload, ephemeral: true });
      } else if (interaction.isRepliable()) {
        await interaction.editReply(payload);
      }
    } catch {
      logger.error('Failed to send error response for interaction.');
    }
  }
});

async function shutdown(): Promise<void> {
  logger.info('Shutting down…');
  await discord.destroy();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await discord.login(config.discordToken);