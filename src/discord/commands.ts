import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export type CommandDef = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;

export const COMMANDS: CommandDef[] = [
  new SlashCommandBuilder()
    .setName('game')
    .setDescription('Show detailed information about a specific OpenFront game.')
    .addStringOption((opt) => opt.setName('game_id').setDescription('The OpenFront game ID.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('games')
    .setDescription('Search recent OpenFront games.')
    .addIntegerOption((opt) =>
      opt
        .setName('range')
        .setDescription('How far back to search (default 24h).')
        .setRequired(false)
        .addChoices(
          { name: '1 hour', value: 1 },
          { name: '6 hours', value: 6 },
          { name: '12 hours', value: 12 },
          { name: '24 hours', value: 24 },
        ),
    )
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Game type filter.')
        .setRequired(false)
        .addChoices(
          { name: 'Private', value: 'Private' },
          { name: 'Public', value: 'Public' },
          { name: 'Singleplayer', value: 'Singleplayer' },
        ),
    )
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Game mode filter.')
        .setRequired(false)
        .addChoices({ name: 'Free For All', value: 'Free For All' }, { name: 'Team', value: 'Team' }),
    )
    .addStringOption((opt) =>
      opt
        .setName('ranked_type')
        .setDescription('Ranked type filter.')
        .setRequired(false)
        .addChoices(
          { name: 'Unranked', value: 'unranked' },
          { name: '1v1', value: '1v1' },
          { name: '2v2', value: '2v2' },
        ),
    )
    .addStringOption((opt) => opt.setName('player_teams').setDescription('Player team configuration (e.g. Duos).').setRequired(false))
    .addIntegerOption((opt) =>
      opt.setName('limit').setDescription('Maximum results to fetch (1–60, default 30).').setRequired(false).setMinValue(1).setMaxValue(60),
    ),

  new SlashCommandBuilder()
    .setName('player')
    .setDescription('Display information and stats for an OpenFront player.')
    .addStringOption((opt) => opt.setName('player_id').setDescription('The OpenFront player ID.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('player-games')
    .setDescription("Display a player's recent game history.")
    .addStringOption((opt) => opt.setName('player_id').setDescription('The OpenFront player ID.').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('filter')
        .setDescription('Mode bucket filter.')
        .setRequired(false)
        .addChoices(
          { name: 'FFA', value: 'ffa' },
          { name: 'Team', value: 'team' },
          { name: 'HVN', value: 'hvn' },
          { name: 'Ranked', value: 'ranked' },
        ),
    )
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Game type filter.')
        .setRequired(false)
        .addChoices(
          { name: 'Public', value: 'public' },
          { name: 'Private', value: 'private' },
          { name: 'Singleplayer', value: 'singleplayer' },
        ),
    ),

  new SlashCommandBuilder()
    .setName('player-sessions')
    .setDescription("Display a player's game sessions.")
    .addStringOption((opt) => opt.setName('player_id').setDescription('The OpenFront player ID.').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Display statistics for an OpenFront clan (last 24h).')
    .addStringOption((opt) => opt.setName('clan_tag').setDescription('The clan tag (e.g. UN).').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clan-sessions')
    .setDescription('Display recent sessions for an OpenFront clan (last 24h).')
    .addStringOption((opt) => opt.setName('clan_tag').setDescription('The clan tag (e.g. UN).').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clan-leaderboard')
    .setDescription('Display the top clans by weighted wins.'),
];