interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

interface SportsMatch {
  homeTeam: string;
  awayTeam: string;
  sport: string;
  matchTime: Date;
  league?: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let matchCache: { data: SportsMatch[]; fetchedAt: number } | null = null;
let espnFallbackCache: { data: SportsMatch[]; fetchedAt: number } | null = null;
const ESPN_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

const SPORTS_MAP: Record<string, { apiKey: string; sportName: string; league: string }[]> = {
  football: [
    { apiKey: 'soccer_epl', sportName: 'football', league: 'Premier League' },
    { apiKey: 'soccer_spain_la_liga', sportName: 'football', league: 'La Liga' },
    { apiKey: 'soccer_germany_bundesliga', sportName: 'football', league: 'Bundesliga' },
    { apiKey: 'soccer_italy_serie_a', sportName: 'football', league: 'Serie A' },
    { apiKey: 'soccer_france_ligue_one', sportName: 'football', league: 'Ligue 1' },
    { apiKey: 'soccer_uefa_champs_league', sportName: 'football', league: 'Champions League' },
    { apiKey: 'soccer_usa_mls', sportName: 'football', league: 'MLS' },
  ],
  basketball: [
    { apiKey: 'basketball_nba', sportName: 'basketball', league: 'NBA' },
    { apiKey: 'basketball_euroleague', sportName: 'basketball', league: 'EuroLeague' },
    { apiKey: 'basketball_ncaab', sportName: 'basketball', league: 'NCAAB' },
  ],
  tennis: [
    { apiKey: 'tennis_atp_monte_carlo_masters', sportName: 'tennis', league: 'ATP Monte-Carlo Masters' },
    { apiKey: 'tennis_wta_charleston_open', sportName: 'tennis', league: 'WTA Charleston Open' },
  ],
  baseball: [
    { apiKey: 'baseball_mlb', sportName: 'baseball', league: 'MLB' },
  ],
  hockey: [
    { apiKey: 'icehockey_nhl', sportName: 'hockey', league: 'NHL' },
  ],
  mma: [
    { apiKey: 'mma_mixed_martial_arts', sportName: 'mma', league: 'UFC' },
  ],
  cricket: [
    { apiKey: 'cricket_ipl', sportName: 'cricket', league: 'IPL' },
    { apiKey: 'cricket_international_t20', sportName: 'cricket', league: 'International T20' },
    { apiKey: 'cricket_psl', sportName: 'cricket', league: 'PSL' },
  ],
  golf: [],
};

async function fetchGamesFromApi(sportKey: string): Promise<OddsApiGame[]> {
  const apiKey = process.env.ODDS_API_KEY;
  
  if (!apiKey) {
    console.log('ODDS_API_KEY not configured, using fallback data');
    return [];
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Failed to fetch games for ${sportKey}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data as OddsApiGame[];
  } catch (error) {
    console.error(`Error fetching games for ${sportKey}:`, error);
    return [];
  }
}

export async function getUpcomingMatchesFromApi(): Promise<SportsMatch[]> {
  const now = Date.now();
  if (matchCache && (now - matchCache.fetchedAt) < CACHE_TTL_MS) {
    const upcoming = matchCache.data.filter(m => m.matchTime.getTime() > now);
    if (upcoming.length > 0) {
      console.log(`Using cached matches (${upcoming.length} upcoming, cache age: ${Math.round((now - matchCache.fetchedAt) / 60000)}m)`);
      return upcoming;
    }
  }

  const apiKey = process.env.ODDS_API_KEY;
  
  if (!apiKey) {
    console.log('ODDS_API_KEY not set — fetching real matches from ESPN');
    const espnMatches = await getESPNMatches();
    matchCache = { data: espnMatches, fetchedAt: Date.now() };
    _usingFallback = true;
    return espnMatches;
  }

  const allMatches: SportsMatch[] = [];
  const currentTime = new Date();
  const maxFutureTime = new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000);

  const allConfigs: { apiKey: string; sportName: string; league: string }[] = [];
  for (const configs of Object.values(SPORTS_MAP)) {
    allConfigs.push(...configs);
  }

  for (let i = 0; i < allConfigs.length; i++) {
    const config = allConfigs[i];
    if (i > 0 && i % 5 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
    const games = await fetchGamesFromApi(config.apiKey);
    
    const futureGames = games
      .filter(g => {
        const t = new Date(g.commence_time);
        return t > currentTime && t < maxFutureTime;
      })
      .slice(0, 4);

    for (const game of futureGames) {
      allMatches.push({
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        sport: config.sportName,
        matchTime: new Date(game.commence_time),
        league: config.league,
      });
    }
  }

  const apiMatchCount = allMatches.length;

  if (apiMatchCount === 0) {
    console.log('No real games found from sports API — fetching real matches from ESPN');
    const espnMatches = await getESPNMatches();
    matchCache = { data: espnMatches, fetchedAt: Date.now() };
    _usingFallback = true;
    return espnMatches;
  }

  allMatches.sort((a, b) => a.matchTime.getTime() - b.matchTime.getTime());
  
  matchCache = { data: allMatches, fetchedAt: Date.now() };
  _usingFallback = false;
  console.log(`Fetched ${allMatches.length} real upcoming matches from sports API (cached for 1 hour)`);
  return allMatches;
}

let _usingFallback = false;

export function isUsingFallbackData(): boolean {
  return _usingFallback;
}

const ESPN_ENDPOINTS: { url: string; sport: string; league: string }[] = [
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'basketball', league: 'NBA' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', sport: 'baseball', league: 'MLB' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', sport: 'hockey', league: 'NHL' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', sport: 'football', league: 'Premier League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', sport: 'football', league: 'La Liga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard', sport: 'football', league: 'Bundesliga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard', sport: 'football', league: 'Serie A' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard', sport: 'football', league: 'Ligue 1' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', sport: 'football', league: 'MLS' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', sport: 'football', league: 'Champions League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard', sport: 'mma', league: 'UFC' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard', sport: 'tennis', league: 'ATP Tour' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard', sport: 'tennis', league: 'WTA Tour' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/cricket/icc/scoreboard', sport: 'cricket', league: 'ICC' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard', sport: 'golf', league: 'PGA Tour' },
];

async function getESPNMatches(): Promise<SportsMatch[]> {
  const now = Date.now();
  if (espnFallbackCache && (now - espnFallbackCache.fetchedAt) < ESPN_CACHE_TTL) {
    const upcoming = espnFallbackCache.data.filter(m => m.matchTime.getTime() > now);
    if (upcoming.length > 5) {
      console.log(`Using cached ESPN matches (${upcoming.length} upcoming)`);
      return upcoming;
    }
  }

  console.log("Fetching real upcoming matches from ESPN (free API)...");
  const allMatches: SportsMatch[] = [];
  const currentTime = new Date();
  const seenMatchups = new Set<string>();

  // Helper to parse ESPN events into SportsMatch entries
  function parseESPNEvents(events: any[], sport: string, league: string): SportsMatch[] {
    const results: SportsMatch[] = [];
    for (const event of events.slice(0, 10)) {
      const matchTime = new Date(event.date);
      if (isNaN(matchTime.getTime()) || matchTime < currentTime) continue;
      const competitors = event.competitions?.[0]?.competitors || [];
      if (competitors.length < 2) continue;
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
      const homeTeam = homeComp.team?.displayName || homeComp.athlete?.displayName || event.name?.split(' vs ')?.[0] || 'TBD';
      const awayTeam = awayComp.team?.displayName || awayComp.athlete?.displayName || event.name?.split(' vs ')?.[1] || 'TBD';
      if (homeTeam === 'TBD' || awayTeam === 'TBD') continue;
      const key = `${homeTeam}|${awayTeam}|${sport}`;
      if (seenMatchups.has(key)) continue;
      seenMatchups.add(key);
      results.push({ homeTeam, awayTeam, sport, matchTime, league });
    }
    return results;
  }

  // Fetch today's scoreboard for all endpoints
  for (const endpoint of ESPN_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url);
      if (!response.ok) continue;
      const data = await response.json() as any;
      allMatches.push(...parseESPNEvents(data.events || [], endpoint.sport, endpoint.league));
    } catch (error) {
      console.error(`ESPN fetch failed for ${endpoint.league}:`, error);
    }
  }

  // Also fetch next 3 days for key leagues to ensure enough upcoming games
  const keyScheduleEndpoints = [
    { base: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'basketball', league: 'NBA' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', sport: 'baseball', league: 'MLB' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', sport: 'hockey', league: 'NHL' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', sport: 'football', league: 'Premier League' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', sport: 'football', league: 'La Liga' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard', sport: 'football', league: 'Bundesliga' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard', sport: 'football', league: 'Serie A' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard', sport: 'football', league: 'Ligue 1' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard', sport: 'mma', league: 'UFC' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard', sport: 'tennis', league: 'ATP Tour' },
    { base: 'https://site.api.espn.com/apis/site/v2/sports/cricket/icc/scoreboard', sport: 'cricket', league: 'ICC' },
  ];

  for (let dayOffset = 1; dayOffset <= 3; dayOffset++) {
    const d = new Date(currentTime);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    for (const ep of keyScheduleEndpoints) {
      try {
        const response = await fetch(`${ep.base}?dates=${dateStr}`);
        if (!response.ok) continue;
        const data = await response.json() as any;
        allMatches.push(...parseESPNEvents(data.events || [], ep.sport, ep.league));
      } catch {
        // silently skip schedule fetches that fail
      }
    }
  }

  allMatches.sort((a, b) => a.matchTime.getTime() - b.matchTime.getTime());

  if (allMatches.length > 0) {
    espnFallbackCache = { data: allMatches, fetchedAt: Date.now() };
    console.log(`ESPN: fetched ${allMatches.length} real upcoming matches across ${new Set(allMatches.map(m => m.sport)).size} sports`);
    return allMatches;
  }

  console.log("ESPN returned no matches");
  return [];
}

export async function refreshUpcomingMatches(): Promise<SportsMatch[]> {
  matchCache = null;
  espnFallbackCache = null;
  return getUpcomingMatchesFromApi();
}

interface CompletedGame {
  homeTeam: string;
  awayTeam: string;
  sport: string;
  league: string;
  matchTime: Date;
  homeScore: number;
  awayScore: number;
  winner: string;
}

export interface LiveMatch {
  homeTeam: string;
  awayTeam: string;
  sport: string;
  league: string;
  matchTime: Date;
  homeScore: number;
  awayScore: number;
  status: string;
  clock?: string;
  period?: string;
}

const LIVE_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
let liveMatchCache: { data: LiveMatch[]; fetchedAt: number } | null = null;

export async function getLiveMatches(): Promise<LiveMatch[]> {
  if (liveMatchCache && Date.now() - liveMatchCache.fetchedAt < LIVE_CACHE_TTL) {
    return liveMatchCache.data;
  }

  const liveMatches: LiveMatch[] = [];

  for (const endpoint of ESPN_SCORES_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url);
      if (!response.ok) continue;

      const data = await response.json() as any;
      const events = data.events || [];

      for (const event of events) {
        const statusType = event.status?.type?.name;
        if (statusType !== 'STATUS_IN_PROGRESS' && statusType !== 'STATUS_HALFTIME' && statusType !== 'STATUS_END_PERIOD') continue;

        const competitors = event.competitions?.[0]?.competitors || [];
        if (competitors.length < 2) continue;

        if (endpoint.sport === 'golf' || endpoint.sport === 'tennis') {
          const comp1 = competitors[0];
          const comp2 = competitors[1];
          const name1 = comp1?.athlete?.displayName || comp1?.team?.displayName || 'Unknown';
          const name2 = comp2?.athlete?.displayName || comp2?.team?.displayName || 'Unknown';
          if (name1 === 'Unknown' || name2 === 'Unknown') continue;

          liveMatches.push({
            homeTeam: name1,
            awayTeam: name2,
            sport: endpoint.sport,
            league: endpoint.league,
            matchTime: new Date(event.date),
            homeScore: parseInt(comp1.score || '0'),
            awayScore: parseInt(comp2.score || '0'),
            status: event.status?.type?.shortDetail || 'Live',
            clock: event.status?.displayClock,
            period: event.status?.period?.toString(),
          });
          continue;
        }

        const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
        const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

        const homeTeam = homeComp.team?.displayName || 'Unknown';
        const awayTeam = awayComp.team?.displayName || 'Unknown';
        if (homeTeam === 'Unknown' || awayTeam === 'Unknown') continue;

        liveMatches.push({
          homeTeam,
          awayTeam,
          sport: endpoint.sport,
          league: endpoint.league,
          matchTime: new Date(event.date),
          homeScore: parseInt(homeComp.score || '0'),
          awayScore: parseInt(awayComp.score || '0'),
          status: event.status?.type?.shortDetail || 'Live',
          clock: event.status?.displayClock,
          period: event.status?.period?.toString(),
        });
      }
    } catch (error) {
      console.error(`ESPN live fetch failed for ${endpoint.league}:`, error);
    }
  }

  liveMatchCache = { data: liveMatches, fetchedAt: Date.now() };
  console.log(`Fetched ${liveMatches.length} live matches from ESPN`);
  return liveMatches;
}

export async function getRecentCompletedGames(): Promise<CompletedGame[]> {
  const apiKey = process.env.ODDS_API_KEY;

  // Cross-check: run both sources in parallel, merge results
  // ESPN covers: NBA, MLB, NHL, football (EPL/La Liga/etc), UFC, ATP/WTA, ICC cricket, PGA
  // Odds API covers: all of the above + IPL/PSL cricket, EuroLeague, NCAAB, Bellator
  const [espnGames, oddsGames] = await Promise.all([
    fetchCompletedFromESPN(),
    apiKey ? fetchCompletedFromOddsApi(apiKey) : Promise.resolve([]),
  ]);

  if (espnGames.length === 0 && oddsGames.length === 0) {
    console.log('Both sources returned 0 completed games');
    return [];
  }

  // Merge: Odds API games first (more granular team names), then ESPN games not already covered
  const simplify = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  const merged: CompletedGame[] = [...oddsGames];
  const seenKeys = new Set(
    oddsGames.flatMap(g => [
      `${simplify(g.homeTeam)}|${simplify(g.awayTeam)}`,
      `${simplify(g.awayTeam)}|${simplify(g.homeTeam)}`,
    ])
  );

  for (const g of espnGames) {
    const key = `${simplify(g.homeTeam)}|${simplify(g.awayTeam)}`;
    const reverseKey = `${simplify(g.awayTeam)}|${simplify(g.homeTeam)}`;
    if (!seenKeys.has(key) && !seenKeys.has(reverseKey)) {
      merged.push(g);
      seenKeys.add(key);
    }
  }

  merged.sort((a, b) => b.matchTime.getTime() - a.matchTime.getTime());
  console.log(`Cross-checked results: ${espnGames.length} ESPN + ${oddsGames.length} Odds API → ${merged.length} merged`);
  return merged;
}

async function fetchCompletedFromOddsApi(apiKey: string): Promise<CompletedGame[]> {
  const completedGames: CompletedGame[] = [];
  const scoresConfigs: { apiKey: string; sportName: string; league: string }[] = [];
  for (const configs of Object.values(SPORTS_MAP)) {
    scoresConfigs.push(...configs);
  }

  let requestCount = 0;
  for (const config of scoresConfigs) {
    try {
      if (requestCount > 0 && requestCount % 5 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
      requestCount++;

      const url = `https://api.the-odds-api.com/v4/sports/${config.apiKey}/scores/?apiKey=${apiKey}&daysFrom=3&dateFormat=iso`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json() as any[];
      for (const game of data) {
        if (!game.completed || !game.scores || game.scores.length < 2) continue;

        const homeScore = parseInt(game.scores.find((s: any) => s.name === game.home_team)?.score || '0');
        const awayScore = parseInt(game.scores.find((s: any) => s.name === game.away_team)?.score || '0');
        if (homeScore === awayScore) continue;

        completedGames.push({
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          sport: config.sportName,
          league: config.league,
          matchTime: new Date(game.commence_time),
          homeScore,
          awayScore,
          winner: homeScore > awayScore ? game.home_team : game.away_team,
        });
      }
    } catch (error) {
      console.error(`Error fetching scores for ${config.apiKey}:`, error);
    }
  }

  completedGames.sort((a, b) => b.matchTime.getTime() - a.matchTime.getTime());
  console.log(`Fetched ${completedGames.length} real completed games from Odds API`);
  return completedGames;
}

const ESPN_SCORES_ENDPOINTS = [
  { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', sport: 'basketball', league: 'NBA' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', sport: 'baseball', league: 'MLB' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', sport: 'hockey', league: 'NHL' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', sport: 'football', league: 'Premier League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.2/scoreboard', sport: 'football', league: 'Championship' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.fa/scoreboard', sport: 'football', league: 'FA Cup' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.league_cup/scoreboard', sport: 'football', league: 'EFL Cup' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', sport: 'football', league: 'La Liga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.copa_del_rey/scoreboard', sport: 'football', league: 'Copa del Rey' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard', sport: 'football', league: 'Bundesliga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard', sport: 'football', league: 'Serie A' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard', sport: 'football', league: 'Ligue 1' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', sport: 'football', league: 'MLS' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard', sport: 'football', league: 'Champions League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard', sport: 'football', league: 'Europa League' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard', sport: 'mma', league: 'UFC' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard', sport: 'tennis', league: 'ATP Tour' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard', sport: 'tennis', league: 'WTA Tour' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/cricket/icc/scoreboard', sport: 'cricket', league: 'ICC' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard', sport: 'golf', league: 'PGA Tour' },
];

async function fetchCompletedFromESPN(): Promise<CompletedGame[]> {
  const completedGames: CompletedGame[] = [];

  const dateStrs: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateStrs.push(d.toISOString().split('T')[0].replace(/-/g, ''));
  }

  for (const endpoint of ESPN_SCORES_ENDPOINTS) {
    for (const dateStr of dateStrs) {
    try {
      const url = `${endpoint.url}?dates=${dateStr}`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json() as any;
      const events = data.events || [];

      for (const event of events) {
        const status = event.status?.type?.name;
        const isCompleted = event.status?.type?.completed === true;
        const completedStatuses = ['STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FULL_PEN', 'STATUS_FULL_ET', 'STATUS_ENDED'];
        if (!isCompleted && !completedStatuses.includes(status)) continue;

        const competitors = event.competitions?.[0]?.competitors || [];

        if (endpoint.sport === 'golf') {
          if (competitors.length < 1) continue;
          const winnerComp = competitors.find((c: any) => c.winner) || competitors[0];
          const runnerUp = competitors[1];
          const winnerName = winnerComp?.athlete?.displayName || winnerComp?.team?.displayName;
          const runnerName = runnerUp?.athlete?.displayName || runnerUp?.team?.displayName;
          if (!winnerName || !runnerName) continue;
          completedGames.push({
            homeTeam: winnerName,
            awayTeam: runnerName,
            sport: endpoint.sport,
            league: endpoint.league,
            matchTime: new Date(event.date),
            homeScore: 1,
            awayScore: 0,
            winner: winnerName,
          });
          continue;
        }

        if (endpoint.sport === 'tennis' || endpoint.sport === 'mma') {
          if (competitors.length < 2) continue;
          const winnerComp = competitors.find((c: any) => c.winner) || competitors[0];
          const loserComp = competitors.find((c: any) => !c.winner) || competitors[1];
          const winnerName = winnerComp?.athlete?.displayName || winnerComp?.team?.displayName;
          const loserName = loserComp?.athlete?.displayName || loserComp?.team?.displayName;
          if (!winnerName || !loserName) continue;
          completedGames.push({
            homeTeam: winnerName,
            awayTeam: loserName,
            sport: endpoint.sport,
            league: endpoint.league,
            matchTime: new Date(event.date),
            homeScore: 1,
            awayScore: 0,
            winner: winnerName,
          });
          continue;
        }

        if (competitors.length < 2) continue;

        const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
        const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

        const homeTeam = homeComp.team?.displayName || 'Unknown';
        const awayTeam = awayComp.team?.displayName || 'Unknown';
        const homeScore = parseInt(homeComp.score || '0');
        const awayScore = parseInt(awayComp.score || '0');

        if (homeTeam === 'Unknown' || awayTeam === 'Unknown') continue;

        if (homeScore === awayScore) {
          if (endpoint.sport === 'football') {
            completedGames.push({
              homeTeam,
              awayTeam,
              sport: endpoint.sport,
              league: endpoint.league,
              matchTime: new Date(event.date),
              homeScore,
              awayScore,
              winner: 'Draw',
            });
          }
          continue;
        }

        completedGames.push({
          homeTeam,
          awayTeam,
          sport: endpoint.sport,
          league: endpoint.league,
          matchTime: new Date(event.date),
          homeScore,
          awayScore,
          winner: homeComp.winner ? homeTeam : awayTeam,
        });
      }
    } catch (error) {
      console.error(`ESPN scores fetch failed for ${endpoint.league}:`, error);
    }
    }
  }

  const seen = new Set<string>();
  const dedupedGames = completedGames
    .sort((a, b) => b.matchTime.getTime() - a.matchTime.getTime())
    .filter(g => {
      const key = `${g.homeTeam} vs ${g.awayTeam}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  console.log(`Fetched ${dedupedGames.length} completed games from ESPN (${completedGames.length} before dedup)`);
  return dedupedGames;
}
