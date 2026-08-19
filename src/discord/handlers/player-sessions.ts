import type { ChatInputCommandInteraction } from 'discord.js';
import type { APIEmbed } from 'discord.js';
import { assertPlayerId } from '../../openfront/validation.js';
import { errorEmbed } from '../errors.js';
import { playerSessionsEmbed, PLAYER_SESSIONS_PER_PAGE } from '../embeds/player.js';
import { Paginator, staticPaginator } from '../pagination.js';
import type { HandlerContext } from './types.js';

export async function handlePlayerSessions(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
  const raw = interaction.options.getString('player_id', true);

  let playerId: string;
  try {
    playerId = assertPlayerId(raw);
  } catch (err) {
    await interaction.reply({ embeds: [errorEmbed(err).toJSON()], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const sessions = await ctx.client.getPlayerSessions(playerId);

    if (sessions.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed(new Error('No sessions found for this player.')).toJSON()] });
      return;
    }

    const label = `Sessions — ${playerId}`;
    const totalPages = Math.max(1, Math.ceil(sessions.length / PLAYER_SESSIONS_PER_PAGE));
    const pages: APIEmbed[][] = Array.from({ length: totalPages }, (_, index) => [
      playerSessionsEmbed(sessions, index, label).toJSON(),
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