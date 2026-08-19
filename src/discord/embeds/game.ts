import type { GameDetail, GameSummary } from '../../models/types.js';
import {
  EMBED_COLORS,
  baseEmbed,
  formatBool,
  formatDuration,
  formatNumber,
  formatTimestamp,
  gameTypeEmoji,
  nullToText,
  truncate,
} from './formatting.js';

export const GAME_PER_PAGE = 6;

/** Embed for a single game summary row inside `/games` results. */
export function gameSummaryField(game: GameSummary): { name: string; value: string; inline: boolean } {
  const emoji = gameTypeEmoji(game.type);
  const name = `${emoji} ${game.game}`;
  const lines: string[] = [];
  if (game.mode) lines.push(`**Mode:** ${game.mode}`);
  if (game.difficulty) lines.push(`**Difficulty:** ${game.difficulty}`);
  if (game.numPlayers != null || game.maxPlayers != null) {
    lines.push(`**Players:** ${formatNumber(game.numPlayers)}/${formatNumber(game.maxPlayers)}`);
  }
  if (game.playerTeams) lines.push(`**Teams:** ${game.playerTeams}`);
  if (game.rankedType) lines.push(`**Ranked:** ${game.rankedType}`);
  if (game.start) lines.push(`**Start:** ${formatTimestamp(game.start)}`);
  if (game.start && game.end) {
    const duration = new Date(game.end).getTime() - new Date(game.start).getTime();
    if (Number.isFinite(duration) && duration >= 0) lines.push(`**Duration:** ${formatDuration(duration)}`);
  }
  return { name, value: truncate(lines.join('\n')) || 'No data', inline: false };
}

/**
 * Builds one embed page of game summaries.
 * `totalPages` reflects the locally paginated slice; `apiTotal` (from the
 * Content-Range header) is surfaced as informational context when the API
 * reports more matches than were fetched.
 */
export function gameListEmbed(
  games: GameSummary[],
  page: number,
  totalPages: number,
  apiTotal?: number | null,
): import('discord.js').EmbedBuilder {
  const start = page * GAME_PER_PAGE + 1;
  const end = Math.min((page + 1) * GAME_PER_PAGE, games.length);
  let description = `Showing games **${start}–${end}** of the fetched results.`;
  if (apiTotal != null && apiTotal > games.length) {
    description += ` The full result set contains **${formatNumber(apiTotal)}** matching games.`;
  }
  const embed = baseEmbed(EMBED_COLORS.game, '🎮 Recent OpenFront Games').setDescription(description);
  for (const game of games) {
    embed.addFields(gameSummaryField(game));
  }
  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${page + 1}/${totalPages} • OpenFront API` });
  } else {
    embed.setFooter({ text: 'OpenFront API' });
  }
  return embed;
}

/** Embed for `/game <gameId>`. */
export function gameDetailEmbed(game: GameDetail): import('discord.js').EmbedBuilder {
  const info = game.info;
  const config = info.config ?? {};
  const emoji = gameTypeEmoji(config.gameType);
  const embed = baseEmbed(EMBED_COLORS.game, `${emoji} Game ${info.gameID ?? 'Unknown'}`);

  const mapName = config.gameMap;
  if (mapName) embed.addFields({ name: '🗺️ Map', value: String(mapName), inline: true });

  const typeValue = [config.gameType, config.gameMode].filter(Boolean).join(' • ');
  if (typeValue) embed.addFields({ name: '📋 Type / Mode', value: typeValue, inline: true });
  if (config.difficulty) embed.addFields({ name: '📈 Difficulty', value: String(config.difficulty), inline: true });
  if (config.gameMapSize) embed.addFields({ name: '📐 Map Size', value: String(config.gameMapSize), inline: true });

  const numPlayers = info.players?.length;
  if (numPlayers !== undefined) {
    const maxPlayers = config.maxPlayers ?? info.config?.maxPlayers;
    embed.addFields({
      name: '👥 Players',
      value: maxPlayers != null ? `${formatNumber(numPlayers)}/${formatNumber(maxPlayers)}` : formatNumber(numPlayers),
      inline: true,
    });
  }
  if (config.bots != null) embed.addFields({ name: '🤖 Bots', value: formatNumber(config.bots), inline: true });
  if (config.playerTeams != null && config.playerTeams !== '') {
    embed.addFields({ name: '👥 Team Config', value: String(config.playerTeams), inline: true });
  }
  if (config.maxPlayers != null) {
    embed.addFields({ name: '🏷️ Max Players', value: formatNumber(config.maxPlayers), inline: true });
  }
  if (config.publicGameModifiers?.length) {
    embed.addFields({ name: '⚙️ Modifiers', value: config.publicGameModifiers.join(', '), inline: true });
  }

  const startMs = info.start ?? null;
  const endMs = info.end ?? null;
  if (startMs != null) embed.addFields({ name: '🕐 Start', value: formatTimestamp(startMs), inline: true });
  if (endMs != null) embed.addFields({ name: '🕐 End', value: formatTimestamp(endMs), inline: true });
  if (info.duration != null) embed.addFields({ name: '⏱️ Duration', value: formatDuration(info.duration), inline: true });
  if (info.num_turns != null) embed.addFields({ name: '🔁 Turns', value: formatNumber(info.num_turns), inline: true });
  if (info.lobbyFillTime != null) {
    embed.addFields({ name: '⏳ Lobby Fill', value: formatDuration(info.lobbyFillTime), inline: true });
  }
  if (info.winner?.length) {
    embed.addFields({ name: '🏆 Winner', value: truncate(info.winner.join(', ')), inline: false });
  }

  const flagLines: string[] = [];
  if (config.infiniteGold != null) flagLines.push(`Infinite Gold: ${formatBool(config.infiniteGold)}`);
  if (config.infiniteTroops != null) flagLines.push(`Infinite Troops: ${formatBool(config.infiniteTroops)}`);
  if (config.instantBuild != null) flagLines.push(`Instant Build: ${formatBool(config.instantBuild)}`);
  if (config.randomSpawn != null) flagLines.push(`Random Spawn: ${formatBool(config.randomSpawn)}`);
  if (config.disableNPCs != null) flagLines.push(`NPCs: ${formatBool(config.disableNPCs, 'Disabled', 'Enabled')}`);
  if (config.donateGold != null) flagLines.push(`Donate Gold: ${formatBool(config.donateGold)}`);
  if (config.donateTroops != null) flagLines.push(`Donate Troops: ${formatBool(config.donateTroops)}`);
  if (flagLines.length) {
    embed.addFields({ name: '⚙️ Settings', value: truncate(flagLines.join('\n')), inline: false });
  }

  if (config.disabledUnits?.length) {
    embed.addFields({ name: '🚫 Disabled Units', value: truncate(config.disabledUnits.join(', ')), inline: false });
  }

  if (info.players?.length) {
    const players = info.players
      .map((p) => {
        const clan = p.clanTag ? ` [${p.clanTag}]` : '';
        const creator = p.isLobbyCreator ? ' 🛠️' : '';
        return `${nullToText(p.username)}${clan}${creator}`;
      })
      .join('\n');
    embed.addFields({ name: `👤 Players (${info.players.length})`, value: truncate(players, 1000) || 'N/A', inline: false });
  }

  return embed;
}