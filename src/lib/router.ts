import type { AppMode, TileId } from './types';

export type RouteName =
  | 'lock'
  | 'help'
  | 'locked-tile'
  | 'locked-call'
  | 'today'
  | 'home'
  | 'places'
  | 'family'
  | 'contact'
  | 'call'
  | 'you'
  | 'routine'
  | 'routine-play'
  | 'memories'
  | 'music'
  | 'setup'
  | 'welcome'
  | 'start'
  | 'not-found';

export const SETUP_SECTIONS = ['you', 'home', 'family', 'routine', 'memories', 'music', 'privacy', 'settings'] as const;
export type SetupSection = (typeof SETUP_SECTIONS)[number];

export interface Route {
  name: RouteName;
  /** Normalised path including any query string. */
  path: string;
  tile?: TileId;
  id?: string;
  section?: SetupSection;
  /** Where a detail screen was opened from: the help screen, Today, or You. */
  from?: 'help' | 'today' | 'you';
}

const TILES: readonly TileId[] = ['home', 'family', 'you', 'routine'];

/** Routes that may render while the demo phone is locked. */
const LOCKED_ROUTES: ReadonlySet<RouteName> = new Set<RouteName>(['lock', 'help', 'locked-tile', 'locked-call']);

export function isLockedSafe(name: RouteName): boolean {
  return LOCKED_ROUTES.has(name);
}

export function parseRoute(rawPath: string): Route {
  const path = rawPath.startsWith('#') ? rawPath.slice(1) : rawPath;
  const [pathname, queryString = ''] = path.split('?');
  const query = new URLSearchParams(queryString);
  const fromParam = query.get('from');
  const from: Route['from'] = fromParam === 'help' || fromParam === 'today' || fromParam === 'you' ? fromParam : undefined;
  const parts = pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const normalised = '/' + parts.map(encodeURIComponent).join('/') + (queryString ? `?${queryString}` : '');
  const base: { path: string; from: Route['from'] } = { path: normalised, from };
  const [a, b, c] = parts;

  switch (a) {
    case 'lock':
      return parts.length === 1 ? { ...base, name: 'lock' } : { ...base, name: 'not-found' };
    case 'welcome':
      return parts.length === 1 ? { ...base, name: 'welcome' } : { ...base, name: 'not-found' };
    case 'start':
      return parts.length === 1 ? { ...base, name: 'start' } : { ...base, name: 'not-found' };
    case 'help':
      if (parts.length === 1) return { ...base, name: 'help' };
      if (parts.length === 2 && b === 'call') return { ...base, name: 'locked-call' };
      if (parts.length === 2 && (TILES as readonly string[]).includes(b)) {
        return { ...base, name: 'locked-tile', tile: b as TileId };
      }
      return { ...base, name: 'not-found' };
    case 'today':
      return parts.length === 1 ? { ...base, name: 'today' } : { ...base, name: 'not-found' };
    case 'home':
      if (parts.length === 1) return { ...base, name: 'home' };
      if (b === 'places' && parts.length <= 3) return { ...base, name: 'places', id: c };
      return { ...base, name: 'not-found' };
    case 'family':
      if (parts.length === 1) return { ...base, name: 'family' };
      if (parts.length === 2) return { ...base, name: 'contact', id: b };
      return { ...base, name: 'not-found' };
    case 'call':
      return parts.length === 2 ? { ...base, name: 'call', id: b } : { ...base, name: 'not-found' };
    case 'you':
      return parts.length === 1 ? { ...base, name: 'you' } : { ...base, name: 'not-found' };
    case 'routine':
      if (parts.length === 1) return { ...base, name: 'routine' };
      if (parts.length === 2) return { ...base, name: 'routine-play', id: b };
      return { ...base, name: 'not-found' };
    case 'memories':
      return parts.length === 1 ? { ...base, name: 'memories' } : { ...base, name: 'not-found' };
    case 'music':
      return parts.length === 1 ? { ...base, name: 'music' } : { ...base, name: 'not-found' };
    case 'setup': {
      if (parts.length === 1) return { ...base, name: 'setup' };
      if (!(SETUP_SECTIONS as readonly string[]).includes(b) || parts.length > 3) {
        return { ...base, name: 'not-found' };
      }
      return { ...base, name: 'setup', section: b as SetupSection, id: c };
    }
    default:
      return { ...base, name: 'not-found' };
  }
}

export interface Resolution {
  route: Route;
  /** True when a private screen was requested while locked and help was shown instead. */
  blockedPrivate: boolean;
}

/**
 * Applies the first-run and lock guards. While locked, only the keypad and the limited help
 * views can render. Anything else returns to the help screen, so a private
 * route never mounts and never reads full records.
 */
export function resolveRoute(rawPath: string, unlocked: boolean, mode: AppMode = 'real'): Resolution {
  const route = parseRoute(rawPath);
  const firstRun = route.name === 'welcome' || route.name === 'start';
  if (mode === 'new') {
    return firstRun ? { route, blockedPrivate: false } : { route: parseRoute('/welcome'), blockedPrivate: false };
  }
  if (firstRun) return { route: parseRoute(unlocked ? '/today' : '/lock'), blockedPrivate: false };
  if (!unlocked) {
    if (isLockedSafe(route.name)) return { route, blockedPrivate: false };
    return { route: parseRoute('/help'), blockedPrivate: route.name !== 'not-found' };
  }
  switch (route.name) {
    case 'lock':
    case 'not-found':
      return { route: parseRoute('/today'), blockedPrivate: false };
    case 'locked-tile':
      return { route: parseRoute(`/${route.tile}?from=help`), blockedPrivate: false };
    case 'locked-call':
      return { route: parseRoute('/family?from=help'), blockedPrivate: false };
    default:
      return { route, blockedPrivate: false };
  }
}
