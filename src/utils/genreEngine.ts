import { Scrobble, TrackChartItem, AlbumChartItem, ChartWeekInfo } from '../types/music';
import { normalizeStrict, normalizeTrackTitle, normalizeAlbumTitle } from './similarity';
import { splitArtistList } from './artistCrediting';
import { getPhotoCacheSnapshot } from './lastfmImageFetcher';

export interface GenreWeekData {
  genre: string;
  displayName: string;
  color: string;
  iconName: string;
  totalPlays: number;
  sharePct: number;
  top5Tracks: {
    rank: number;
    title: string;
    artist: string;
    playCount: number;
    points: number;
    coverArt: string;
    moveStatus?: 'new' | 'up' | 'down' | 'flat' | 'reentry';
    album?: string;
  }[];
  top5Albums: {
    rank: number;
    title: string;
    artist: string;
    playCount: number;
    points: number;
    coverArt: string;
    tracksCount?: number;
  }[];
}

// Canonical Genre Definitions & Palettes
export const GENRE_METADATA: Record<string, { name: string; color: string; gradient: string; isNonPop?: boolean }> = {
  pop: {
    name: 'Pop',
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-600',
    isNonPop: false,
  },
  rnb: {
    name: 'R&B / Soul',
    color: '#a855f7',
    gradient: 'from-purple-500 to-indigo-600',
    isNonPop: true,
  },
  hiphop: {
    name: 'Hip-Hop / Rap',
    color: '#f59e0b',
    gradient: 'from-amber-500 to-orange-600',
    isNonPop: true,
  },
  rock: {
    name: 'Rock & Alternative',
    color: '#ef4444',
    gradient: 'from-red-500 to-rose-700',
    isNonPop: true,
  },
  electronic: {
    name: 'Synthwave & Electronic',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-600',
    isNonPop: true,
  },
  indie: {
    name: 'Indie & Folk',
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-600',
    isNonPop: true,
  },
  metal: {
    name: 'Metal & Hardcore',
    color: '#6366f1',
    gradient: 'from-indigo-600 to-slate-800',
    isNonPop: true,
  },
  jazz_soul: {
    name: 'Jazz & Blues',
    color: '#eab308',
    gradient: 'from-yellow-400 to-amber-600',
    isNonPop: true,
  },
  latin: {
    name: 'Latin & Reggaeton',
    color: '#f97316',
    gradient: 'from-orange-500 to-red-500',
    isNonPop: true,
  },
  country: {
    name: 'Country & Americana',
    color: '#d97706',
    gradient: 'from-amber-600 to-yellow-800',
    isNonPop: true,
  },
  kpop_jpop: {
    name: 'K-Pop & Asian Pop',
    color: '#d946ef',
    gradient: 'from-fuchsia-500 to-pink-600',
    isNonPop: false,
  },
  ambient_classical: {
    name: 'Ambient & Classical',
    color: '#38bdf8',
    gradient: 'from-sky-400 to-indigo-500',
    isNonPop: true,
  },
  other: {
    name: 'Eclectic / Other',
    color: '#a1a1aa',
    gradient: 'from-zinc-400 to-zinc-600',
    isNonPop: true,
  },
};

// Comprehensive artist dictionary for instant zero-latency mapping
const ARTIST_GENRE_MAP: Record<string, string> = {
  // Pop
  'dua lipa': 'pop',
  'taylor swift': 'pop',
  'lady gaga': 'pop',
  'ariana grande': 'pop',
  'charli xcx': 'pop',
  'olivia rodrigo': 'pop',
  'billie eilish': 'pop',
  'madonna': 'pop',
  'katy perry': 'pop',
  'rihanna': 'pop',
  'harry styles': 'pop',
  'sabrina carpenter': 'pop',
  'chappell roan': 'pop',
  'troye sivan': 'pop',
  'britney spears': 'pop',
  'kylie minogue': 'pop',
  'carly rae jepsen': 'pop',
  'lorde': 'pop',
  'marina': 'pop',
  'kim petras': 'pop',
  'tate mcrae': 'pop',
  'kesha': 'pop',
  'shakira': 'pop',
  'mariah carey': 'pop',
  'selena gomez': 'pop',
  'demi lovato': 'pop',
  'shawn mendes': 'pop',
  'justin bieber': 'pop',
  'camila cabello': 'pop',
  'sia': 'pop',

  // R&B / Soul
  'sza': 'rnb',
  'the weeknd': 'rnb',
  'frank ocean': 'rnb',
  'brent faiyaz': 'rnb',
  'daniel caesar': 'rnb',
  'steve lacy': 'rnb',
  'summer walker': 'rnb',
  'giveon': 'rnb',
  'jazmine sullivan': 'rnb',
  'kehlani': 'rnb',
  'erykah badu': 'rnb',
  'dangelo': 'rnb',
  "d'angelo": 'rnb',
  'lauryn hill': 'rnb',
  'alicia keys': 'rnb',
  'usher': 'rnb',
  'beyonce': 'rnb',
  'beyoncé': 'rnb',
  'solange': 'rnb',
  'jhene aiko': 'rnb',
  'chloe x halle': 'rnb',
  'victoria monet': 'rnb',
  'tinashe': 'rnb',
  'snoh aalegra': 'rnb',
  'masego': 'rnb',
  'ravyn lenae': 'rnb',
  'cleo sol': 'rnb',
  'sampha': 'rnb',
  'siptah': 'rnb',
  'partynextdoor': 'rnb',
  'bryson tiller': 'rnb',
  'dvsn': 'rnb',
  '6lack': 'rnb',

  // Hip-Hop / Rap
  'kendrick lamar': 'hiphop',
  'drake': 'hiphop',
  'travis scott': 'hiphop',
  'kanye west': 'hiphop',
  'j. cole': 'hiphop',
  'tyler, the creator': 'hiphop',
  'future': 'hiphop',
  'playboi carti': 'hiphop',
  'mac miller': 'hiphop',
  'metro boomin': 'hiphop',
  '21 savage': 'hiphop',
  'asap rocky': 'hiphop',
  'a$ap rocky': 'hiphop',
  'post malone': 'hiphop',
  'childish gambino': 'hiphop',
  'eminem': 'hiphop',
  'jay-z': 'hiphop',
  'outkast': 'hiphop',
  'gunna': 'hiphop',
  'lil baby': 'hiphop',
  'lil uzi vert': 'hiphop',
  'young thug': 'hiphop',
  'jid': 'hiphop',
  'denzel curry': 'hiphop',
  'earl sweatshirt': 'hiphop',
  'vince staples': 'hiphop',
  'nas': 'hiphop',
  'the notorious b.i.g.': 'hiphop',
  '2pac': 'hiphop',
  'tupac': 'hiphop',
  'wu-tang clan': 'hiphop',
  'mf doom': 'hiphop',
  'schoolboy q': 'hiphop',
  'pusha t': 'hiphop',
  'megan thee stallion': 'hiphop',
  'cardi b': 'hiphop',
  'nicki minaj': 'hiphop',
  'ice spice': 'hiphop',
  'doja cat': 'hiphop',

  // Electronic / Synthwave
  kavinsky: 'electronic',
  'daft punk': 'electronic',
  justice: 'electronic',
  'carpenter brut': 'electronic',
  gunship: 'electronic',
  'the midnight': 'electronic',
  lorn: 'electronic',
  'deadmau5': 'electronic',
  'aphex twin': 'electronic',
  'gesaffelstein': 'electronic',
  'm|o|o|n': 'electronic',
  'tangerine dream': 'electronic',
  'fred again..': 'electronic',
  'skrillex': 'electronic',
  'disclosure': 'electronic',
  'four tet': 'electronic',
  'bicep': 'electronic',
  'calvin harris': 'electronic',
  'avicii': 'electronic',
  'kraftwerk': 'electronic',
  'lane 8': 'electronic',
  'rufus du sol': 'electronic',
  'odesza': 'electronic',
  'flume': 'electronic',
  'boards of canada': 'electronic',
  'synthwave': 'electronic',
  'kaytranada': 'electronic',
  'peggy gou': 'electronic',
  'overmono': 'electronic',
  'jamie xx': 'electronic',

  // Rock & Alternative
  'radiohead': 'rock',
  'arctic monkeys': 'rock',
  'tame impala': 'rock',
  'the strokes': 'rock',
  'pink floyd': 'rock',
  'nirvana': 'rock',
  'deftones': 'rock',
  'queens of the stone age': 'rock',
  'fountain dc': 'rock',
  'fontaines d.c.': 'rock',
  'the cure': 'rock',
  'the smiths': 'rock',
  'joy division': 'rock',
  'new order': 'rock',
  'interpol': 'rock',
  'foo fighters': 'rock',
  'red hot chili peppers': 'rock',
  'muse': 'rock',
  'gorillaz': 'rock',
  'the white stripes': 'rock',
  'oasis': 'rock',
  'led zeppelin': 'rock',
  'the beatles': 'rock',
  'david bowie': 'rock',
  'fleetwood mac': 'rock',
  'paramore': 'rock',
  'fall out boy': 'rock',
  'my chemical romance': 'rock',
  'green day': 'rock',
  'blink-182': 'rock',
  'weezer': 'rock',
  'the 1975': 'rock',

  // Indie & Folk
  'phoebe bridgers': 'indie',
  'bon iver': 'indie',
  'fleet foxes': 'indie',
  'boygenius': 'indie',
  'sufjan stevens': 'indie',
  'mitski': 'indie',
  'clairo': 'indie',
  'mac demarco': 'indie',
  'beabadoobee': 'indie',
  'men i trust': 'indie',
  'alvvays': 'indie',
  'japanese breakfast': 'indie',
  'big thief': 'indie',
  'beach house': 'indie',
  'snail mail': 'indie',
  'soccer mommy': 'indie',
  'julien baker': 'indie',
  'lucy dacus': 'indie',
  'adrianne lenker': 'indie',
  'faye webster': 'indie',
  'father john misty': 'indie',
  'arcade fire': 'indie',

  // Metal & Hardcore
  'metallica': 'metal',
  'iron maiden': 'metal',
  'slipknot': 'metal',
  'ghost': 'metal',
  'gojira': 'metal',
  'bring me the horizon': 'metal',
  'system of a down': 'metal',
  'mastodon': 'metal',
  'judas priest': 'metal',
  'blacksabbath': 'metal',
  'black sabbath': 'metal',
  'rammstein': 'metal',
  'avenged sevenfold': 'metal',
  'architects': 'metal',
  'bad omens': 'metal',
  'sleep token': 'metal',
  'lorna shore': 'metal',

  // Jazz, Soul & Funk
  'miles davis': 'jazz_soul',
  'john coltrane': 'jazz_soul',
  'stevie wonder': 'jazz_soul',
  'michael jackson': 'jazz_soul',
  'earth, wind & fire': 'jazz_soul',
  'kamasi washington': 'jazz_soul',
  'thundercat': 'jazz_soul',
  'khruangbin': 'jazz_soul',
  'leon bridges': 'jazz_soul',
  'snarky puppy': 'jazz_soul',
  'chet baker': 'jazz_soul',
  'bill evans': 'jazz_soul',
  'herbie hancock': 'jazz_soul',
  'norah jones': 'jazz_soul',
  'robert glasper': 'jazz_soul',

  // Latin
  'bad bunny': 'latin',
  'rosalía': 'latin',
  'rosalia': 'latin',
  'j balvin': 'latin',
  'peso pluma': 'latin',
  'rauw alejandro': 'latin',
  'karol g': 'latin',
  'kali uchis': 'latin',
  'feid': 'latin',
  'anuel aa': 'latin',
  'ozuna': 'latin',
  'maluma': 'latin',
  'becky g': 'latin',

  // Country & Americana
  'morgan wallen': 'country',
  'luke combs': 'country',
  'zach bryan': 'country',
  'kacey musgraves': 'country',
  'chris stapleton': 'country',
  'tyler childers': 'country',
  'dolly parton': 'country',
  'johnny cash': 'country',
  'willie nelson': 'country',
  'jason isbell': 'country',
  'sturgill simpson': 'country',
  'orville peck': 'country',

  // K-Pop / J-Pop
  'bts': 'kpop_jpop',
  'blackpink': 'kpop_jpop',
  'newjeans': 'kpop_jpop',
  'twice': 'kpop_jpop',
  'yoasobi': 'kpop_jpop',
  'aespa': 'kpop_jpop',
  'stray kids': 'kpop_jpop',
  'le sserafim': 'kpop_jpop',
  'illit': 'kpop_jpop',
  'seventeen': 'kpop_jpop',
  'ive': 'kpop_jpop',
  'enhypen': 'kpop_jpop',

  // Ambient / Classical
  'hans zimmer': 'ambient_classical',
  'max richter': 'ambient_classical',
  'brian eno': 'ambient_classical',
  'ludovico einaudi': 'ambient_classical',
  'philip glass': 'ambient_classical',
  'olafor arnalds': 'ambient_classical',
  'olafur arnalds': 'ambient_classical',
  'johann johannsson': 'ambient_classical',
  'stars of the lid': 'ambient_classical',
  'tim hecker': 'ambient_classical',
  'william basinski': 'ambient_classical',
};

// In-memory / LocalStorage cache for dynamically fetched Last.fm artist and track tags
const TAG_CACHE_KEY = 'yourhot100_genre_tag_cache';
let dynamicTagCache: Record<string, string> = {};

try {
  const saved = localStorage.getItem(TAG_CACHE_KEY);
  if (saved) {
    dynamicTagCache = JSON.parse(saved);
  }
} catch (e) {}

function saveTagCache() {
  try {
    localStorage.setItem(TAG_CACHE_KEY, JSON.stringify(dynamicTagCache));
  } catch (e) {}
}

/**
 * Maps a list of raw Last.fm tags to a canonical genre key.
 * Strictly separates POP, RNB, and HIP-HOP.
 */
export function mapLastfmTagsToGenre(tags: string[]): string {
  const normalized = tags.map((t) => t.toLowerCase().trim());

  for (const tag of normalized) {
    // 1. Electronic / Synthwave / Dance
    if (
      tag.includes('synth') ||
      tag.includes('electronic') ||
      tag.includes('electro') ||
      tag.includes('darksynth') ||
      tag.includes('outrun') ||
      tag.includes('house') ||
      tag.includes('techno') ||
      tag.includes('edm') ||
      tag.includes('dance') ||
      tag.includes('trance') ||
      tag.includes('drum and bass') ||
      tag.includes('ambient electronic')
    ) {
      return 'electronic';
    }

    // 2. K-Pop / J-Pop
    if (
      tag.includes('k-pop') ||
      tag.includes('kpop') ||
      tag.includes('j-pop') ||
      tag.includes('jpop') ||
      tag.includes('c-pop') ||
      tag.includes('anime')
    ) {
      return 'kpop_jpop';
    }

    // 3. R&B / Soul (Explicitly separate from Hip-Hop)
    if (
      tag.includes('rnb') ||
      tag.includes('r&b') ||
      tag.includes('contemporary r&b') ||
      tag.includes('neo-soul') ||
      tag.includes('soul') ||
      tag.includes('motown') ||
      tag.includes('quiet storm')
    ) {
      return 'rnb';
    }

    // 4. Hip-Hop / Rap (Explicitly separate from R&B)
    if (
      tag.includes('hip-hop') ||
      tag.includes('hip hop') ||
      tag.includes('rap') ||
      tag.includes('trap') ||
      tag.includes('drill') ||
      tag.includes('boom bap') ||
      tag.includes('gangsta rap') ||
      tag.includes('grime')
    ) {
      return 'hiphop';
    }

    // 5. Metal / Hardcore
    if (
      tag.includes('metal') ||
      tag.includes('hardcore') ||
      tag.includes('deathcore') ||
      tag.includes('thrash') ||
      tag.includes('heavy metal') ||
      tag.includes('metalcore')
    ) {
      return 'metal';
    }

    // 6. Rock / Alternative
    if (
      tag.includes('rock') ||
      tag.includes('alternative rock') ||
      tag.includes('alt-rock') ||
      tag.includes('punk') ||
      tag.includes('grunge') ||
      tag.includes('post-punk') ||
      tag.includes('hard rock')
    ) {
      return 'rock';
    }

    // 7. Indie / Folk
    if (
      tag.includes('indie') ||
      tag.includes('folk') ||
      tag.includes('singer-songwriter') ||
      tag.includes('acoustic') ||
      tag.includes('shoegaze') ||
      tag.includes('dream pop') ||
      tag.includes('indie pop')
    ) {
      return 'indie';
    }

    // 8. Latin
    if (
      tag.includes('latin') ||
      tag.includes('reggaeton') ||
      tag.includes('salsa') ||
      tag.includes('bachata') ||
      tag.includes('flamenco') ||
      tag.includes('urbano latino')
    ) {
      return 'latin';
    }

    // 9. Country / Americana
    if (
      tag.includes('country') ||
      tag.includes('americana') ||
      tag.includes('bluegrass') ||
      tag.includes('alt-country')
    ) {
      return 'country';
    }

    // 10. Jazz / Blues
    if (
      tag.includes('jazz') ||
      tag.includes('funk') ||
      tag.includes('blues') ||
      tag.includes('fusion') ||
      tag.includes('bop')
    ) {
      return 'jazz_soul';
    }

    // 11. Ambient / Classical
    if (
      tag.includes('ambient') ||
      tag.includes('classical') ||
      tag.includes('soundtrack') ||
      tag.includes('orchestral') ||
      tag.includes('instrumental') ||
      tag.includes('score') ||
      tag.includes('neoclassical')
    ) {
      return 'ambient_classical';
    }

    // 12. Pop
    if (
      tag.includes('pop') ||
      tag.includes('dance-pop') ||
      tag.includes('electropop') ||
      tag.includes('synthpop') ||
      tag.includes('hyperpop') ||
      tag.includes('teen pop') ||
      tag.includes('mainstream')
    ) {
      return 'pop';
    }
  }

  return 'other';
}

/**
 * Resolves the genre for a given artist and track.
 */
export function resolveGenre(artist: string, trackTitle?: string): string {
  const cleanArtist = artist.trim().toLowerCase();

  // 1. Direct dictionary match
  if (ARTIST_GENRE_MAP[cleanArtist]) {
    return ARTIST_GENRE_MAP[cleanArtist];
  }

  // 2. Dynamic Tag Cache match
  if (dynamicTagCache[cleanArtist]) {
    return dynamicTagCache[cleanArtist];
  }

  // 3. Fallback Heuristics from keywords
  if (
    cleanArtist.includes('orchestra') ||
    cleanArtist.includes('philharmonic') ||
    cleanArtist.includes('quartet')
  ) {
    return 'ambient_classical';
  }
  if (
    cleanArtist.includes('synth') ||
    cleanArtist.includes('wave') ||
    cleanArtist.includes('electro') ||
    cleanArtist.includes('dj ')
  ) {
    return 'electronic';
  }
  if (
    cleanArtist.includes('lil ') ||
    cleanArtist.includes('young ') ||
    cleanArtist.includes('mc ') ||
    cleanArtist.includes('big ') ||
    cleanArtist.includes('yung ')
  ) {
    return 'hiphop';
  }
  if (cleanArtist.includes('the ') && !cleanArtist.includes('weeknd')) {
    return 'rock';
  }

  return 'pop'; // Default modern fallback
}

/**
 * Check if a genre is classified as Non-Pop
 */
export function isNonPopGenre(genreKey: string): boolean {
  return genreKey !== 'pop' && genreKey !== 'kpop_jpop';
}

/**
 * Fetch Last.fm top tags for a set of artists and update dynamic cache
 */
export async function enrichGenresFromLastfm(
  artists: string[],
  customApiKey?: string
): Promise<number> {
  const API_KEY_POOL = [
    customApiKey?.trim(),
    'b25b959554ed7605827dddb7961140ec',
    'c7429188e406f52e5052981ce81b0a88',
    '4cb0e3a5b4dc88c35b612147d6f3c6c0',
    '4437a346ef2741544a49c6691c95b6c3',
  ].filter((k): k is string => Boolean(k && k.length > 5));

  let enrichedCount = 0;
  const uniqueArtists = Array.from(new Set(artists.map((a) => a.trim()))).slice(0, 20);

  for (const artist of uniqueArtists) {
    const key = artist.toLowerCase();
    if (dynamicTagCache[key] || ARTIST_GENRE_MAP[key]) continue;

    for (const apiKey of API_KEY_POOL) {
      try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(
          artist
        )}&api_key=${apiKey}&format=json&autocorrect=1`;

        const res = await fetch(url);
        const data = await res.json().catch(() => null);

        if (data?.toptags?.tag && Array.isArray(data.toptags.tag)) {
          const tagNames = data.toptags.tag.map((t: any) => t.name || '').filter(Boolean);
          const resolved = mapLastfmTagsToGenre(tagNames);
          if (resolved && resolved !== 'other') {
            dynamicTagCache[key] = resolved;
            enrichedCount++;
            break;
          }
        }
      } catch (e) {}
    }
  }

  if (enrichedCount > 0) {
    saveTagCache();
  }

  return enrichedCount;
}

/**
 * Computes Top 5 Songs and Top 5 Albums for every active genre for the selected week.
 * Enforces:
 * - 3-song minimum catalog qualification for debut/existing albums
 * - At least a single play to chart
 * - Full Top 5 tracks and Top 5 albums with no blank spaces (backfilled from catalog if needed)
 */
export function computeWeeklyGenreCharts(
  weekScrobbles: Scrobble[],
  mergedMap: Record<string, string> = {},
  allScrobbles?: Scrobble[]
): GenreWeekData[] {
  const catalogScrobbles = allScrobbles && allScrobbles.length > 0 ? allScrobbles : weekScrobbles;
  if (!catalogScrobbles || catalogScrobbles.length === 0) return [];

  const photoCache = getPhotoCacheSnapshot();

  // 1. Build catalog tracks map across overall history to check the 3-song album qualification
  const albumCatalogTracksMap = new Map<string, Set<string>>();
  for (const s of catalogScrobbles) {
    if (!s.album || s.album.trim().length === 0) continue;
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const normA = normalizeStrict(primaryArtist);
    const normAlb = normalizeStrict(normalizeAlbumTitle(s.album));
    const albKey = `${normA}:::${normAlb}`;
    if (!albumCatalogTracksMap.has(albKey)) {
      albumCatalogTracksMap.set(albKey, new Set());
    }
    const cleanTrackTitle = normalizeStrict(normalizeTrackTitle(s.title));
    if (cleanTrackTitle) {
      albumCatalogTracksMap.get(albKey)!.add(cleanTrackTitle);
    }
  }

  // 2. Pre-index overall catalog tracks and albums by genre for zero-space backfilling
  const genreCatalogTracksMap = new Map<
    string,
    Map<
      string,
      {
        title: string;
        artist: string;
        album?: string;
        playCount: number;
        coverArt: string;
        _key: string;
      }
    >
  >();

  const genreCatalogAlbumsMap = new Map<
    string,
    Map<
      string,
      {
        title: string;
        artist: string;
        playCount: number;
        coverArt: string;
        tracksCount: number;
        _key: string;
      }
    >
  >();

  const globalCatalogTracks: {
    title: string;
    artist: string;
    album?: string;
    playCount: number;
    coverArt: string;
    _key: string;
  }[] = [];

  const globalCatalogAlbums: {
    title: string;
    artist: string;
    playCount: number;
    coverArt: string;
    tracksCount: number;
    _key: string;
  }[] = [];

  for (const s of catalogScrobbles) {
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const genreKey = resolveGenre(primaryArtist, s.title);
    const rawTrackKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const mappedTitle = mergedMap[rawTrackKey] || s.title;
    const trackKey = `${primaryArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`;

    if (!genreCatalogTracksMap.has(genreKey)) {
      genreCatalogTracksMap.set(genreKey, new Map());
    }
    const trkMap = genreCatalogTracksMap.get(genreKey)!;
    const cachedTrackPhoto = photoCache.tracks[trackKey];
    const trackCover =
      cachedTrackPhoto ||
      s.coverArt ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';

    if (!trkMap.has(trackKey)) {
      trkMap.set(trackKey, {
        title: mappedTitle,
        artist: primaryArtist,
        album: s.album,
        playCount: 1,
        coverArt: trackCover,
        _key: trackKey,
      });
    } else {
      const ent = trkMap.get(trackKey)!;
      ent.playCount += 1;
      if (!ent.coverArt && trackCover) ent.coverArt = trackCover;
    }

    if (s.album && s.album.trim().length > 0) {
      const normA = normalizeStrict(primaryArtist);
      const normAlb = normalizeStrict(normalizeAlbumTitle(s.album));
      const albKey = `${normA}:::${normAlb}`;
      const totalCatTracks = albumCatalogTracksMap.get(albKey)?.size || 0;

      // Album qualification: minimum 3 distinct tracks across the catalog
      if (totalCatTracks >= 3) {
        if (!genreCatalogAlbumsMap.has(genreKey)) {
          genreCatalogAlbumsMap.set(genreKey, new Map());
        }
        const albMap = genreCatalogAlbumsMap.get(genreKey)!;
        const albumCacheKey = `${primaryArtist.toLowerCase()}:::${s.album.toLowerCase()}`;
        const cachedAlbumPhoto = photoCache.albums[albumCacheKey];
        const albCover =
          cachedAlbumPhoto ||
          s.coverArt ||
          'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80';

        if (!albMap.has(albKey)) {
          albMap.set(albKey, {
            title: s.album.trim(),
            artist: primaryArtist.trim(),
            playCount: 1,
            coverArt: albCover,
            tracksCount: totalCatTracks,
            _key: albKey,
          });
        } else {
          const ent = albMap.get(albKey)!;
          ent.playCount += 1;
          if (!ent.coverArt && albCover) ent.coverArt = albCover;
        }
      }
    }
  }

  // Pre-sort global fallbacks
  genreCatalogTracksMap.forEach((map) => {
    map.forEach((val) => globalCatalogTracks.push(val));
  });
  globalCatalogTracks.sort((a, b) => b.playCount - a.playCount);

  genreCatalogAlbumsMap.forEach((map) => {
    map.forEach((val) => globalCatalogAlbums.push(val));
  });
  globalCatalogAlbums.sort((a, b) => b.playCount - a.playCount);

  // 3. Process current week's scrobbles
  const weekGenreScrobblesMap: Map<string, Scrobble[]> = new Map();
  const totalWeekPlays = Math.max(1, weekScrobbles.length);

  for (const s of weekScrobbles) {
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const genreKey = resolveGenre(primaryArtist, s.title);
    if (!weekGenreScrobblesMap.has(genreKey)) {
      weekGenreScrobblesMap.set(genreKey, []);
    }
    weekGenreScrobblesMap.get(genreKey)!.push(s);
  }

  // Determine all genres to include (prioritize active week genres, then core/catalog genres)
  const allGenreKeys = new Set<string>([
    ...Array.from(weekGenreScrobblesMap.keys()),
    'pop',
    'rnb',
    'hiphop',
    'rock',
    'electronic',
    'indie',
    ...Array.from(genreCatalogTracksMap.keys()),
  ]);

  const result: GenreWeekData[] = [];

  for (const genreKey of allGenreKeys) {
    const meta = GENRE_METADATA[genreKey] || GENRE_METADATA.other;
    const scrobblesList = weekGenreScrobblesMap.get(genreKey) || [];

    // 1. Compute Tracks for this genre in the week
    const trackPlayMap: Map<
      string,
      {
        title: string;
        artist: string;
        album?: string;
        playCount: number;
        coverArt: string;
        _key: string;
      }
    > = new Map();

    for (const s of scrobblesList) {
      const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
      const rawKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
      const mappedTitle = mergedMap[rawKey] || s.title;
      const key = `${primaryArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`;

      const cachedPhoto = photoCache.tracks[key];
      const cover =
        cachedPhoto ||
        s.coverArt ||
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';

      if (!trackPlayMap.has(key)) {
        trackPlayMap.set(key, {
          title: mappedTitle,
          artist: primaryArtist,
          album: s.album,
          playCount: 1,
          coverArt: cover,
          _key: key,
        });
      } else {
        const existing = trackPlayMap.get(key)!;
        existing.playCount += 1;
        if (!existing.coverArt && s.coverArt) existing.coverArt = s.coverArt;
      }
    }

    const weeklyTracksSorted = Array.from(trackPlayMap.values()).sort(
      (a, b) => b.playCount - a.playCount
    );

    // ZERO SPACES ALLOWED: Backfill remaining spots up to 5 tracks
    const selectedTracks: {
      title: string;
      artist: string;
      album?: string;
      playCount: number;
      coverArt: string;
      _key: string;
    }[] = [...weeklyTracksSorted];

    const seenTrackKeys = new Set(selectedTracks.map((t) => t._key));

    // Fill from genre catalog first
    const genreCatalogTracksList = Array.from(
      genreCatalogTracksMap.get(genreKey)?.values() || []
    ).sort((a, b) => b.playCount - a.playCount);

    for (const catTrack of genreCatalogTracksList) {
      if (selectedTracks.length >= 5) break;
      if (!seenTrackKeys.has(catTrack._key)) {
        seenTrackKeys.add(catTrack._key);
        selectedTracks.push({
          ...catTrack,
          playCount: Math.max(1, catTrack.playCount), // single play minimum
        });
      }
    }

    // Fill from global catalog if genre catalog has fewer than 5
    for (const gTrack of globalCatalogTracks) {
      if (selectedTracks.length >= 5) break;
      if (!seenTrackKeys.has(gTrack._key)) {
        seenTrackKeys.add(gTrack._key);
        selectedTracks.push({
          ...gTrack,
          playCount: Math.max(1, gTrack.playCount),
        });
      }
    }

    const top5Tracks = selectedTracks.slice(0, 5).map((item, idx) => ({
      rank: idx + 1,
      title: item.title,
      artist: item.artist,
      album: item.album,
      playCount: item.playCount,
      points: Math.max(1, 101 - (idx + 1)),
      coverArt: item.coverArt,
      moveStatus: (idx === 0 ? 'up' : 'flat') as 'up' | 'flat',
    }));

    // 2. Compute Albums for this genre in the week
    const albumPlayMap: Map<
      string,
      {
        title: string;
        artist: string;
        playCount: number;
        tracksCount: number;
        coverArt: string;
        _key: string;
      }
    > = new Map();

    for (const s of scrobblesList) {
      if (!s.album || s.album.trim().length === 0) continue;
      const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
      const normA = normalizeStrict(primaryArtist);
      const normAlb = normalizeStrict(normalizeAlbumTitle(s.album));
      const albKey = `${normA}:::${normAlb}`;

      // Check minimum 3 tracks catalog qualification
      const totalCatTracks = albumCatalogTracksMap.get(albKey)?.size || 0;
      if (totalCatTracks < 3) continue;

      const albumCacheKey = `${primaryArtist.toLowerCase()}:::${s.album.toLowerCase()}`;
      const cachedPhoto = photoCache.albums[albumCacheKey];
      const cover =
        cachedPhoto ||
        s.coverArt ||
        'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80';

      if (!albumPlayMap.has(albKey)) {
        albumPlayMap.set(albKey, {
          title: s.album.trim(),
          artist: primaryArtist.trim(),
          playCount: 1,
          tracksCount: totalCatTracks,
          coverArt: cover,
          _key: albKey,
        });
      } else {
        const entry = albumPlayMap.get(albKey)!;
        entry.playCount += 1;
        if (!entry.coverArt && s.coverArt) entry.coverArt = s.coverArt;
      }
    }

    const weeklyAlbumsSorted = Array.from(albumPlayMap.values()).sort(
      (a, b) => b.playCount - a.playCount
    );

    // ZERO SPACES ALLOWED: Backfill remaining spots up to 5 albums
    const selectedAlbums: {
      title: string;
      artist: string;
      playCount: number;
      tracksCount: number;
      coverArt: string;
      _key: string;
    }[] = [...weeklyAlbumsSorted];

    const seenAlbumKeys = new Set(selectedAlbums.map((a) => a._key));

    // Fill from genre catalog albums first
    const genreCatalogAlbumsList = Array.from(
      genreCatalogAlbumsMap.get(genreKey)?.values() || []
    ).sort((a, b) => b.playCount - a.playCount);

    for (const catAlbum of genreCatalogAlbumsList) {
      if (selectedAlbums.length >= 5) break;
      if (!seenAlbumKeys.has(catAlbum._key)) {
        seenAlbumKeys.add(catAlbum._key);
        selectedAlbums.push({
          ...catAlbum,
          playCount: Math.max(1, catAlbum.playCount),
        });
      }
    }

    // Fill from global catalog albums if genre has fewer than 5
    for (const gAlbum of globalCatalogAlbums) {
      if (selectedAlbums.length >= 5) break;
      if (!seenAlbumKeys.has(gAlbum._key)) {
        seenAlbumKeys.add(gAlbum._key);
        selectedAlbums.push({
          ...gAlbum,
          playCount: Math.max(1, gAlbum.playCount),
        });
      }
    }

    const top5Albums = selectedAlbums.slice(0, 5).map((item, idx) => ({
      rank: idx + 1,
      title: item.title,
      artist: item.artist,
      playCount: item.playCount,
      points: Math.max(1, 101 - (idx + 1)),
      coverArt: item.coverArt,
      tracksCount: item.tracksCount,
    }));

    // Calculate weekly plays for this genre
    const totalGenrePlays = scrobblesList.length;

    result.push({
      genre: genreKey,
      displayName: meta.name,
      color: meta.color,
      iconName: genreKey,
      totalPlays: totalGenrePlays,
      sharePct: Math.round((totalGenrePlays / totalWeekPlays) * 100),
      top5Tracks,
      top5Albums,
    });
  }

  // Sort genres by highest weekly plays descending, keeping primary genres easily accessible
  return result.sort((a, b) => {
    if (b.totalPlays !== a.totalPlays) return b.totalPlays - a.totalPlays;
    return 0;
  });
}

/**
 * Computes an aggregated Non-Pop weekly chart (combining all non-pop scrobbles).
 * Enforces 3-song minimum catalog qualification and full 5-10 tracks/albums with no blank spaces.
 */
export function computeWeeklyNonPopAggregateChart(
  weekScrobbles: Scrobble[],
  mergedMap: Record<string, string> = {},
  allScrobbles?: Scrobble[]
): GenreWeekData | null {
  const catalogScrobbles = allScrobbles && allScrobbles.length > 0 ? allScrobbles : weekScrobbles;
  if (!catalogScrobbles || catalogScrobbles.length === 0) return null;

  const photoCache = getPhotoCacheSnapshot();

  // 1. Build catalog tracks map across overall history for 3-song album qualification
  const albumCatalogTracksMap = new Map<string, Set<string>>();
  for (const s of catalogScrobbles) {
    if (!s.album || s.album.trim().length === 0) continue;
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const normA = normalizeStrict(primaryArtist);
    const normAlb = normalizeStrict(normalizeAlbumTitle(s.album));
    const albKey = `${normA}:::${normAlb}`;
    if (!albumCatalogTracksMap.has(albKey)) {
      albumCatalogTracksMap.set(albKey, new Set());
    }
    const cleanTrackTitle = normalizeStrict(normalizeTrackTitle(s.title));
    if (cleanTrackTitle) {
      albumCatalogTracksMap.get(albKey)!.add(cleanTrackTitle);
    }
  }

  // 2. Pre-index Non-Pop catalog items
  const nonPopCatalogTracks: {
    title: string;
    artist: string;
    album?: string;
    playCount: number;
    coverArt: string;
    _key: string;
  }[] = [];

  const nonPopCatalogAlbums: {
    title: string;
    artist: string;
    playCount: number;
    coverArt: string;
    tracksCount: number;
    _key: string;
  }[] = [];

  const catalogTrackMap = new Map<string, (typeof nonPopCatalogTracks)[0]>();
  const catalogAlbumMap = new Map<string, (typeof nonPopCatalogAlbums)[0]>();

  for (const s of catalogScrobbles) {
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const genreKey = resolveGenre(primaryArtist, s.title);
    if (!isNonPopGenre(genreKey)) continue;

    const rawTrackKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const mappedTitle = mergedMap[rawTrackKey] || s.title;
    const trackKey = `${primaryArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`;
    const cachedPhoto = photoCache.tracks[trackKey];
    const trackCover =
      cachedPhoto ||
      s.coverArt ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';

    if (!catalogTrackMap.has(trackKey)) {
      catalogTrackMap.set(trackKey, {
        title: mappedTitle,
        artist: primaryArtist,
        album: s.album,
        playCount: 1,
        coverArt: trackCover,
        _key: trackKey,
      });
    } else {
      catalogTrackMap.get(trackKey)!.playCount += 1;
    }

    if (s.album && s.album.trim().length > 0) {
      const normA = normalizeStrict(primaryArtist);
      const normAlb = normalizeStrict(normalizeAlbumTitle(s.album));
      const albKey = `${normA}:::${normAlb}`;
      const totalCatTracks = albumCatalogTracksMap.get(albKey)?.size || 0;
      if (totalCatTracks >= 3) {
        const albumCacheKey = `${primaryArtist.toLowerCase()}:::${s.album.toLowerCase()}`;
        const cachedAlbumPhoto = photoCache.albums[albumCacheKey];
        const albCover =
          cachedAlbumPhoto ||
          s.coverArt ||
          'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80';

        if (!catalogAlbumMap.has(albKey)) {
          catalogAlbumMap.set(albKey, {
            title: s.album.trim(),
            artist: primaryArtist.trim(),
            playCount: 1,
            coverArt: albCover,
            tracksCount: totalCatTracks,
            _key: albKey,
          });
        } else {
          catalogAlbumMap.get(albKey)!.playCount += 1;
        }
      }
    }
  }

  catalogTrackMap.forEach((v) => nonPopCatalogTracks.push(v));
  nonPopCatalogTracks.sort((a, b) => b.playCount - a.playCount);

  catalogAlbumMap.forEach((v) => nonPopCatalogAlbums.push(v));
  nonPopCatalogAlbums.sort((a, b) => b.playCount - a.playCount);

  const nonPopScrobbles = weekScrobbles.filter((s) => {
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    return isNonPopGenre(resolveGenre(primaryArtist, s.title));
  });

  const totalWeekPlays = Math.max(1, weekScrobbles.length);

  // 1. Top Tracks in Non-Pop for this week
  const trackPlayMap: Map<
    string,
    {
      title: string;
      artist: string;
      album?: string;
      playCount: number;
      coverArt: string;
      _key: string;
    }
  > = new Map();

  for (const s of nonPopScrobbles) {
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const rawKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
    const mappedTitle = mergedMap[rawKey] || s.title;
    const key = `${primaryArtist.toLowerCase()}:::${mappedTitle.toLowerCase()}`;
    const cachedPhoto = photoCache.tracks[key];
    const cover =
      cachedPhoto ||
      s.coverArt ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop&q=80';

    if (!trackPlayMap.has(key)) {
      trackPlayMap.set(key, {
        title: mappedTitle,
        artist: primaryArtist,
        album: s.album,
        playCount: 1,
        coverArt: cover,
        _key: key,
      });
    } else {
      const existing = trackPlayMap.get(key)!;
      existing.playCount += 1;
      if (!existing.coverArt && s.coverArt) existing.coverArt = s.coverArt;
    }
  }

  const weeklyNonPopTracksSorted = Array.from(trackPlayMap.values()).sort(
    (a, b) => b.playCount - a.playCount
  );

  const selectedNonPopTracks: (typeof weeklyNonPopTracksSorted)[0][] = [
    ...weeklyNonPopTracksSorted,
  ];
  const seenNonPopTrackKeys = new Set(selectedNonPopTracks.map((t) => t._key));

  for (const catTrack of nonPopCatalogTracks) {
    if (selectedNonPopTracks.length >= 10) break;
    if (!seenNonPopTrackKeys.has(catTrack._key)) {
      seenNonPopTrackKeys.add(catTrack._key);
      selectedNonPopTracks.push({
        ...catTrack,
        playCount: Math.max(1, catTrack.playCount),
      });
    }
  }

  const top5Tracks = selectedNonPopTracks.slice(0, 10).map((item, idx) => ({
    rank: idx + 1,
    title: item.title,
    artist: item.artist,
    album: item.album,
    playCount: item.playCount,
    points: Math.max(1, 101 - (idx + 1)),
    coverArt: item.coverArt,
    moveStatus: (idx === 0 ? 'up' : 'flat') as 'up' | 'flat',
  }));

  // 2. Top Albums in Non-Pop for this week
  const albumPlayMap: Map<
    string,
    {
      title: string;
      artist: string;
      playCount: number;
      tracksCount: number;
      coverArt: string;
      _key: string;
    }
  > = new Map();

  for (const s of nonPopScrobbles) {
    if (!s.album || s.album.trim().length === 0) continue;
    const primaryArtist = splitArtistList(s.artist)[0] || s.artist;
    const normA = normalizeStrict(primaryArtist);
    const normAlb = normalizeStrict(normalizeAlbumTitle(s.album));
    const albKey = `${normA}:::${normAlb}`;

    const totalCatTracks = albumCatalogTracksMap.get(albKey)?.size || 0;
    if (totalCatTracks < 3) continue;

    const albumCacheKey = `${primaryArtist.toLowerCase()}:::${s.album.toLowerCase()}`;
    const cachedPhoto = photoCache.albums[albumCacheKey];
    const cover =
      cachedPhoto ||
      s.coverArt ||
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&q=80';

    if (!albumPlayMap.has(albKey)) {
      albumPlayMap.set(albKey, {
        title: s.album.trim(),
        artist: primaryArtist.trim(),
        playCount: 1,
        tracksCount: totalCatTracks,
        coverArt: cover,
        _key: albKey,
      });
    } else {
      const entry = albumPlayMap.get(albKey)!;
      entry.playCount += 1;
      if (!entry.coverArt && s.coverArt) entry.coverArt = s.coverArt;
    }
  }

  const weeklyNonPopAlbumsSorted = Array.from(albumPlayMap.values()).sort(
    (a, b) => b.playCount - a.playCount
  );

  const selectedNonPopAlbums: (typeof weeklyNonPopAlbumsSorted)[0][] = [
    ...weeklyNonPopAlbumsSorted,
  ];
  const seenNonPopAlbumKeys = new Set(selectedNonPopAlbums.map((a) => a._key));

  for (const catAlbum of nonPopCatalogAlbums) {
    if (selectedNonPopAlbums.length >= 10) break;
    if (!seenNonPopAlbumKeys.has(catAlbum._key)) {
      seenNonPopAlbumKeys.add(catAlbum._key);
      selectedNonPopAlbums.push({
        ...catAlbum,
        playCount: Math.max(1, catAlbum.playCount),
      });
    }
  }

  const top5Albums = selectedNonPopAlbums.slice(0, 10).map((item, idx) => ({
    rank: idx + 1,
    title: item.title,
    artist: item.artist,
    playCount: item.playCount,
    points: Math.max(1, 101 - (idx + 1)),
    coverArt: item.coverArt,
    tracksCount: item.tracksCount,
  }));

  return {
    genre: 'non_pop_aggregate',
    displayName: 'Non-Pop Overall Hot Chart',
    color: '#8b5cf6',
    iconName: 'non_pop',
    totalPlays: nonPopScrobbles.length,
    sharePct: Math.round((nonPopScrobbles.length / totalWeekPlays) * 100),
    top5Tracks,
    top5Albums,
  };
}

export interface GenreChartPerformance {
  genreKey: string;
  genreDisplayName: string;
  genreColor: string;
  genreGradient: string;
  isNonPop: boolean;
  peakRank: number;
  weeksAtNumberOne: number;
  totalWeeksOnChart: number;
  top5Weeks: number;
  top10Weeks: number;
  currentRank: number | null;
  firstWeekNumber: number;
  peakWeekNumber: number;
  summaryText: string;
  shortBadge: string;
  allWeeklyRanks: Array<{ weekNumber: number; rank: number; plays: number }>;
}

// In-memory cache for fast repeated queries
const genreHistoryCache = new Map<string, GenreChartPerformance[]>();

/**
 * Computes all genre chart rankings and peak records (e.g. peaked #1 on RNB chart for 7 weeks)
 * across all weekly chart cycles for a specific track or album.
 */
export function computeEntityGenreChartHistory(
  type: 'track' | 'album',
  title: string,
  artist: string,
  allWeeks: ChartWeekInfo[],
  mergedMap: Record<string, string> = {},
  selectedWeekNumber?: number
): GenreChartPerformance[] {
  if (!title || !artist || !allWeeks || allWeeks.length === 0) {
    return [];
  }

  const cacheKey = `${type}:::${artist.toLowerCase()}:::${title.toLowerCase()}:::${allWeeks.length}:::${Object.keys(mergedMap).length}:::${selectedWeekNumber || 0}`;
  if (genreHistoryCache.has(cacheKey)) {
    return genreHistoryCache.get(cacheKey)!;
  }

  const targetArtistNorm = normalizeStrict(artist);
  const targetTitleNorm = type === 'track'
    ? normalizeStrict(normalizeTrackTitle(mergedMap[`${artist.toLowerCase()}:::${title.toLowerCase()}`] || title))
    : normalizeStrict(normalizeAlbumTitle(title));

  const targetFuzzyKey = `${targetArtistNorm}:::${targetTitleNorm}`;

  // If calculating for album, verify qualification (minimum 3 distinct tracks overall)
  const albumOverallTracks = new Map<string, Set<string>>();
  if (type === 'album') {
    for (const week of allWeeks) {
      for (const s of week.scrobbles || []) {
        if (!s.album || s.album.trim().length === 0) continue;
        const key = `${normalizeStrict(s.artist)}:::${normalizeStrict(normalizeAlbumTitle(s.album))}`;
        if (!albumOverallTracks.has(key)) {
          albumOverallTracks.set(key, new Set());
        }
        albumOverallTracks.get(key)!.add(normalizeStrict(s.title));
      }
    }

    const targetTracksCount = albumOverallTracks.get(targetFuzzyKey)?.size || 0;
    if (targetTracksCount < 3) {
      // Does not qualify as an album
      return [];
    }
  }

  // Map to collect each genre's week entries: genreKey -> Array<{ weekNumber, rank, plays }>
  const genreWeeksMap = new Map<string, Array<{ weekNumber: number; rank: number; plays: number }>>();

  for (const week of allWeeks) {
    const scrobbles = week.scrobbles || [];
    if (scrobbles.length === 0) continue;

    // Bucket scrobbles by genre (including non-pop aggregate)
    const genreScrobbles = new Map<string, Scrobble[]>();

    for (const s of scrobbles) {
      const g = resolveGenre(s.artist, s.title);
      if (!genreScrobbles.has(g)) {
        genreScrobbles.set(g, []);
      }
      genreScrobbles.get(g)!.push(s);

      // If Non-Pop, also add to Non-Pop aggregate bucket
      if (isNonPopGenre(g)) {
        if (!genreScrobbles.has('non_pop_aggregate')) {
          genreScrobbles.set('non_pop_aggregate', []);
        }
        genreScrobbles.get('non_pop_aggregate')!.push(s);
      }
    }

    // Now for each genre bucket in this week, determine rankings
    for (const [gKey, sList] of genreScrobbles.entries()) {
      if (type === 'track') {
        const trackPlays = new Map<string, { plays: number; rawArtist: string; rawTitle: string }>();

        for (const s of sList) {
          const rawKey = `${s.artist.toLowerCase()}:::${s.title.toLowerCase()}`;
          const mappedTitle = mergedMap[rawKey] || s.title;
          const key = `${normalizeStrict(s.artist)}:::${normalizeStrict(normalizeTrackTitle(mappedTitle))}`;

          const cur = trackPlays.get(key);
          if (!cur) {
            trackPlays.set(key, { plays: 1, rawArtist: s.artist, rawTitle: mappedTitle });
          } else {
            cur.plays += 1;
          }
        }

        // Sort descending by plays
        const sorted = Array.from(trackPlays.entries()).sort((a, b) => b[1].plays - a[1].plays);
        const matchIdx = sorted.findIndex(([k]) => k === targetFuzzyKey);

        if (matchIdx !== -1) {
          const rank = matchIdx + 1;
          const plays = sorted[matchIdx][1].plays;
          if (!genreWeeksMap.has(gKey)) {
            genreWeeksMap.set(gKey, []);
          }
          genreWeeksMap.get(gKey)!.push({ weekNumber: week.weekNumber, rank, plays });
        }
      } else {
        // type === 'album'
        const albumPlays = new Map<string, { plays: number; rawArtist: string; rawAlbum: string }>();

        for (const s of sList) {
          if (!s.album || s.album.trim().length === 0) continue;
          const key = `${normalizeStrict(s.artist)}:::${normalizeStrict(normalizeAlbumTitle(s.album))}`;
          if ((albumOverallTracks.get(key)?.size || 0) < 3) continue;

          const cur = albumPlays.get(key);
          if (!cur) {
            albumPlays.set(key, { plays: 1, rawArtist: s.artist, rawAlbum: s.album });
          } else {
            cur.plays += 1;
          }
        }

        const sorted = Array.from(albumPlays.entries()).sort((a, b) => b[1].plays - a[1].plays);
        const matchIdx = sorted.findIndex(([k]) => k === targetFuzzyKey);

        if (matchIdx !== -1) {
          const rank = matchIdx + 1;
          const plays = sorted[matchIdx][1].plays;
          if (!genreWeeksMap.has(gKey)) {
            genreWeeksMap.set(gKey, []);
          }
          genreWeeksMap.get(gKey)!.push({ weekNumber: week.weekNumber, rank, plays });
        }
      }
    }
  }

  const results: GenreChartPerformance[] = [];

  for (const [gKey, weekEntries] of genreWeeksMap.entries()) {
    if (weekEntries.length === 0) continue;

    const ranks = weekEntries.map((w) => w.rank);
    const peakRank = Math.min(...ranks);
    const weeksAtNumberOne = weekEntries.filter((w) => w.rank === 1).length;
    const totalWeeksOnChart = weekEntries.length;
    const top5Weeks = weekEntries.filter((w) => w.rank <= 5).length;
    const top10Weeks = weekEntries.filter((w) => w.rank <= 10).length;
    const firstWeekNumber = weekEntries[0].weekNumber;
    const peakEntry = weekEntries.find((w) => w.rank === peakRank);
    const peakWeekNumber = peakEntry ? peakEntry.weekNumber : firstWeekNumber;

    const curEntry = selectedWeekNumber ? weekEntries.find((w) => w.weekNumber === selectedWeekNumber) : null;
    const currentRank = curEntry ? curEntry.rank : null;

    let displayName = 'Special Format';
    let color = '#a855f7';
    let gradient = 'from-purple-500 to-indigo-600';
    let isNonPop = true;

    if (gKey === 'non_pop_aggregate') {
      displayName = 'Non-Pop Hot Chart';
      color = '#8b5cf6';
      gradient = 'from-violet-500 to-purple-700';
      isNonPop = true;
    } else if (GENRE_METADATA[gKey]) {
      displayName = GENRE_METADATA[gKey].name;
      color = GENRE_METADATA[gKey].color;
      gradient = GENRE_METADATA[gKey].gradient;
      isNonPop = GENRE_METADATA[gKey].isNonPop ?? true;
    }

    let summaryText = '';
    let shortBadge = '';

    if (peakRank === 1) {
      summaryText = `Peaked #1 on ${displayName} (${weeksAtNumberOne} ${
        weeksAtNumberOne === 1 ? 'week' : 'weeks'
      } at #1 • ${totalWeeksOnChart} total ${totalWeeksOnChart === 1 ? 'wk' : 'wks'})`;
      shortBadge = `#1 ${displayName} (${weeksAtNumberOne}w at #1)`;
    } else {
      summaryText = `Peaked #${peakRank} on ${displayName} (${totalWeeksOnChart} ${
        totalWeeksOnChart === 1 ? 'week' : 'weeks'
      } on chart • Top 5: ${top5Weeks}w)`;
      shortBadge = `#${peakRank} ${displayName} (${totalWeeksOnChart}w)`;
    }

    results.push({
      genreKey: gKey,
      genreDisplayName: displayName,
      genreColor: color,
      genreGradient: gradient,
      isNonPop,
      peakRank,
      weeksAtNumberOne,
      totalWeeksOnChart,
      top5Weeks,
      top10Weeks,
      currentRank,
      firstWeekNumber,
      peakWeekNumber,
      summaryText,
      shortBadge,
      allWeeklyRanks: weekEntries,
    });
  }

  // Sort by peakRank ascending, then weeksAtNumberOne descending, then totalWeeksOnChart descending
  results.sort((a, b) => {
    if (a.peakRank !== b.peakRank) return a.peakRank - b.peakRank;
    if (a.weeksAtNumberOne !== b.weeksAtNumberOne) return b.weeksAtNumberOne - a.weeksAtNumberOne;
    return b.totalWeeksOnChart - a.totalWeeksOnChart;
  });

  genreHistoryCache.set(cacheKey, results);
  return results;
}


