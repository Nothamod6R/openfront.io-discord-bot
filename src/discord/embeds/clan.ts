import type {
  Clan,
  ClanLeaderboardEntry,
  ClanResponse,
  ClanSession,
  ClanSessionsResponse,
} from '../../models/types.js';
import {
  EMBED_COLORS,
  baseEmbed,
  formatNumber,
  formatPercent,
  formatRatio,
  formatTimestamp,
  formatRelativeTimestamp,
  truncate,
} from './formatting.js';

const LEADERBOARD_PER_PAGE = 10;

/** Embed for `/clan <clanTag>`. */
export function clanEmbed(response: ClanResponse): import('discord.js').EmbedBuilder {
  const clan: Clan = response.clan ?? {};
  const embed = baseEmbed(EMBED_COLORS.clan, `🛡️ Clan ${clan.clanTag ?? 'Unknown'}`);
  if (response.start && response.end) {
    embed.setDescription(`Statistics for **${formatTimestamp(response.start)}** → **${formatTimestamp(response.end)}**.`);
  }

  const games = clan.games ?? 0;
  const wins = clan.wins ?? 0;
  const losses = clan.losses ?? 0;

  embed.addFields(
    { name: '🎮 Total Games', value: formatNumber(games), inline: true },
    { name: '✅ Wins', value: formatNumber(wins), inline: true },
    { name: '❌ Losses', value: formatNumber(losses), inline: true },
    { name: '📈 Win Rate', value: formatPercent(wins, games), inline: true },
    { name: '⚖️ W/L Ratio', value: formatRatio(wins, losses), inline: true },
    { name: '👥 Player Sessions', value: formatNumber(clan.playerSessions), inline: true },
  );

  const weighted = [
    `Weighted Wins: **${formatNumber(clan.weightedWins)}**`,
    `Weighted Losses: **${formatNumber(clan.weightedLosses)}**`,
    `Weighted W/L Ratio: **${formatNumber(clan.weightedWLRatio)}**`,
  ].join('\n');
  embed.addFields({ name: '⚖️ Weighted Stats', value: weighted, inline: false });

  const teamType = topBreakdown(clan.teamTypeWL, 8);
  if (teamType) {
    embed.addFields({ name: '👥 By Team Type', value: teamType, inline: false });
  }
  const teamCount = topBreakdown(clan.teamCountWL, 8);
  if (teamCount) {
    embed.addFields({ name: '🔢 By Team Count', value: teamCount, inline: false });
  }

  return embed;
}

function topBreakdown(
  breakdown: Record<string, { wl?: [number | string, number | string]; weightedWL?: [number | string, number | string] } | undefined> | undefined,
  max: number,
): string {
  if (!breakdown) return '';
  const entries = Object.entries(breakdown)
    .map(([key, value]) => {
      const wl = value?.wl ?? [0, 0];
      const weightedWL = value?.weightedWL ?? [0, 0];
      return { key, wins: toNumber(wl[0]), losses: toNumber(wl[1]), weightedWins: toNumber(weightedWL[0]), weightedLosses: toNumber(weightedWL[1]) };
    })
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
    .slice(0, max);
  if (!entries.length) return '';
  return entries
    .map((e) => {
      const winRate = formatPercent(e.wins, e.wins + e.losses);
      return `${e.key}: ${formatNumber(e.wins)}W / ${formatNumber(e.losses)}L (${winRate} win)`;
    })
    .join('\n');
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Formats a clan session row. */
export function clanSessionField(session: ClanSession): { name: string; value: string; inline: boolean } {
  const result = session.hasWon ? '✅ Won' : '❌ Lost';
  const name = `${session.gameId} — ${result}`;
  const lines: string[] = [];
  if (session.gameStart) lines.push(`**Start:** ${formatRelativeTimestamp(session.gameStart)}`);
  lines.push(
    `**Teams:** ${formatNumber(session.numTeams)}${session.playerTeams ? ` (${session.playerTeams})` : ''} • **Players:** ${formatNumber(session.totalPlayerCount)}`,
  );
  if (session.clanPlayerCount != null) lines.push(`**Clan members in game:** ${formatNumber(session.clanPlayerCount)}`);
  if (session.score != null) lines.push(`**Score:** ${session.score}`);
  return { name, value: truncate(lines.join('\n')) || 'No data', inline: false };
}

/** Embed for `/clan-sessions <clanTag>`. */
export function clanSessionsEmbed(response: ClanSessionsResponse, page: number): import('discord.js').EmbedBuilder {
  const results = response.results ?? [];
  const total = response.total ?? 0;
  const embed = baseEmbed(EMBED_COLORS.clan, `🕹️ Clan ${response.results[0]?.clanTag ?? 'Unknown'} Sessions`)
    .setDescription(
      `Page **${page + 1}** of ${Math.max(1, Math.ceil(total / (response.limit || 1)))} — showing ${results.length} of ${formatNumber(total)} sessions.`,
    );
  for (const session of results) {
    embed.addFields(clanSessionField(session));
  }
  return embed;
}

/** Embed for a page of the `/clan-leaderboard`. */
export function clanLeaderboardEmbed(clans: ClanLeaderboardEntry[], page: number, totalPages: number): import('discord.js').EmbedBuilder {
  const embed = baseEmbed(EMBED_COLORS.clan, '🏆 Top Clans by Weighted Wins')
    .setDescription(
      `Ranked ${page * LEADERBOARD_PER_PAGE + 1}–${Math.min((page + 1) * LEADERBOARD_PER_PAGE, clans.length)} of the top ${LEADERBOARD_PER_PAGE * totalPages}.`,
    );
  clans.forEach((clan, index) => {
    const rank = page * LEADERBOARD_PER_PAGE + index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
    embed.addFields({
      name: `${medal} ${clan.clanTag}`,
      value: truncate(
        [
          `Games: **${formatNumber(clan.games)}** (${formatNumber(clan.wins)}W / ${formatNumber(clan.losses)}L)`,
          `Win Rate: **${formatPercent(clan.wins, clan.games)}**`,
          `Weighted: **${formatNumber(clan.weightedWins)}**W / **${formatNumber(clan.weightedLosses)}**L (ratio ${formatNumber(clan.weightedWLRatio)})`,
          `Player Sessions: **${formatNumber(clan.playerSessions)}**`,
        ].join('\n'),
      ),
      inline: false,
    });
  });
  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${page + 1}/${totalPages} • OpenFront API` });
  } else {
    embed.setFooter({ text: 'OpenFront API' });
  }
  return embed;
}

export function clanLeaderboardPages(clans: ClanLeaderboardEntry[]): ClanLeaderboardEntry[][] {
  const pages: ClanLeaderboardEntry[][] = [];
  for (let i = 0; i < clans.length; i += LEADERBOARD_PER_PAGE) {
    pages.push(clans.slice(i, i + LEADERBOARD_PER_PAGE));
  }
  return pages;
}

export function clanSessionsTotalPages(response: ClanSessionsResponse): number {
  const limit = response.limit || 1;
  return Math.max(1, Math.ceil(response.total / limit));
}