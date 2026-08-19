import type { ChatInputCommandInteraction } from 'discord.js';
import type { ClanSessionsResponse } from '../../models/types.js';
import { assertClanTag } from '../../openfront/validation.js';
import { errorEmbed } from '../errors.js';
import { clanSessionsEmbed } from '../embeds/clan.js';
import { Paginator } from '../pagination.js';
import type { HandlerContext } from './types.js';
import { last24hWindow } from './types.js';

const MAX_PAGES = 50;

export async function handleClanSessions(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
  const raw = interaction.options.getString('clan_tag', true);

  let clanTag: string;
  try {
    clanTag = assertClanTag(raw);
  } catch (err) {
    await interaction.reply({ embeds: [errorEmbed(err).toJSON()], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const { start, end } = last24hWindow();
    const pageData: Array<ClanSessionsResponse | undefined> = [];

    const paginator = new Paginator({
      userId: interaction.user.id,
      loader: async (index: number) => {
        if (index < 0 || index >= MAX_PAGES) return null;
        if (!pageData[index]) {
          pageData[index] = await ctx.client.getClanSessions(clanTag, {
            start,
            end,
            page: index + 1,
            limit: 20,
          });
        }
        const data = pageData[index];
        if (!data) return null;
        const totalPages = Math.max(1, Math.ceil(data.total / (data.limit || 1)));
        return {
          embeds: [clanSessionsEmbed(data, index).toJSON()],
          canGoNext: index + 1 < Math.min(totalPages, MAX_PAGES),
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