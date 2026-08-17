/**
 * Reserva de alvos entre os caçadores da equipe.
 *
 * Sem isto, líder e aliados chamam `findNearestAliveEnemy` de posições quase
 * idênticas e escolhem sempre o mesmo monstro. Cada caçador reserva o seu e os
 * demais passam para o próximo livre.
 */
/** Identidade do personagem controlado pelo jogador na reserva de alvos. */
export const LEADER_CLAIM_ID = 'leader';

export class TargetClaims {
  private readonly byClaimant = new Map<string, string>();

  /** O alvo já está reservado por outro caçador? */
  takenByOther(enemyId: string, claimantId: string): boolean {
    for (const [id, claimed] of this.byClaimant) {
      if (id !== claimantId && claimed === enemyId) return true;
    }
    return false;
  }

  claimedBy(claimantId: string): string | null {
    return this.byClaimant.get(claimantId) ?? null;
  }

  claim(claimantId: string, enemyId: string): void {
    this.byClaimant.set(claimantId, enemyId);
  }

  release(claimantId: string): void {
    this.byClaimant.delete(claimantId);
  }

  clear(): void {
    this.byClaimant.clear();
  }
}
