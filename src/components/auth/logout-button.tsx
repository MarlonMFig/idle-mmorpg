'use client';

import { signOut } from '@/lib/auth/actions';

export function LogoutButton() {
  return (
    <form className="auth-logout" action={signOut}>
      <button type="submit">Sair</button>
    </form>
  );
}
