import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export default function RanksScreen() {
  return (
    <Screen title="Ranks">
      <Card>
        <Text variant="heading">Weekly rankings start soon</Text>
        <Text color="textMuted">
          See how your week compares with friends and everyone on the app. Rankings count timed sessions
          only and reset every Monday.
        </Text>
      </Card>
    </Screen>
  );
}
