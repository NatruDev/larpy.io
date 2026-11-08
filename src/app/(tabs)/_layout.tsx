import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';

import { BottomBar } from '@/components/shell/bottom-bar';
import { ActiveSessionBanner } from '@/components/timer/active-session-banner';
import { NAV_ITEMS } from '@/components/shell/nav-items';
import { RightRail } from '@/components/shell/right-rail';
import { SideRail } from '@/components/shell/side-rail';
import { useReminderSync } from '@/features/reminders/use-reminders';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useTheme } from '@/theme';

/**
 * The signed-in app shell. Same routes everywhere; the frame changes with width:
 * phone = content + bottom bar, tablet = left rail + content, desktop = left rail + content + right rail.
 */
export default function TabLayout() {
  const breakpoint = useBreakpoint();
  const { colors } = useTheme();
  useReminderSync();

  return (
    <Tabs style={[styles.fill, { backgroundColor: colors.background }]}>
      {breakpoint === 'phone' ? (
        <View style={styles.fill}>
          <View style={styles.fill}>
            <TabSlot style={styles.fill} />
          </View>
          <ActiveSessionBanner />
          <BottomBar />
        </View>
      ) : (
        <View style={[styles.fill, styles.row]}>
          <SideRail />
          <View style={styles.fill}>
            <ActiveSessionBanner />
            <TabSlot style={styles.fill} />
          </View>
          {breakpoint === 'desktop' ? <RightRail /> : null}
        </View>
      )}

      {/* Route definitions only; the visible navigation is the rail or the bottom bar above. */}
      <TabList style={styles.hidden}>
        {NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} />
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  hidden: { display: 'none' },
});
