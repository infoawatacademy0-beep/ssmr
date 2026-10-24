import { ref, set, runTransaction, onValue, type Unsubscribe } from 'firebase/database';
import { database } from '../config/firebase';
import type { PkBattleState, PkTeam, StartPkBattleOptions } from '../types/pkBattle';
import { sendRoomMessage } from './roomService';

/* ─────────────────────────────────────────────────────────────
   Advanced PK Battle Service
   Modes: 1v1, 2v2, 3v3, 4v4, Custom
   Durations: 1m (60s), 3m (180s), 5m (300s), 10m (600s)
   Top Contributors (MVP gifters), Live Score & Optional Penalty
   ───────────────────────────────────────────────────────────── */

/**
 * Starts a PK Battle with customized mode, duration, seats, and penalty.
 */
export async function startPkBattle(
  roomId: string,
  hostUsername: string,
  optionsOrDuration: StartPkBattleOptions | number = 300,
): Promise<void> {
  let options: StartPkBattleOptions = {};
  if (typeof optionsOrDuration === 'number') {
    options = { durationSeconds: optionsOrDuration };
  } else {
    options = optionsOrDuration || {};
  }

  const mode = options.mode || '4v4';
  const durationSeconds = options.durationSeconds || 300;

  let redSeats = options.redSeats;
  let blueSeats = options.blueSeats;

  if (!redSeats || !blueSeats || redSeats.length === 0 || blueSeats.length === 0) {
    if (mode === '1v1') {
      redSeats = [1];
      blueSeats = [2];
    } else if (mode === '2v2') {
      redSeats = [1, 2];
      blueSeats = [3, 4];
    } else if (mode === '3v3') {
      redSeats = [1, 2, 5];
      blueSeats = [3, 4, 7];
    } else {
      // 4v4 default
      redSeats = [1, 2, 5, 6];
      blueSeats = [3, 4, 7, 8];
    }
  }

  const penalty = options.penalty?.trim() || null;
  const battleRef = ref(database, `rooms/${roomId}/pkBattle`);
  const now = Date.now();

  const battleState: PkBattleState = {
    id: `pk_${now}`,
    status: 'active',
    mode,
    startTime: now,
    durationSeconds,
    endTime: now + durationSeconds * 1000,
    redScore: 0,
    blueScore: 0,
    redSeats,
    blueSeats,
    redContributors: {},
    blueContributors: {},
    penalty,
    winner: null,
    lastUpdated: now,
  };

  await set(battleRef, battleState);
  // Reset per-seat PK points so only points received during this PK battle are shown
  await set(ref(database, `rooms/${roomId}/seatGiftCoins`), null);

  const durationMin = Math.max(1, Math.round(durationSeconds / 60));
  const penaltyNotice = penalty ? ` | ⚠️ سزای دۆڕاو: ${penalty}` : '';
  await sendRoomMessage(
    roomId,
    'system',
    'System',
    `⚔️ جەنگی PK (${mode.toUpperCase()}) دەستی پێکرد بۆ ماوەی (${durationMin} خولەک)! سوور (کورسی ${redSeats.join('، ')}) دژی شین (کورسی ${blueSeats.join('، ')})${penaltyNotice}. دیاری بنێرن بۆ سەرخستنی تیمی خۆتان!`,
  );
}

/**
 * Adds points to a team during an active PK battle and tracks the sender's MVP contributions.
 */
export async function addPkBattlePoints(
  roomId: string,
  team: PkTeam,
  points: number,
  sender?: { uid: string; username: string; avatar?: string | null },
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
      if (sender && sender.uid) {
        if (!currentBattle.redContributors) currentBattle.redContributors = {};
        const prev = currentBattle.redContributors[sender.uid] || {
          uid: sender.uid,
          username: sender.username,
          avatar: sender.avatar || null,
          points: 0,
        };
        currentBattle.redContributors[sender.uid] = {
          ...prev,
          username: sender.username,
          avatar: sender.avatar || prev.avatar || null,
          points: prev.points + points,
        };
      }
    } else {
      currentBattle.blueScore = (currentBattle.blueScore || 0) + points;
      if (sender && sender.uid) {
        if (!currentBattle.blueContributors) currentBattle.blueContributors = {};
        const prev = currentBattle.blueContributors[sender.uid] || {
          uid: sender.uid,
          username: sender.username,
          avatar: sender.avatar || null,
          points: 0,
        };
        currentBattle.blueContributors[sender.uid] = {
          ...prev,
          username: sender.username,
          avatar: sender.avatar || prev.avatar || null,
          points: prev.points + points,
        };
      }
    }

    currentBattle.lastUpdated = Date.now();
    return currentBattle;
  });
}

/**
 * Manually ends or settles the PK battle.
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
  await set(ref(database, `rooms/${roomId}/seatGiftCoins`), null);
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
