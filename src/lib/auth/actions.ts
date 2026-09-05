'use server';

import { isLocalGameplayRuntime } from '@/lib/auth/local-runtime';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signOut(): Promise<never> {
  if (isLocalGameplayRuntime()) {
    redirect('/');
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/auth/sign-in');
}
