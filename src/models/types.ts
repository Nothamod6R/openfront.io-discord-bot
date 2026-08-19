/**
 * API models for the official OpenFront public API.
 *
 * Types are intentionally loose around fields the API may return as `null`
 * or omit entirely — always treat optional/union-null fields defensively.
 */

export type GameType = 'Private' | 'Public' | 'Singleplayer';
export type GameMode = 'Free For All' | 'Team' | 'Humans Vs Nations';
export type RankedType = 'unranked' | '1v1' | '2v2';
export type PlayerGamesFilter = 'ffa' | 'team' | 'hvn' | 'ranked';
export type PlayerGamesType = 'public' | 'private' | 'singleplayer';
export type GameResult = 'victory' | 'defeat' | 'incomplete';

/** One entry in `GET /games`. */
export interface GameSummary {
  game: string;
  start: string;
  end: string;
  type: GameType;
  mode: string;
  difficulty: string | null;
  numPlayers: number | null;
  maxPlayers: number | null;
  lobbyFillTime: number | null;
  playerTeams: string | null;
  rankedType: RankedType | null;
}

/** Player entry inside `GET /game/:gameId`. */
export interface GamePlayer {
  clientID: string;
  username: string;
  clanTag: string | null;
  isLobbyCreator?: boolean;
  persistentID?: string | null;
  cosmetics?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}

export interface GameConfig {
  gameMap?: string;
  difficulty?: string;
  gameType?: string;
  gameMode?: string;
  gameMapSize?: string;
  bots?: number | null;
  maxPlayers?: number | null;
  playerTeams?: string | number | null;
  infiniteGold?: boolean;
  infiniteTroops?: boolean;
  instantBuild?: boolean;
  randomSpawn?: boolean;
  disableNPCs?: boolean;
  donateGold?: boolean;
  donateTroops?: boolean;
  spawnImmunityDuration?: number | null;
  disabledUnits?: string[] | null;
  publicGameModifiers?: string[] | null;
  nations?: unknown;
}

export interface GameInfo {
  gameID: string;
  config: GameConfig;
  players: GamePlayer[];
  lobbyCreatedAt?: number | null;
  visibleAt?: number | null;
  start?: number | null;
  end?: number | null;
  duration?: number | null;
  num_turns?: number | null;
  winner?: string[] | null;
  lobbyFillTime?: number | null;
  tribes?: Array<{ name?: string }> | null;
}

/** Response of `GET /game/:gameId` with `turns=false`. */
export interface GameDetail {
  version?: string;
  gitCommit?: string;
  domain?: string;
  subdomain?: string;
  info: GameInfo;
}

/** A per-difficulty stat bucket inside `GET /player/:playerId`. */
export interface PlayerStatBucket {
  wins?: string | number;
  losses?: string | number;
  total?: string | number;
  stats?: Record<string, unknown>;
}

export type PlayerStats = Record<string, unknown>;

/** Response of `GET /player/:playerId`. */
export interface Player {
  publicId: string;
  createdAt?: string;
  username?: string;
  stats?: PlayerStats;
  clans?: Array<{
    tag?: string;
    name?: string;
    role?: string;
    joinedAt?: string;
    memberCount?: number;
  }>;
}

/** One entry in `GET /player/:playerId/games`. */
export interface PlayerGame {
  gameId: string;
  start: string;
  durationSeconds: number | null;
  map: string | null;
  mode: string | null;
  type: string | null;
  playerTeams: string | null;
  rankedType: RankedType | null;
  result: GameResult | null;
  totalPlayers: number | null;
  username: string | null;
  clanTag: string | null;
}

/** Response of `GET /player/:playerId/games`. */
export interface PlayerGamesResponse {
  results: PlayerGame[];
  nextCursor: string | null;
}

/** One entry in `GET /player/:playerId/sessions`. */
export interface PlayerSession {
  gameId: string;
  gameStart: string;
  gameEnd: string;
  gameType: string | null;
  gameMode: string | null;
  gameRankedType: RankedType | null;
  clientId: string | null;
  username: string | null;
  clanTag: string | null;
  hasWon: boolean;
}

/** One clan on `GET /clans/leaderboard`. */
export interface ClanLeaderboardEntry {
  clanTag: string;
  games: number;
  wins: number;
  losses: number;
  playerSessions: number;
  weightedWins: number;
  weightedLosses: number;
  weightedWLRatio: number;
}

/** Response of `GET /clans/leaderboard`. */
export interface ClanLeaderboard {
  start?: string;
  end?: string;
  clans: ClanLeaderboardEntry[];
}

/** Win/loss pair keyed by team size label. */
export interface ClanBreakdown {
  [key: string]:
    | {
        wl?: [number | string, number | string];
        weightedWL?: [number | string, number | string];
      }
    | undefined;
}

/** Response of `GET /clan/:clanTag`. */
export interface Clan {
  clanTag: string;
  games?: number | null;
  playerSessions?: number | null;
  wins?: number | null;
  losses?: number | null;
  weightedWins?: number | null;
  weightedLosses?: number | null;
  weightedWLRatio?: number | null;
  teamTypeWL?: ClanBreakdown;
  teamCountWL?: ClanBreakdown;
}

export interface ClanResponse {
  start?: string;
  end?: string;
  clan: Clan;
}

/** One entry in `GET /clan/:clanTag/sessions`. */
export interface ClanSession {
  gameId: string;
  clanTag: string;
  clanPlayerCount: number;
  hasWon: boolean;
  numTeams: number;
  playerTeams: string | null;
  totalPlayerCount: number;
  gameStart: string;
  score: number | null;
}

/** Response of `GET /clan/:clanTag/sessions`. */
export interface ClanSessionsResponse {
  results: ClanSession[];
  total: number;
  page: number;
  limit: number;
}

/** HTTP `Content-Range` header parsed from `GET /games`. */
export interface ContentRange {
  unit: string;
  start: number;
  end: number;
  total: number | null;
}

/** A validated, normalized API request cache key. */
export interface CacheKey {
  /** Stable, normalized string used for cache and deduplication. */
  key: string;
  /** Endpoint group used to pick the rate-limit bucket and TTL. */
  bucket: EndpointBucket;
}

export type EndpointBucket =
  | 'games'
  | 'gameDetail'
  | 'player'
  | 'playerGames'
  | 'playerSessions'
  | 'clan'
  | 'clanSessions'
  | 'leaderboard';

export type JsonValue = unknown;