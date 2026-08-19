import type { ChatInputCommandInteraction } from 'discord.js';
import type { APIEmbed } from 'discord.js';
import { errorEmbed } from '../errors.js';
import { clanLeaderboardEmbed, clanLeaderboardPages } from '../embeds/clan.js';
import { Paginator, staticPaginator } from '../pagination.js';
import type { HandlerContext } from './types.js';

export async function handleClanLeaderboard(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
  await interaction.deferReply();

  try {
    const leaderboard = await ctx.client.getClanLeaderboard();
    const clans = leaderboard.clans ?? [];

    if (clans.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed(new Error('The leaderboard is currently empty.')).toJSON()] });
      return;
    }

    const rawPages = clanLeaderboardPages(clans);
    const totalPages = rawPages.length;
    const pages: APIEmbed[][] = rawPages.map((page, index) => [
      clanLeaderboardEmbed(page, index, totalPages).toJSON(),
    ]);

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