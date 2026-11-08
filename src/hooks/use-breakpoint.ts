import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/**
 * Layout size class, by window width rather than platform, so a phone-sized browser gets the phone
 * layout and a tablet gets the rail.
 * phone: bottom tabs. tablet: left rail. desktop: left rail + right rail.
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= 1200) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'phone';
}
