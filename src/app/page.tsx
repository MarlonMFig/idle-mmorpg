import { NewGameGate } from '@/components/new-game-gate';
import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    redirect('/auth/sign-in');
  }
  if (session.user.emailVerified === false) {
    redirect(`/auth/verify-email?email=${encodeURIComponent(session.user.email)}`);
  }

  return <NewGameGate authUserId={session.user.id} />;
}
