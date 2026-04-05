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
    console.log('ODDS_API_KEY not set, cannot fetch real matches');
    return [];
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

  const golfMatches = getGolfMatchups();
  allMatches.push(...golfMatches);

  allMatches.sort((a, b) => a.matchTime.getTime() - b.matchTime.getTime());

  if (allMatches.length === 0) {
    console.log('No real games found from sports API — using built-in fallback matches');
    return getFallbackMatches();
  }
  
  matchCache = { data: allMatches, fetchedAt: Date.now() };
  console.log(`Fetched ${allMatches.length} real upcoming matches from sports API (cached for 1 hour)`);
  return allMatches;
}

function getGolfMatchups(): SportsMatch[] {
  const hours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
  const golfers = [
    ["Scottie Scheffler", "Rory McIlroy"],
    ["Jon Rahm", "Brooks Koepka"],
    ["Bryson DeChambeau", "Viktor Hovland"],
    ["Jordan Spieth", "Justin Thomas"],
    ["Collin Morikawa", "Patrick Cantlay"],
  ];
  return golfers.map((pair, i) => ({
    homeTeam: pair[0],
    awayTeam: pair[1],
    sport: "golf",
    matchTime: hours(24 + i * 12),
    league: "PGA Tour",
  }));
}

function getFallbackMatches(): SportsMatch[] {
  const hours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
  
  return [
    { homeTeam: "Manchester United", awayTeam: "Liverpool", sport: "football", matchTime: hours(24), league: "Premier League" },
    { homeTeam: "Real Madrid", awayTeam: "Barcelona", sport: "football", matchTime: hours(48), league: "La Liga" },
    { homeTeam: "Bayern Munich", awayTeam: "Dortmund", sport: "football", matchTime: hours(36), league: "Bundesliga" },
    { homeTeam: "Arsenal", awayTeam: "Chelsea", sport: "football", matchTime: hours(60), league: "Premier League" },
    { homeTeam: "PSG", awayTeam: "Lyon", sport: "football", matchTime: hours(72), league: "Ligue 1" },
    { homeTeam: "Juventus", awayTeam: "AC Milan", sport: "football", matchTime: hours(84), league: "Serie A" },
    { homeTeam: "Lakers", awayTeam: "Celtics", sport: "basketball", matchTime: hours(12), league: "NBA" },
    { homeTeam: "Warriors", awayTeam: "Bucks", sport: "basketball", matchTime: hours(18), league: "NBA" },
    { homeTeam: "Nuggets", awayTeam: "Heat", sport: "basketball", matchTime: hours(30), league: "NBA" },
    { homeTeam: "76ers", awayTeam: "Suns", sport: "basketball", matchTime: hours(42), league: "NBA" },
    { homeTeam: "Mavericks", awayTeam: "Clippers", sport: "basketball", matchTime: hours(54), league: "NBA" },
    { homeTeam: "Nets", awayTeam: "Knicks", sport: "basketball", matchTime: hours(66), league: "NBA" },
    { homeTeam: "Djokovic", awayTeam: "Alcaraz", sport: "tennis", matchTime: hours(20), league: "ATP Tour" },
    { homeTeam: "Sinner", awayTeam: "Medvedev", sport: "tennis", matchTime: hours(32), league: "ATP Tour" },
    { homeTeam: "Zverev", awayTeam: "Ruud", sport: "tennis", matchTime: hours(44), league: "ATP Tour" },
    { homeTeam: "Swiatek", awayTeam: "Sabalenka", sport: "tennis", matchTime: hours(56), league: "WTA Tour" },
    { homeTeam: "Gauff", awayTeam: "Rybakina", sport: "tennis", matchTime: hours(68), league: "WTA Tour" },
    { homeTeam: "Yankees", awayTeam: "Red Sox", sport: "baseball", matchTime: hours(22), league: "MLB" },
    { homeTeam: "Dodgers", awayTeam: "Giants", sport: "baseball", matchTime: hours(34), league: "MLB" },
    { homeTeam: "Cubs", awayTeam: "Cardinals", sport: "baseball", matchTime: hours(46), league: "MLB" },
    { homeTeam: "Astros", awayTeam: "Rangers", sport: "baseball", matchTime: hours(58), league: "MLB" },
    { homeTeam: "Braves", awayTeam: "Phillies", sport: "baseball", matchTime: hours(70), league: "MLB" },
    { homeTeam: "Rangers", awayTeam: "Bruins", sport: "hockey", matchTime: hours(26), league: "NHL" },
    { homeTeam: "Maple Leafs", awayTeam: "Canadiens", sport: "hockey", matchTime: hours(38), league: "NHL" },
    { homeTeam: "Oilers", awayTeam: "Flames", sport: "hockey", matchTime: hours(50), league: "NHL" },
    { homeTeam: "Lightning", awayTeam: "Panthers", sport: "hockey", matchTime: hours(62), league: "NHL" },
    { homeTeam: "Penguins", awayTeam: "Capitals", sport: "hockey", matchTime: hours(74), league: "NHL" },
    { homeTeam: "India", awayTeam: "Australia", sport: "cricket", matchTime: hours(28), league: "Test Series" },
    { homeTeam: "England", awayTeam: "New Zealand", sport: "cricket", matchTime: hours(40), league: "ODI Series" },
    { homeTeam: "Pakistan", awayTeam: "South Africa", sport: "cricket", matchTime: hours(52), league: "T20 Series" },
    { homeTeam: "West Indies", awayTeam: "Bangladesh", sport: "cricket", matchTime: hours(64), league: "ODI Series" },
    { homeTeam: "Sri Lanka", awayTeam: "Afghanistan", sport: "cricket", matchTime: hours(76), league: "T20 Series" },
    { homeTeam: "Jones", awayTeam: "Miocic", sport: "mma", matchTime: hours(96), league: "UFC" },
    { homeTeam: "Makhachev", awayTeam: "Oliveira", sport: "mma", matchTime: hours(108), league: "UFC" },
    { homeTeam: "Adesanya", awayTeam: "Pereira", sport: "mma", matchTime: hours(120), league: "UFC" },
    { homeTeam: "Edwards", awayTeam: "Covington", sport: "mma", matchTime: hours(132), league: "UFC" },
    { homeTeam: "O'Malley", awayTeam: "Dvalishvili", sport: "mma", matchTime: hours(144), league: "UFC" },
    { homeTeam: "Scheffler", awayTeam: "McIlroy", sport: "golf", matchTime: hours(100), league: "PGA Tour" },
    { homeTeam: "Rahm", awayTeam: "Koepka", sport: "golf", matchTime: hours(112), league: "LIV Golf" },
    { homeTeam: "DeChambeau", awayTeam: "Hovland", sport: "golf", matchTime: hours(124), league: "PGA Tour" },
    { homeTeam: "Spieth", awayTeam: "Thomas", sport: "golf", matchTime: hours(136), league: "PGA Tour" },
    { homeTeam: "Morikawa", awayTeam: "Cantlay", sport: "golf", matchTime: hours(148), league: "PGA Tour" },
  ];
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
  if (!apiKey) {
    console.log('ODDS_API_KEY not set, cannot fetch completed games');
    return [];
  }

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
  console.log(`Fetched ${completedGames.length} real completed games`);
  return completedGames;
}
