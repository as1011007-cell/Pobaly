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

const SPORTS_MAP: Record<string, { apiKey: string; sportName: string; league: string }[]> = {
  football: [
    { apiKey: 'soccer_epl', sportName: 'football', league: 'Premier League' },
  ],
  basketball: [
    { apiKey: 'basketball_nba', sportName: 'basketball', league: 'NBA' },
    { apiKey: 'basketball_euroleague', sportName: 'basketball', league: 'EuroLeague' },
  ],
  tennis: [
    { apiKey: 'tennis_atp_australian_open', sportName: 'tennis', league: 'Australian Open' },
    { apiKey: 'tennis_wta_australian_open', sportName: 'tennis', league: 'WTA Australian Open' },
  ],
  baseball: [
    { apiKey: 'baseball_mlb', sportName: 'baseball', league: 'MLB' },
    { apiKey: 'baseball_npb', sportName: 'baseball', league: 'NPB Japan' },
  ],
  hockey: [
    { apiKey: 'icehockey_nhl', sportName: 'hockey', league: 'NHL' },
  ],
  mma: [
    { apiKey: 'mma_mixed_martial_arts', sportName: 'mma', league: 'UFC' },
  ],
  cricket: [
    { apiKey: 'cricket_test_match', sportName: 'cricket', league: 'Test Match' },
    { apiKey: 'cricket_ipl', sportName: 'cricket', league: 'IPL' },
    { apiKey: 'cricket_big_bash', sportName: 'cricket', league: 'Big Bash' },
  ],
  golf: [
    { apiKey: 'golf_pga_championship', sportName: 'golf', league: 'PGA Tour' },
    { apiKey: 'golf_masters_tournament', sportName: 'golf', league: 'Masters' },
  ],
};

const ADDITIONAL_FOOTBALL_LEAGUES = [
  { apiKey: 'soccer_spain_la_liga', league: 'La Liga' },
  { apiKey: 'soccer_germany_bundesliga', league: 'Bundesliga' },
  { apiKey: 'soccer_italy_serie_a', league: 'Serie A' },
  { apiKey: 'soccer_france_ligue_one', league: 'Ligue 1' },
];

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
  const apiKey = process.env.ODDS_API_KEY;
  
  if (!apiKey) {
    console.log('ODDS_API_KEY not set, cannot fetch real matches');
    return [];
  }

  const allMatches: SportsMatch[] = [];
  const now = new Date();
  const maxFutureTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const [sportName, configs] of Object.entries(SPORTS_MAP)) {
    for (const config of configs) {
      const games = await fetchGamesFromApi(config.apiKey);
      
      for (const game of games.slice(0, 4)) {
        const matchTime = new Date(game.commence_time);
        
        if (matchTime > now && matchTime < maxFutureTime) {
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
  }

  for (const league of ADDITIONAL_FOOTBALL_LEAGUES) {
    const games = await fetchGamesFromApi(league.apiKey);
    
    for (const game of games.slice(0, 3)) {
      const matchTime = new Date(game.commence_time);
      
      if (matchTime > now && matchTime < maxFutureTime) {
        allMatches.push({
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          sport: 'football',
          matchTime: matchTime,
          league: league.league,
        });
      }
    }
  }

  allMatches.sort((a, b) => a.matchTime.getTime() - b.matchTime.getTime());

  if (allMatches.length === 0) {
    console.log('No real games found from sports API');
  } else {
    console.log(`Fetched ${allMatches.length} real upcoming matches from sports API`);
  }
  
  return allMatches;
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
  return getUpcomingMatchesFromApi();
}
