import { describe, expect, it } from 'vitest';
import { Colors } from 'discord.js';
import { clanEmbed, clanLeaderboardEmbed, clanSessionsEmbed } from '../src/discord/embeds/clan.js';
import {
  formatBool,
  formatDuration,
  formatPercent,
  formatRatio,
  formatTimestamp,
  nullToText,
  resultColor,
  resultEmoji,
  truncate,
} from '../src/discord/embeds/formatting.js';
import { gameDetailEmbed, gameListEmbed, gameSummaryField } from '../src/discord/embeds/game.js';
import {
  aggregatePlayerStats,
  playerEmbed,
  playerGameField,
  playerGamesEmbed,
  playerSessionsEmbed,
} from '../src/discord/embeds/player.js';
import type {
  ClanSessionsResponse,
  GameDetail,
  Player,
  PlayerGame,
  PlayerGamesResponse,
  PlayerSession,
} from '../src/models/types.js';
import { loadFixture } from './helpers.js';

describe('formatting helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(3_661_000)).toBe('1h 1m 1s');
    expect(formatDuration(-5)).toBe('N/A');
    expect(formatDuration(Number.NaN)).toBe('N/A');
  });

  it('formats percentages and ratios', () => {
    expect(formatPercent(10, 20)).toBe('50.0%');
    expect(formatPercent(0, 0)).toBe('N/A');
    expect(formatRatio(10, 2)).toBe('5.00');
    expect(formatRatio(1, 0)).toBe('N/A');
  });

  it('formats timestamps', () => {
    expect(formatTimestamp('2026-08-18T00:00:00.000Z')).toContain('<t:');
    expect(formatTimestamp(null)).toBe('N/A');
    expect(formatTimestamp('garbage')).toBe('N/A');
  });

  it('handles null and booleans', () => {
    expect(nullToText(null)).toBe('Unknown');
    expect(nullToText('x')).toBe('x');
    expect(formatBool(true)).toBe('Yes');
    expect(formatBool(false)).toBe('No');
    expect(formatBool(null)).toBe('N/A');
  });

  it('maps results to colors and emojis', () => {
    expect(resultEmoji('victory')).toBe('✅');
    expect(resultEmoji('defeat')).toBe('❌');
    expect(resultEmoji('incomplete')).toBe('⏸️');
    expect(resultColor('victory')).toBe(Colors.Green);
    expect(resultColor('defeat')).toBe(Colors.Red);
    expect(resultColor(null)).toBe(Colors.Grey);
  });

  it('truncates long strings', () => {
    expect(truncate('a'.repeat(2000), 10)).toHaveLength(10);
    expect(truncate('short')).toBe('short');
  });
});

describe('game embeds', () => {
  it('renders a game detail embed from a real fixture', () => {
    const game = loadFixture('game-detail.json') as GameDetail;
    const embed = gameDetailEmbed(game);
    const json = embed.toJSON();
    expect(json.title).toContain(game.info.gameID);
    const fields = json.fields ?? [];
    const fieldNames = fields.map((f) => f.name);
    expect(fieldNames).toContain('🗺️ Map');
    expect(fieldNames).toContain('📋 Type / Mode');
    expect(fieldNames).toContain('👥 Players');
    expect(fieldNames).toContain('⏱️ Duration');
  });

  it('renders a game list embed with game fields', () => {
    const games = (loadFixture('games-list.json') as unknown[]) as Parameters<typeof gameSummaryField>[0][];
    const embed = gameListEmbed(games.slice(0, 6), 0, 3);
    expect((embed.toJSON().fields ?? []).length).toBeGreaterThan(0);
  });

  it('handles missing optional fields gracefully', () => {
    const sparse = gameDetailEmbed({
      info: { gameID: 'abc', config: { gameType: 'Public' }, players: [] },
    });
    expect(sparse.toJSON().title).toContain('abc');
  });
});

describe('player embeds', () => {
  it('aggregates player stats from a real fixture', () => {
    const player = loadFixture('player.json') as Player;
    const summary = aggregatePlayerStats(player);
    expect(summary.totalGames).toBeGreaterThan(0);
    expect(summary.totalWins + summary.totalLosses).toBe(summary.totalGames);
    expect(summary.byType.length).toBeGreaterThan(0);
  });

  it('renders a player embed', () => {
    const player = loadFixture('player.json') as Player;
    const embed = playerEmbed(player).toJSON();
    const fieldNames = (embed.fields ?? []).map((f) => f.name);
    expect(embed.title).toContain('evan');
    expect(fieldNames).toContain('🎮 Games Played');
    expect(fieldNames).toContain('✅ Wins');
    expect(fieldNames).toContain('📈 Win Rate');
  });

  it('formats a player game row with result emoji', () => {
    const game: PlayerGame = {
      gameId: 'abc123',
      start: '2026-05-17T21:04:00.000Z',
      durationSeconds: 1234,
      map: 'World',
      mode: 'Team',
      type: 'Public',
      playerTeams: 'Duos',
      rankedType: 'unranked',
      result: 'victory',
      totalPlayers: 8,
      username: 'alice',
      clanTag: 'ABC',
    };
    const field = playerGameField(game);
    expect(field.name).toContain('✅');
    expect(field.value).toContain('World');
    expect(field.value).toContain('[ABC]');
  });

  it('renders player-games embed from a real fixture', () => {
    const response = loadFixture('player-games.json') as PlayerGamesResponse;
    const embed = playerGamesEmbed(response, 0, 'Game History').toJSON();
    expect((embed.fields ?? []).length).toBeGreaterThan(0);
  });

  it('renders player sessions embed', () => {
    const sessions = (loadFixture('player-sessions.json') as PlayerSession[]).slice(0, 12);
    const embed = playerSessionsEmbed(sessions, 0, 'Sessions').toJSON();
    expect((embed.fields ?? []).length).toBe(8);
  });
});

describe('clan embeds', () => {
  it('renders a clan embed from a real fixture', () => {
    const response = loadFixture('clan.json') as import('../src/models/types.js').ClanResponse;
    const embed = clanEmbed(response).toJSON();
    const fieldNames = (embed.fields ?? []).map((f) => f.name);
    expect(fieldNames).toContain('🎮 Total Games');
    expect(fieldNames).toContain('⚖️ Weighted Stats');
    expect(fieldNames).toContain('👥 By Team Type');
    expect(fieldNames).toContain('🔢 By Team Count');
  });

  it('handles a clan response missing optional breakdowns', () => {
    const embed = clanEmbed({ clan: { clanTag: 'XX' } }).toJSON();
    expect(embed.title).toContain('XX');
  });

  it('renders clan sessions embed from a real fixture', () => {
    const response = loadFixture('clan-sessions.json') as ClanSessionsResponse;
    const embed = clanSessionsEmbed(response, 0).toJSON();
    expect((embed.fields ?? []).length).toBeGreaterThan(0);
    expect(embed.title).toContain('UN');
  });

  it('renders leaderboard pages with ranks', () => {
    const leaderboard = loadFixture('clans-leaderboard.json') as { clans: import('../src/models/types.js').ClanLeaderboardEntry[] };
    const embed = clanLeaderboardEmbed(leaderboard.clans.slice(0, 10), 0, 7).toJSON();
    const fields = embed.fields ?? [];
    expect(fields.length).toBe(10);
    expect(fields[0]?.name).toContain('🥇');
  });
});