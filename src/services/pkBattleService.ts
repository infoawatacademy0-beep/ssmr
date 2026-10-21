import { ref, set, update, runTransaction, onValue, type Unsubscribe } from 'firebase/database';
import { database } from '../config/firebase';
import type { PkBattleState, PkTeam } from '../types/pkBattle';
import { sendRoomMessage } from './roomService';

/* ─────────────────────────────────────────────────────────────
   4 VS 4 Team PK Battle Service (5 Minutes Duration)
   Team Red (Seats 1-4) VS Team Blue (Seats 5-8)
   Real-Time Score Tug-of-War & Gift Integration
   ───────────────────────────────────────────────────────────── */

/**
 * Starts a 4 VS 4 PK Battle for 5 minutes (300 seconds).
 */
export async function startPkBattle(
  roomId: string,
  hostUsername: string,
  durationSeconds = 300,
): Promise<void> {
  const battleRef = ref(database, `rooms/${roomId}/pkBattle`);
  const now = Date.now();

  const battleState: PkBattleState = {
    id: `pk_${now}`,
    status: 'active',
    startTime: now,
    durationSeconds,
    endTime: now + durationSeconds * 1000,
    redScore: 0,
    blueScore: 0,
    redSeats: [1, 2, 3, 4],
    blueSeats: [5, 6, 7, 8],
    winner: null,
    lastUpdated: now,
  };

  await set(battleRef, battleState);

  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `⚔️ 4 VS 4 PK Battle has begun (5 Minutes)! Team Red (Seats 1-4) vs Team Blue (Seats 5-8). Send gifts & tap to boost!`,
  );
}

/**
 * Adds points to a team during an active PK battle.
 */
export async function addPkBattlePoints(
  roomId: string,
  team: PkTeam,
  points: number,
): Promise<void> {
  const battleRef = ref(database, `rooms/${roomId}/pkBattle`);

  await runTransaction(battleRef, (currentBattle: PkBattleState | null) => {
    if (!currentBattle || currentBattle.status !== 'active') return currentBattle;

    // Check if time expired
    if (Date.now() >= currentBattle.endTime) {
      currentBattle.status = 'finished';
      if (currentBattle.redScore > currentBattle.blueScore) {
        currentBattle.winner = 'red';
      } else if (currentBattle.blueScore > currentBattle.redScore) {
        currentBattle.winner = 'blue';
      } else {
        currentBattle.winner = 'draw';
      }
      return currentBattle;
    }

    if (team === 'red') {
      currentBattle.redScore = (currentBattle.redScore || 0) + points;
    } else {
      currentBattle.blueScore = (currentBattle.blueScore || 0) + points;
    }

    currentBattle.lastUpdated = Date.now();
    return currentBattle;
  });
}

/**
 * Manually ends or resets the PK battle.
 */
export async function endPkBattle(roomId: string): Promise<void> {
  const battleRef = ref(database, `rooms/${roomId}/pkBattle`);
  await runTransaction(battleRef, (current: PkBattleState | null) => {
    if (!current) return current;
    current.status = 'finished';
    if (current.redScore > current.blueScore) current.winner = 'red';
    else if (current.blueScore > current.redScore) current.winner = 'blue';
    else current.winner = 'draw';
    return current;
  });
}

/**
 * Resets the PK battle state completely.
 */
export async function resetPkBattle(roomId: string): Promise<void> {
  const battleRef = ref(database, `rooms/${roomId}/pkBattle`);
  await set(battleRef, null);
}

/**
 * Subscribes to real-time PK battle state in the room.
 */
export function subscribeToPkBattle(
  roomId: string,
  onUpdate: (battle: PkBattleState | null) => void,
): Unsubscribe {
  const battleRef = ref(database, `rooms/${roomId}/pkBattle`);
  return onValue(battleRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.val() as PkBattleState);
    } else {
      onUpdate(null);
    }
  });
}
