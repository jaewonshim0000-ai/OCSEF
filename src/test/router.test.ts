import { describe, expect, it } from 'vitest';
import { parseRoute, resolveRoute } from '../lib/router';

describe('parseRoute', () => {
  it('parses locked help routes', () => {
    expect(parseRoute('/help').name).toBe('help');
    expect(parseRoute('/help/family')).toMatchObject({ name: 'locked-tile', tile: 'family' });
    expect(parseRoute('/help/call').name).toBe('locked-call');
    expect(parseRoute('/help/nope').name).toBe('not-found');
  });

  it('parses companion routes with ids and the from parameter', () => {
    expect(parseRoute('#/family/contact-maya?from=help')).toMatchObject({ name: 'contact', id: 'contact-maya', from: 'help' });
    expect(parseRoute('/home/places/space-kitchen')).toMatchObject({ name: 'places', id: 'space-kitchen' });
    expect(parseRoute('/routine/routine-go-out')).toMatchObject({ name: 'routine-play', id: 'routine-go-out' });
    expect(parseRoute('/home?from=evil').from).toBeUndefined();
  });

  it('parses setup sections and rejects unknown ones', () => {
    expect(parseRoute('/setup').name).toBe('setup');
    expect(parseRoute('/setup').section).toBeUndefined();
    expect(parseRoute('/setup/family/new')).toMatchObject({ name: 'setup', section: 'family', id: 'new' });
    expect(parseRoute('/setup/secrets').name).toBe('not-found');
    expect(parseRoute('/setup/music/new')).toMatchObject({ name: 'setup', section: 'music', id: 'new' });
    expect(parseRoute('/music?from=you')).toMatchObject({ name: 'music', from: 'you' });
  });
});

describe('resolveRoute while locked', () => {
  const privateRoutes = [
    '/today',
    '/home',
    '/home/places',
    '/family',
    '/family/contact-maya',
    '/call/contact-maya',
    '/you',
    '/routine',
    '/routine/routine-go-out',
    '/memories',
    '/music',
    '/setup/music/song-waltz',
    '/setup',
    '/setup/privacy',
    '/setup/family/contact-maya',
  ];

  it.each(privateRoutes)('returns %s to the help screen', (path) => {
    const r = resolveRoute(path, false);
    expect(r.route.name).toBe('help');
    expect(r.route.path).toBe('/help');
    expect(r.blockedPrivate).toBe(true);
  });

  it('allows the keypad and the limited help views', () => {
    for (const path of ['/lock', '/help', '/help/home', '/help/family', '/help/you', '/help/routine', '/help/call']) {
      const r = resolveRoute(path, false);
      expect(r.route.path).toBe(path);
      expect(r.blockedPrivate).toBe(false);
    }
  });

  it('sends unknown routes to help without a private notice', () => {
    const r = resolveRoute('/does-not-exist', false);
    expect(r.route.name).toBe('help');
    expect(r.blockedPrivate).toBe(false);
  });
});

describe('resolveRoute while unlocked', () => {
  it('maps limited help views to full views opened from help', () => {
    expect(resolveRoute('/help/family', true).route).toMatchObject({ name: 'family', from: 'help' });
    expect(resolveRoute('/help/call', true).route).toMatchObject({ name: 'family', from: 'help' });
  });

  it('sends the keypad and unknown routes to Today', () => {
    expect(resolveRoute('/lock', true).route.name).toBe('today');
    expect(resolveRoute('/nowhere', true).route.name).toBe('today');
  });

  it('keeps private routes', () => {
    expect(resolveRoute('/setup/privacy', true).route).toMatchObject({ name: 'setup', section: 'privacy' });
  });
});

describe('first run routing', () => {
  it('parses /welcome and /start only without extra parts', () => {
    expect(parseRoute('/welcome').name).toBe('welcome');
    expect(parseRoute('/start').name).toBe('start');
    expect(parseRoute('/start/3').name).toBe('not-found');
  });

  it('sends every path to Welcome on a new install, except the wizard', () => {
    for (const p of ['/lock', '/today', '/help', '/help/family', '/setup', '/nope']) {
      expect(resolveRoute(p, false, 'new').route.name).toBe('welcome');
      expect(resolveRoute(p, true, 'new').route.name).toBe('welcome');
    }
    expect(resolveRoute('/start', false, 'new').route.name).toBe('start');
    expect(resolveRoute('/welcome', false, 'new').route.name).toBe('welcome');
  });

  it('sends Welcome and the wizard away once set up', () => {
    for (const mode of ['real', 'sample'] as const) {
      expect(resolveRoute('/welcome', false, mode).route.name).toBe('lock');
      expect(resolveRoute('/start', true, mode).route.name).toBe('today');
    }
  });
});
