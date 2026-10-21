import type { Badge } from './user';

/**
 * Real-time audience member listening in the room (not on mic seats).
 */
export interface AudienceMember {
  uid: string;
  username: string;
  level: number;
  avatar?: string;
  badges?: Badge[];
  enteredAt: number;
}
