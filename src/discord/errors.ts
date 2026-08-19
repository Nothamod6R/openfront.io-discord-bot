import { EmbedBuilder } from 'discord.js';
import type { OpenFrontError } from '../openfront/errors.js';
import { EMBED_COLORS } from './embeds/formatting.js';

/**
 * Maps typed OpenFront errors to user-friendly ephemeral embeds.
 * Never surfaces stack traces.
 */
export function errorEmbed(err: unknown): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLORS.error)
    .setTitle('⚠️ Request Failed')
    .setTimestamp();

  if (isOpenFrontError(err)) {
    switch (err.kind) {
      case 'notFound':
        embed.setTitle('🔍 Not Found');
        embed.setDescription('The requested game, player or clan does not exist (or is not public).');
        return embed;
      case 'validation':
        embed.setTitle('❌ Invalid Input');
        embed.setDescription(err.message);
        return embed;
      case 'rateLimited':
      case 'retriesExhausted':
        embed.setTitle('⏳ API Rate Limit');
        embed.setDescription(
          err.retryAfterMs !== undefined
            ? `The OpenFront API is rate-limiting requests. Please try again in ~${Math.ceil(err.retryAfterMs / 1000)} seconds.`
            : 'The OpenFront API is rate-limiting requests. Please wait a moment and try again.',
        );
        return embed;
      case 'serverError':
        embed.setTitle('🔧 Temporary API Failure');
        embed.setDescription(`The OpenFront API returned a server error. Please try again shortly.`);
        return embed;
      case 'timeout':
        embed.setTitle('⏰ Request Timed Out');
        embed.setDescription('The OpenFront API did not respond in time. Please try again.');
        return embed;
      case 'network':
        embed.setTitle('📡 Network Error');
        embed.setDescription('Could not reach the OpenFront API. Please try again.');
        return embed;
      case 'malformed':
        embed.setTitle('📄 Invalid Response');
        embed.setDescription('The OpenFront API returned a response we could not understand. Please try again.');
        return embed;
    }
  }

  embed.setTitle('❌ Unexpected Error');
  embed.setDescription('Something went wrong while handling your request.');
  return embed;
}

function isOpenFrontError(err: unknown): err is OpenFrontError {
  return typeof err === 'object' && err !== null && 'kind' in err;
}

/** Short fallback text used when an embed cannot be produced. */
export function errorFallbackText(): string {
  return 'Something went wrong. Please try again shortly.';
}