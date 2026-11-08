type Listener = () => void;

const listeners = new Set<Listener>();

/** Tells every feed on screen that posts changed (a new post, a deleted one), so they reload. */
export function notifyPostsChanged() {
  listeners.forEach((listener) => listener());
}

export function onPostsChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
