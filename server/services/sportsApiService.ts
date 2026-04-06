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
    
    for (const game of games.slice(0, 4)) {
      const matchTime = new Date(game.commence_time);
      
      if (matchTime > currentTime && matchTime < maxFutureTime) {
        allMatches.push({
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          sport: config.sportName,
          matchTime: matchTime,
          league: config.league,
        });
      }
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

  for (const endpoint of ESPN_ENDPOINTS) {
    try {
      const response = await fetch(endpoint.url);
      if (!response.ok) continue;

      const data = await response.json() as any;
      const events = data.events || [];

      for (const event of events.slice(0, 6)) {
        const matchTime = new Date(event.date);
        if (isNaN(matchTime.getTime()) || matchTime < currentTime) continue;

        const competitors = event.competitions?.[0]?.competitors || [];
        if (competitors.length < 2) continue;

        const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
        const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

        const homeTeam = homeComp.team?.displayName || homeComp.athlete?.displayName || event.name?.split(' vs ')?.[0] || 'TBD';
        const awayTeam = awayComp.team?.displayName || awayComp.athlete?.displayName || event.name?.split(' vs ')?.[1] || 'TBD';

        if (homeTeam === 'TBD' || awayTeam === 'TBD') continue;

        allMatches.push({
          homeTeam,
          awayTeam,
          sport: endpoint.sport,
          matchTime,
          league: endpoint.league,
        });
      }
    } catch (error) {
      console.error(`ESPN fetch failed for ${endpoint.league}:`, error);
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

export async function getRecentCompletedGames(): Promise<CompletedGame[]> {
  const apiKey = process.env.ODDS_API_KEY;
  
  if (apiKey) {
    const oddsApiGames = await fetchCompletedFromOddsApi(apiKey);
    if (oddsApiGames.length > 0) return oddsApiGames;
  }

  console.log('Odds API unavailable — fetching completed games from ESPN');
  return fetchCompletedFromESPN();
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

      const url = `https://api.the-odds-api.com/v4/sports/${config.apiKey}/scores/?apiKey=${apiKey}&daysFrom=2&dateFormat=iso`;
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
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard', sport: 'football', league: 'La Liga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard', sport: 'football', league: 'Bundesliga' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard', sport: 'football', league: 'Serie A' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard', sport: 'football', league: 'Ligue 1' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard', sport: 'football', league: 'MLS' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard', sport: 'mma', league: 'UFC' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard', sport: 'tennis', league: 'ATP Tour' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/tennis/wta/scoreboard', sport: 'tennis', league: 'WTA Tour' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/cricket/icc/scoreboard', sport: 'cricket', league: 'ICC' },
  { url: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard', sport: 'golf', league: 'PGA Tour' },
];

async function fetchCompletedFromESPN(): Promise<CompletedGame[]> {
  const completedGames: CompletedGame[] = [];

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const yesterdayStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');

  for (const endpoint of ESPN_SCORES_ENDPOINTS) {
    for (const dateStr of [yesterdayStr, todayStr]) {
    try {
      const url = `${endpoint.url}?dates=${dateStr}`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json() as any;
      const events = data.events || [];

      for (const event of events) {
        const status = event.status?.type?.name;
        if (status !== 'STATUS_FINAL') continue;

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

        if (endpoint.sport === 'tennis') {
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
        if (homeScore === awayScore) continue;

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

  completedGames.sort((a, b) => b.matchTime.getTime() - a.matchTime.getTime());
  console.log(`Fetched ${completedGames.length} completed games from ESPN`);
  return completedGames;
}
