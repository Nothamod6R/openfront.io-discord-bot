import type { ChatInputCommandInteraction } from 'discord.js';
import { assertGameId } from '../../openfront/validation.js';
import { errorEmbed } from '../errors.js';
import { gameDetailEmbed } from '../embeds/game.js';
import type { HandlerContext } from './types.js';

export async function handleGame(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
  const raw = interaction.options.getString('game_id', true);

  let gameId: string;
  try {
    gameId = assertGameId(raw);
  } catch (err) {
    await interaction.reply({ embeds: [errorEmbed(err).toJSON()], ephemeral: true });
    return;
  }

  await interaction.deferReply();
  try {
    const detail = await ctx.client.getGame(gameId);
    const embed = gameDetailEmbed(detail);
    await interaction.editReply({ embeds: [embed.toJSON()] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed(err).toJSON()] });
  }
}