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
  setSeatVoiceEffect,
  sendRoomMessage,
  clearRoomChat,
  deleteRoom,
  broadcastUserEntrance,
  subscribeToRoomEntrance,
  subscribeToRoom,
  subscribeToRoomsList,
  subscribeToFeaturedRooms,
  getRoomById,
  kickUserFromSeat,
  toggleSeatLock,
  muteSeatByHost,
  updateRoomPassword,
  updateRoomSeatCount,
  setSeatVipConfig,
  moveUserToSeat,
  assignUserToSeat,
  sendSeatEmoji,
  subscribeToSeatEmojis,
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

export {
  createJackarooGame,
  joinJackarooGame,
  startJackarooGameNow,
  playJackarooCardMove,
  playJackSwapMove,
  burnJackarooCard,
  closeJackarooGame,
  subscribeToJackarooGame,
  getGlobalTrackIndex,
  canMoveMarbleWithCard,
} from './jackarooService';

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
  clearAllTracksFromQueue,
  cancelAndClearMusic,
  setMusicModeActive,
  changeCurrentTrack,
  selectTrackFromQueue,
  toggleMusicRepeat,
  restartCurrentTrack,
  setMusicVolume,
  uploadSongFile,
  subscribeToMusicState,
} from './musicService';

export {
  registerAudiencePresence,
  subscribeToAudience,
} from './presenceService';

export type { AudienceParticipant } from './presenceService';

export {
  speakAnnouncement,
  speakUserEntrance,
  isSoundEffectsEnabled,
  playGiftSoundEffect,
  playChatNotificationSound,
} from './ttsService';

export { uploadImageToImgBB } from './imgbbService';

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
  addPostComment,
  deletePostComment,
  subscribeToPostComments,
} from './postService';

export { submitReport } from './reportService';

export {
  followUser,
  unfollowUser,
  acceptFollow,
  checkIsFollowing,
  subscribeToFollowState,
  subscribeToFollowersCount,
  subscribeToFollowingCount,
  subscribeToFriendsCount,
  subscribeToFollowersList,
  subscribeToFollowingList,
  subscribeToFriendsList,
  initUserPresence,
  subscribeToUserPresence,
} from './socialService';

export {
  getThreadId,
  sendDirectMessage,
  subscribeToDirectMessages,
  normalizeDirectMessages,
  subscribeToUserInbox,
  markThreadAsRead,
  subscribeToUnreadDirectMessagesCount,
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
  setAdminForcedVoice,
  checkUserBanStatus,
  requestAccountDeletion,
  cancelAccountDeletionRequest,
  subscribeToUserDeletionRequest,
  subscribeToAllDeletionRequests,
  approveAccountDeletion,
  rejectAccountDeletion,
} from './adminAssetsService';

export {
  captureDeviceInfo,
  syncCurrentUserDevice,
} from './deviceDetection';

export {
  startCinemaMode,
  stopCinemaMode,
  setCinemaVideoUrl,
  updateCinemaPlayback,
  updateCinemaDuration,
  updateCinemaSeatCount,
  subscribeToRoomCinema,
  normalizeCinemaPlaylist,
  saveCinemaMovie,
  deleteCinemaMovie,
  subscribeToCinemaPlaylist,
  switchCinemaMovie,
} from './cinemaService';


