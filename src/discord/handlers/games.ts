import type { ChatInputCommandInteraction } from 'discord.js';
import type { APIEmbed } from 'discord.js';
import type { GameSummary, GameType, RankedType } from '../../models/types.js';
import { ValidationError } from '../../openfront/errors.js';
import { errorEmbed } from '../errors.js';
import { GAME_PER_PAGE, gameListEmbed } from '../embeds/game.js';
import { Paginator, staticPaginator } from '../pagination.js';
import type { HandlerContext } from './types.js';

export async function handleGames(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
  const rangeHours = interaction.options.getInteger('range') ?? 24;
  const type = interaction.options.getString('type') as GameType | null;
  const mode = interaction.options.getString('mode') ?? undefined;
  const rankedType = interaction.options.getString('ranked_type') as RankedType | null;
  const playerTeams = interaction.options.getString('player_teams');
  const limit = interaction.options.getInteger('limit') ?? 30;

  if (rangeHours < 1 || rangeHours > 24) {
    await interaction.reply({ embeds: [errorEmbed(new ValidationError('Time range must be between 1 and 24 hours.')).toJSON()], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const end = new Date();
    const start = new Date(end.getTime() - rangeHours * 3_600_000);

    const { games, contentRange } = await ctx.client.getGames({
      start: start.toISOString(),
      end: end.toISOString(),
      type: type ?? undefined,
      mode,
      rankedType: rankedType ?? undefined,
      playerTeams: playerTeams || undefined,
      limit,
    });

    if (games.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed(new ValidationError('No games found for the given filters.')).toJSON()] });
      return;
    }

    const pages = paginateGames(games, contentRange?.total ?? null);
    const paginator = new Paginator({
      userId: interaction.user.id,
      loader: staticPaginator(pages),
    });
    const payload = await paginator.buildPayload();
    await interaction.editReply(payload);
    ctx.paginators.register(paginator);
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed(err).toJSON()] });
  }
}

/**
 * Builds embed pages from a single fetched slice of games, paginating only
 * over the slice. `apiTotal` (from Content-Range) is surfaced as context.
 */
function paginateGames(games: GameSummary[], apiTotal: number | null): APIEmbed[][] {
  const pages: APIEmbed[][] = [];
  const totalPages = Math.max(1, Math.ceil(games.length / GAME_PER_PAGE));
  for (let i = 0; i < games.length; i += GAME_PER_PAGE) {
    pages.push([gameListEmbed(games.slice(i, i + GAME_PER_PAGE), Math.floor(i / GAME_PER_PAGE), totalPages, apiTotal).toJSON()]);
  }
  return pages;
}