import type { ChatInputCommandInteraction } from 'discord.js';
import { assertClanTag } from '../../openfront/validation.js';
import { errorEmbed } from '../errors.js';
import { clanEmbed } from '../embeds/clan.js';
import type { HandlerContext } from './types.js';
import { last24hWindow } from './types.js';

export async function handleClan(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
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
    const response = await ctx.client.getClan(clanTag, { start, end });
    const embed = clanEmbed(response);
    await interaction.editReply({ embeds: [embed.toJSON()] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed(err).toJSON()] });
  }
}