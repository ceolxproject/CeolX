import { useSyncExternalStore } from 'react';

// One mute setting shared by every video in the app. Unmuting a card in the feed
// and then opening that post lands you on an unmuted player, and two surfaces can
// never disagree about whether sound is on — which is what happens as soon as each
// player owns its own flag. Instagram treats mute the same way: a session
// preference, not per-video state.
//
// ponytail: a module-level boolean, not a context or a store library. There is one
// value, it never needs to be scoped, and nothing renders differently per subtree.
let muted = true;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setVideoMuted(next: boolean) {
  if (next === muted) return;
  muted = next;
  for (const listener of listeners) listener();
}

export function useVideoMuted(): boolean {
  return useSyncExternalStore(subscribe, () => muted);
}
