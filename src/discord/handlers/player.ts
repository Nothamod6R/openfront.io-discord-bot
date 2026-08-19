import type { ChatInputCommandInteraction } from 'discord.js';
import { assertPlayerId } from '../../openfront/validation.js';
import { errorEmbed } from '../errors.js';
import { playerEmbed } from '../embeds/player.js';
import type { HandlerContext } from './types.js';

export async function handlePlayer(interaction: ChatInputCommandInteraction, ctx: HandlerContext): Promise<void> {
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
    const player = await ctx.client.getPlayer(playerId);
    const embed = playerEmbed(player);
    await interaction.editReply({ embeds: [embed.toJSON()] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed(err).toJSON()] });
  }
}