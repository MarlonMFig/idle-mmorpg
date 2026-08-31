'use server';

import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export async function signOut(): Promise<never> {
  await auth.signOut();
  redirect('/auth/sign-in');
}
