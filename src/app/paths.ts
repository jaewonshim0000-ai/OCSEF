import type { Route } from '../lib/router';

/** Where a companion detail screen's back button goes. */
export function backTarget(route: Route): { label: string; path: string } {
  return route.from === 'help'
    ? { label: 'Back to help', path: '/help' }
    : { label: 'Back to Today', path: '/today' };
}

/** Keeps the "opened from" context when moving deeper into a section. */
export function withFrom(path: string, route: Route): string {
  return `${path}?from=${route.from === 'help' ? 'help' : 'today'}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function mapsHref(address: string): string {
  const q = encodeURIComponent(address);
  const apple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
  return apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`;
}
