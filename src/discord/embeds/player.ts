import type {
  Player,
  PlayerGame,
  PlayerGamesResponse,
  PlayerSession,
} from '../../models/types.js';
import {
  EMBED_COLORS,
  baseEmbed,
  formatDurationSeconds,
  formatNumber,
  formatPercent,
  formatRelativeTimestamp,
  formatTimestamp,
  gameTypeEmoji,
  nullToText,
  resultColor,
  resultEmoji,
  truncate,
} from './formatting.js';

const PLAYER_GAMES_PER_PAGE = 6;
export const PLAYER_SESSIONS_PER_PAGE = 8;

export interface PlayerStatSummary {
  totalWins: number;
  totalLosses: number;
  totalGames: number;
  byType: Array<{ type: string; wins: number; losses: number; total: number }>;
}

/**
 * Walks the nested player stats tree:
 *   stats[type][mode][difficulty] = { wins, losses, total, stats }
 * `Ranked` buckets (e.g. "1v1") hold a bucket directly instead of mode/difficulty.
 * The `recent` key is skipped.
 */
export function aggregatePlayerStats(player: Player): PlayerStatSummary {
  const summary: PlayerStatSummary = { totalWins: 0, totalLosses: 0, totalGames: 0, byType: [] };
  const stats = player.stats ?? {};
  const typeCounts = new Map<string, { wins: number; losses: number; total: number }>();

  const addBucket = (type: string, bucket: unknown): void => {
    if (typeof bucket !== 'object' || bucket === null || Array.isArray(bucket)) return;
    const b = bucket as Record<string, unknown>;
    const wins = toNumber(b.wins);
    const losses = toNumber(b.losses);
    const total = toNumber(b.total);
    if (wins === 0 && losses === 0 && total === 0) return;
    if (typeof b.wins !== 'string' && typeof b.wins !== 'number' && b.wins !== undefined) return;
    const current = typeCounts.get(type) ?? { wins: 0, losses: 0, total: 0 };
    current.wins += wins;
    current.losses += losses;
    current.total += total;
    typeCounts.set(type, current);
  };

  for (const [type, typeValue] of Object.entries(stats)) {
    if (type === 'recent' || typeof typeValue !== 'object' || typeValue === null) continue;
    const typeObj = typeValue as Record<string, unknown>;
    for (const [mode, modeValue] of Object.entries(typeObj)) {
      if (typeof modeValue !== 'object' || modeValue === null) continue;
      const modeObj = modeValue as Record<string, unknown>;
      if (hasBucketShape(modeObj)) {
        addBucket(type, modeObj);
        continue;
      }
      for (const [, bucket] of Object.entries(modeObj)) {
        addBucket(`${type} / ${mode}`, bucket);
      }
    }
  }

  for (const [type, counts] of typeCounts) {
    summary.byType.push({ type, ...counts });
    summary.totalWins += counts.wins;
    summary.totalLosses += counts.losses;
    summary.totalGames += counts.total;
  }
  summary.byType.sort((a, b) => b.total - a.total);
  return summary;
}

function hasBucketShape(obj: Record<string, unknown>): boolean {
  return 'wins' in obj || 'losses' in obj || 'total' in obj;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Embed for `/player <playerId>`. */
export function playerEmbed(player: Player): import('discord.js').EmbedBuilder {
  const summary = aggregatePlayerStats(player);
  const username = nullToText(player.username, player.publicId);
  const embed = baseEmbed(EMBED_COLORS.player, `👤 Player ${username}`);

  embed.addFields(
    { name: '🆔 Player ID', value: player.publicId, inline: true },
    { name: '🗓️ Account Created', value: formatTimestamp(player.createdAt), inline: true },
    {
      name: '🎮 Games Played',
      value: formatNumber(summary.totalGames),
      inline: true,
    },
    {
      name: '✅ Wins',
      value: formatNumber(summary.totalWins),
      inline: true,
    },
    {
      name: '❌ Losses',
      value: formatNumber(summary.totalLosses),
      inline: true,
    },
    {
      name: '📈 Win Rate',
      value: formatPercent(summary.totalWins, summary.totalGames),
      inline: true,
    },
  );

  if (player.clans?.length) {
    const clans = player.clans
      .map((c) => {
        const role = c.role ? ` (${c.role})` : '';
        const name = c.name && c.name !== c.tag ? ` — ${c.name}` : '';
        return `${c.tag ?? '?'}${name}${role}`;
      })
      .join('\n');
    embed.addFields({ name: '🛡️ Clans', value: truncate(clans, 1024) || 'N/A', inline: false });
  }

  if (summary.byType.length) {
    const lines = summary.byType.slice(0, 10).map((entry) => {
      return `${entry.type}: ${formatNumber(entry.wins)}W / ${formatNumber(entry.losses)}L (${formatNumber(entry.total)} games, ${formatPercent(entry.wins, entry.total)} win)`;
    });
    embed.addFields({ name: '📊 Stats by Game Type', value: truncate(lines.join('\n'), 1000) || 'N/A', inline: false });
  }

  return embed;
}

/** Formats a single player game history row for paginated embeds. */
export function playerGameField(game: PlayerGame): { name: string; value: string; inline: boolean } {
  const emoji = gameTypeEmoji(game.type);
  const resultText = game.result ? `${resultEmoji(game.result)} ${game.result}` : '❔ Unknown';
  const name = `${emoji} ${game.gameId} — ${resultText}`;
  const lines: string[] = [];
  if (game.map) lines.push(`**Map:** ${game.map}`);
  const modeLine = [game.mode, game.playerTeams, game.rankedType].filter(Boolean).join(' • ');
  if (modeLine) lines.push(`**Mode:** ${modeLine}`);
  if (game.totalPlayers != null) lines.push(`**Players:** ${formatNumber(game.totalPlayers)}`);
  if (game.username) lines.push(`**Player:** ${game.username}${game.clanTag ? ` [${game.clanTag}]` : ''}`);
  if (game.start) lines.push(`**Start:** ${formatRelativeTimestamp(game.start)}`);
  lines.push(`**Duration:** ${formatDurationSeconds(game.durationSeconds)}`);
  return { name, value: truncate(lines.join('\n')) || 'No data', inline: false };
}

/** Builds a page of `/player-games` results. */
export function playerGamesEmbed(
  response: PlayerGamesResponse,
  page: number,
  label: string,
): import('discord.js').EmbedBuilder {
  const results = response.results;
  const embed = baseEmbed(EMBED_COLORS.player, `🎮 ${label}`)
    .setDescription(
      `Recent games — page **${page + 1}**. Showing ${results.length} result(s).${response.nextCursor ? '' : '  *(no more results)*'}`,
    );
  for (const game of results) {
    embed.addFields(playerGameField(game));
  }
  embed.setColor(resultColor(results[0]?.result));
  return embed;
}

export function chunkPlayerGames(results: PlayerGame[]): PlayerGame[][] {
  return chunk(results, PLAYER_GAMES_PER_PAGE);
}

/** Formats a player session row. */
export function playerSessionField(session: PlayerSession): { name: string; value: string; inline: boolean } {
  const emoji = gameTypeEmoji(session.gameType);
  const result = session.hasWon ? '✅ Won' : '❌ Lost';
  const name = `${emoji} ${session.gameId} — ${result}`;
  const lines: string[] = [];
  const modeLine = [session.gameMode, session.gameRankedType].filter(Boolean).join(' • ');
  if (modeLine) lines.push(`**Mode:** ${modeLine}`);
  if (session.username) lines.push(`**Player:** ${session.username}${session.clanTag ? ` [${session.clanTag}]` : ''}`);
  if (session.gameStart) lines.push(`**Start:** ${formatTimestamp(session.gameStart)}`);
  if (session.gameStart && session.gameEnd) {
    const duration = new Date(session.gameEnd).getTime() - new Date(session.gameStart).getTime();
    if (Number.isFinite(duration) && duration >= 0) {
      lines.push(`**Duration:** ${formatDurationSeconds(Math.round(duration / 1000))}`);
    }
  }
  return { name, value: truncate(lines.join('\n')) || 'No data', inline: false };
}

export function playerSessionsEmbed(sessions: PlayerSession[], page: number, label: string): import('discord.js').EmbedBuilder {
  const pageSessions = sessions.slice(page * PLAYER_SESSIONS_PER_PAGE, (page + 1) * PLAYER_SESSIONS_PER_PAGE);
  const embed = baseEmbed(EMBED_COLORS.player, `🕹️ ${label}`)
    .setDescription(`Sessions ${page * PLAYER_SESSIONS_PER_PAGE + 1}–${Math.min((page + 1) * PLAYER_SESSIONS_PER_PAGE, sessions.length)} of ${sessions.length}.`);
  for (const session of pageSessions) {
    embed.addFields(playerSessionField(session));
  }
  return embed;
}

export function chunkPlayerSessions(sessions: PlayerSession[]): PlayerSession[][] {
  return chunk(sessions, PLAYER_SESSIONS_PER_PAGE);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}