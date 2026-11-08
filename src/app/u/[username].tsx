import { useLocalSearchParams } from 'expo-router';

import { ProfileView } from '@/components/profile/profile-view';
import { useDocumentTitle } from '@/hooks/use-document-title';

/** Someone's profile page, opened by tapping their name in the feed. */
export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  useDocumentTitle(username ? `@${username}` : null);
  return <ProfileView username={username} showBack />;
}
