import { useEffect, useState } from 'react';

/** Server-clock time in ms, refreshed every second while `active`. */
export function useServerNow(offsetMs: number, active = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    // Tick just after each whole second so the digits change together.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(timer);
  }, [active]);

  return now + offsetMs;
}
