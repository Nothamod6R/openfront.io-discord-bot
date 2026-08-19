import { loadConfig } from '../src/config.js';
import { buildClient } from '../src/openfront/index.js';

const config = loadConfig();
const client = buildClient(config);

const end = new Date();
const start = new Date(end.getTime() - 3600_000);

try {
  const games = await client.getGames({ start: start.toISOString(), end: end.toISOString(), limit: 3 });
  console.log('games:', games.games.length, 'contentRange:', games.contentRange);

  const game = await client.getGame('mHZKwntW');
  console.log('game:', game.info.gameID, game.info.config.gameMap);

  const player = await client.getPlayer('HabCsQYR');
  console.log('player:', player.publicId, player.username);

  const pg = await client.getPlayerGames('HabCsQYR', { filter: 'team', type: 'public' });
  console.log('player-games:', pg.results.length, 'nextCursor:', pg.nextCursor ? 'yes' : 'no');

  const ps = await client.getPlayerSessions('HabCsQYR');
  console.log('player-sessions:', ps.length);

  const clan = await client.getClan('UN', { start: start.toISOString(), end: end.toISOString() });
  console.log('clan:', clan.clan.clanTag, 'games:', clan.clan.games);

  const cs = await client.getClanSessions('UN', { start: start.toISOString(), end: end.toISOString(), page: 1, limit: 5 });
  console.log('clan-sessions:', cs.results.length, 'total:', cs.total);

  const lb = await client.getClanLeaderboard();
  console.log('leaderboard:', lb.clans.length, 'top:', lb.clans[0]?.clanTag);

  // Cache verification: second getGame should not hit the network (logged via fetch count is hard here, but result should be identical)
  const game2 = await client.getGame('mHZKwntW');
  console.log('cached game matches:', game2.info.gameID === game.info.gameID);
} catch (err) {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
}