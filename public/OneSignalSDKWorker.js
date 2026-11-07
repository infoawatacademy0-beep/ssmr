importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// Rule 3: Automatically clear/dismiss notifications from the device tray
// when the user opens/reads the chat on the frontend or receives a dismiss signal.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "CLEAR_CHAT_NOTIFICATIONS") return;

  const { threadId, senderUid } = data;
  self.registration.getNotifications().then((notifications) => {
    notifications.forEach((notification) => {
      const notifData = notification.data || {};
      const notifTag = notification.tag || "";
      const matchesThread =
        (threadId && (notifTag.includes(threadId) || notifData.threadId === threadId)) ||
        (senderUid && (notifTag.includes(senderUid) || notifData.senderUid === senderUid)) ||
        (!threadId && !senderUid);

      if (matchesThread) {
        notification.close();
      }
    });
  });
});
