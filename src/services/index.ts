export {
  registerUser,
  loginUser,
  logoutUser,
  fetchUserProfile,
  onAuthChange,
  subscribeToUserProfile,
} from './auth.service';

export {
  createRoom,
  joinSeat,
  leaveSeat,
  toggleSeatMute,
  sendRoomMessage,
  broadcastUserEntrance,
  subscribeToRoomEntrance,
  subscribeToRoom,
  subscribeToRoomsList,
  subscribeToFeaturedRooms,
  getRoomById,
  kickUserFromSeat,
  toggleSeatLock,
  muteSeatByHost,
} from './roomService';

export type { HostUserInfo, UserSeatInfo, CreateRoomOptions } from './roomService';

export {
  createDiceGame,
  joinDiceGame,
  rollDice,
  resetGame,
  cancelDiceGame,
  subscribeToDiceGame,
} from './gameService';

export type { GameParticipant } from './gameService';

export {
  createLudoGame,
  joinLudoGame,
  startLudoGame,
  rollLudoDice,
  resetLudoGame,
  cancelLudoGame,
  subscribeToLudoGame,
} from './ludoService';

export type { LudoParticipant } from './ludoService';

export { sendGift, subscribeToRoomGift, subscribeToSeatGiftCoins } from './giftService';

export {
  startPkBattle,
  addPkBattlePoints,
  endPkBattle,
  resetPkBattle,
  subscribeToPkBattle,
} from './pkBattleService';

export {
  generateLiveKitToken,
  fetchLiveKitToken,
} from './livekitToken';

export {
  addTrackToQueue,
  setMusicPlayback,
  skipToNextTrack,
  removeTrackFromQueue,
  subscribeToMusicState,
} from './musicService';

export {
  registerAudiencePresence,
  subscribeToAudience,
} from './presenceService';

export type { AudienceParticipant } from './presenceService';

export { speakAnnouncement } from './ttsService';

export {
  viewUserProfile,
  updateUserSocialProfile,
  getUserSocialProfile,
  subscribeToUserVisitors,
  normalizeVisitors,
} from './profileService';

export {
  createPost,
  toggleLikePost,
  deletePost,
  subscribeToPosts,
  normalizePosts,
} from './postService';

export { submitReport } from './reportService';

export {
  followUser,
  unfollowUser,
  checkIsFollowing,
  subscribeToFollowState,
  subscribeToFollowersCount,
  subscribeToFollowingCount,
  initUserPresence,
  subscribeToUserPresence,
} from './socialService';

export {
  getThreadId,
  sendDirectMessage,
  subscribeToDirectMessages,
  normalizeDirectMessages,
} from './chatService';

export {
  searchUsersByUsername,
  subscribeToUserSearch,
} from './searchService';

export {
  sendNotification,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
  subscribeToUnreadCount,
} from './notificationService';

export {
  fetchTopByCoins,
  fetchTopByXP,
  subscribeToLeaderboardByCoins,
  subscribeToLeaderboardByXP,
} from './leaderboardService';
export type { LeaderboardEntry } from './leaderboardService';

export {
  sendRoomInvite,
  respondToInvite,
  subscribeToInvites,
} from './inviteService';

export {
  SHOP_CATALOG,
  purchaseShopItem,
  userOwnsItem,
} from './shopService';

export {
  createStory,
  markStoryViewed,
  deleteStory,
  subscribeToAllStories,
} from './storyService';

export {
  fetchPendingReports,
  subscribeToAllReports,
  resolveReport,
  deleteReport,
  fetchAllUsers,
  banUser,
  unbanUser,
  grantAdminRole,
} from './adminService';

export {
  permanentBanUser,
  tempBanUser,
  unbanUserAccount,
  toggleVerificationBadge,
  assignPremiumCosmetics,
  modifyUserCoins,
  checkUserBanStatus,
} from './adminAssetsService';


