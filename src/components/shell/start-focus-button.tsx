import type { TabTriggerSlotProps } from 'expo-router/ui';

import { IconButton } from '@/components/ui/icon-button';

type StartFocusButtonProps = TabTriggerSlotProps & {
  size?: number;
};

/** Round play button that opens the Focus tab. Used in the rail and the phone tab bar. */
export function StartFocusButton({ onPress, onLongPress, size = 56 }: StartFocusButtonProps) {
  return (
    <IconButton
      icon="play"
      accessibilityLabel="Start focusing"
      onPress={onPress}
      onLongPress={onLongPress}
      size={size}
      opticalOffset={3}
    />
  );
}
