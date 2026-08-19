import type { ChatInputCommandInteraction } from 'discord.js';
import { handleClan } from './handlers/clan.js';
import { handleClanLeaderboard } from './handlers/clan-leaderboard.js';
import { handleClanSessions } from './handlers/clan-sessions.js';
import { handleGame } from './handlers/game.js';
import { handleGames } from './handlers/games.js';
import { handlePlayer } from './handlers/player.js';
import { handlePlayerGames } from './handlers/player-games.js';
import { handlePlayerSessions } from './handlers/player-sessions.js';
import type { HandlerContext } from './handlers/types.js';

/** Routes a chat input command to its handler. */
export async function routeCommand(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
  switch (interaction.commandName) {
    case 'game':
      return handleGame(interaction, ctx);
    case 'games':
      return handleGames(interaction, ctx);
    case 'player':
      return handlePlayer(interaction, ctx);
    case 'player-games':
      return handlePlayerGames(interaction, ctx);
    case 'player-sessions':
      return handlePlayerSessions(interaction, ctx);
    case 'clan':
      return handleClan(interaction, ctx);
    case 'clan-sessions':
      return handleClanSessions(interaction, ctx);
    case 'clan-leaderboard':
      return handleClanLeaderboard(interaction, ctx);
    default:
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
}