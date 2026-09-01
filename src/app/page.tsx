import { NewGameGate } from '@/components/new-game-gate';
import { getAuthUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getAuthUser();
  if (!user) {
    redirect('/auth/sign-in');
  }

  return <NewGameGate authUserId={user.id} />;
}
