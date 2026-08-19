import { Colors, EmbedBuilder, type APIEmbed, type ColorResolvable } from 'discord.js';

export const EMBED_COLORS = {
  game: Colors.Blurple,
  player: Colors.Green,
  clan: Colors.Purple,
  victory: Colors.Green,
  defeat: Colors.Red,
  incomplete: Colors.Grey,
  error: Colors.Red,
  warning: Colors.Orange,
  info: Colors.Blue,
} as const;

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'N/A';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Formats a duration in seconds (as returned by some endpoints). */
export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'N/A';
  return formatDuration(seconds * 1000);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  return value.toLocaleString('en-US');
}

export function formatRatio(numerator: number, denominator: number): string {
  if (denominator <= 0) return 'N/A';
  return (numerator / denominator).toFixed(2);
}

export function formatPercent(wins: number, total: number): string {
  if (total <= 0) return 'N/A';
  return `${((wins / total) * 100).toFixed(1)}%`;
}

export function formatTimestamp(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return 'N/A';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return `<t:${Math.floor(date.getTime() / 1000)}:f>`;
}

export function formatRelativeTimestamp(iso: string | number | null | undefined): string {
  if (iso === null || iso === undefined) return 'N/A';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

export function formatBool(value: boolean | null | undefined, truthy = 'Yes', falsy = 'No'): string {
  if (value === null || value === undefined) return 'N/A';
  return value ? truthy : falsy;
}

export function nullToText(value: unknown, fallback = 'Unknown'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

export function resultEmoji(result: string | null | undefined): string {
  switch (result) {
    case 'victory':
      return '✅';
    case 'defeat':
      return '❌';
    case 'incomplete':
      return '⏸️';
    default:
      return '❔';
  }
}

export function resultColor(result: string | null | undefined): ColorResolvable {
  switch (result) {
    case 'victory':
      return EMBED_COLORS.victory;
    case 'defeat':
      return EMBED_COLORS.defeat;
    default:
      return EMBED_COLORS.incomplete;
  }
}

export function gameTypeEmoji(type: string | null | undefined): string {
  switch (type) {
    case 'Public':
      return '🌍';
    case 'Private':
      return '🔒';
    case 'Singleplayer':
      return '🤖';
    default:
      return '';
  }
}

export function truncate(value: string, max = 1024): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/** Builds a base embed with common footer/timestamp. */
export function baseEmbed(color: ColorResolvable, title: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setFooter({ text: 'OpenFront API' })
    .setTimestamp();
}

/** Converts an EmbedBuilder to a plain embed descriptor with a footer timestamp. */
export function toEmbedData(embed: EmbedBuilder): APIEmbed {
  return embed.toJSON();
}