import type { ChatInputCommandInteraction } from 'discord.js';
import type { PlayerGamesFilter, PlayerGamesResponse, PlayerGamesType } from '../../models/types.js';
import { assertPlayerId } from '../../openfront/validation.js';
import { errorEmbed } from '../errors.js';
import { playerGamesEmbed } from '../embeds/player.js';
import { Paginator } from '../pagination.js';
import type { HandlerContext } from './types.js';

const MAX_PAGES = 20;

export async function handlePlayerGames(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
  const raw = interaction.options.getString('player_id', true);
  const filter = interaction.options.getString('filter') as PlayerGamesFilter | null;
  const type = interaction.options.getString('type') as PlayerGamesType | null;

  let playerId: string;
  try {
    playerId = assertPlayerId(raw);
  } catch (err) {
    await interaction.reply({ embeds: [errorEmbed(err).toJSON()], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const label = `Game History — ${playerId}${filter ? ` (${filter})` : ''}${type ? ` (${type})` : ''}`;
    const pageData: Array<PlayerGamesResponse | undefined> = [];

    const paginator = new Paginator({
      userId: interaction.user.id,
      loader: async (index: number) => {
        if (index < 0) return null;
        if (!pageData[index]) {
          if (index === 0) {
            pageData[0] = await ctx.client.getPlayerGames(playerId, {
              filter: filter ?? undefined,
              type: type ?? undefined,
            });
          } else {
            const prev = pageData[index - 1];
            if (!prev || !prev.nextCursor || index >= MAX_PAGES) return null;
            pageData[index] = await ctx.client.getPlayerGames(playerId, {
              filter: filter ?? undefined,
              type: type ?? undefined,
              cursor: prev.nextCursor,
            });
          }
        }
        const data = pageData[index];
        if (!data) return null;
        return {
          embeds: [playerGamesEmbed(data, index, label).toJSON()],
          canGoNext: data.nextCursor != null && index + 1 < MAX_PAGES,
          canGoPrev: index > 0,
        };
      },
    });

    const payload = await paginator.buildPayload();
    await interaction.editReply(payload);
    ctx.paginators.register(paginator);
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed(err).toJSON()] });
  }
}