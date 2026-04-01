const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();
const db = admin.firestore();

// VAPID Private Key는 Firebase Functions 환경변수에서 로드
// 설정: firebase functions:secrets:set VAPID_PRIVATE_KEY
const { defineSecret } = require("firebase-functions/params");
const vapidPrivateKey = defineSecret("VAPID_PRIVATE_KEY");

webpush.setVapidDetails(
  "mailto:nonmarking@gmail.com",
  "BMqfqNW-_vInMwqdq3H01AKHBepukX3-Lk1RX8ZkZ97jlixIOS7hIZDRJ0gwNy00hARwc2XilfOHnx9WBlcNJfI",
  vapidPrivateKey.value()
);

const NAMES = { taemin: "태민이", dad: "아빠", mom: "엄마" };

function sendToDevices(devices, targetUsers, payload, docPath) {
  const promises = [];
  for (const [deviceId, device] of Object.entries(devices)) {
    if (device.enabled && targetUsers.includes(device.user)) {
      try {
        const sub = JSON.parse(device.subscription);
        promises.push(
          webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
            console.log("Push failed for device", deviceId, err.statusCode);
            if (err.statusCode === 404 || err.statusCode === 410) {
              return db.doc(docPath).update({
                [`pushDevices.${deviceId}.enabled`]: false,
              });
            }
          })
        );
      } catch (e) {
        console.log("Invalid subscription for device", deviceId);
      }
    }
  }
  return Promise.all(promises);
}

// ── 운영 (users/taemin) ──────────────────────────────────────────────────────

// 1) 가족 메시지 → 수신자에게 푸시
exports.onFamilyMessage = onDocumentUpdated("users/taemin", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const oldMsgs = before.familyMessages || [];
  const newMsgs = after.familyMessages || [];
  if (newMsgs.length <= oldMsgs.length) return null;

  const devices = after.pushDevices || {};
  const promises = [];

  for (let i = oldMsgs.length; i < newMsgs.length; i++) {
    const msg = newMsgs[i];
    if (!msg || msg.read) continue;
    const senderName = NAMES[msg.from] || "가족";

    promises.push(sendToDevices(devices, [msg.to], {
      title: senderName + "에게서 메시지가 도착했어요 💌",
      body: msg.text,
      icon: "icon-180.png",
      tag: "family-msg-" + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: "family_msg",
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "users/taemin"));
  }

  return Promise.all(promises);
});

// 2) 기분 업데이트 → 다른 가족에게 푸시
exports.onMoodUpdate = onDocumentUpdated("users/taemin", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.moodNotify ||
    (before.moodNotify && before.moodNotify.ts === after.moodNotify.ts)) {
    return null;
  }

  const mn = after.moodNotify;
  const devices = after.pushDevices || {};
  const senderName = NAMES[mn.user] || "가족";
  const allUsers = Object.keys(NAMES);
  const otherUsers = allUsers.filter(u => u !== mn.user);

  return sendToDevices(devices, otherUsers, {
    title: senderName + "의 기분이 바뀌었어요 " + mn.emoji,
    body: senderName + "이(가) 지금 " + mn.label + " 기분이래요!",
    icon: "icon-180.png",
    tag: "mood-" + mn.user,
    type: "mood_update",
    from: mn.user,
    mood: mn.mood,
    url: "./"
  }, "users/taemin");
});

// 3) 전체 알림 (관리자용)
exports.onBroadcastPush = onDocumentUpdated("users/taemin", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after.pushBroadcast ||
    (before.pushBroadcast && before.pushBroadcast.ts === after.pushBroadcast.ts)) {
    return null;
  }

  const broadcast = after.pushBroadcast;
  const devices = after.pushDevices || {};
  const allUsers = Object.keys(NAMES);

  return sendToDevices(devices, allUsers, {
    title: broadcast.title || "태민이 마일리지 🌟",
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "users/taemin");
});

// 4) 보상 요청/승인/거절 알림
exports.onRewardRequest = onDocumentUpdated("users/taemin", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.rewardNotify ||
    (before.rewardNotify && before.rewardNotify.ts === after.rewardNotify.ts)) {
    return null;
  }

  const rn = after.rewardNotify;
  const devices = after.pushDevices || {};
  const targetUsers = rn.targetUsers || [];

  let title, body, tag;
  if (rn.type === 'request') {
    title = "🎁 보상 사용 요청이 도착했어요!";
    body = `태민이가 "${rn.rwdName}" 사용을 요청했어요`;
    tag = "reward-request-" + rn.ts;
  } else if (rn.type === 'approved') {
    title = "✅ 보상 사용이 승인되었어요!";
    body = `"${rn.rwdName}" 사용이 승인됐어요!`;
    tag = "reward-approved-" + rn.ts;
  } else if (rn.type === 'rejected') {
    title = "❌ 보상 사용이 거절되었어요";
    body = `"${rn.rwdName}" 사용이 거절됐어요`;
    tag = "reward-rejected-" + rn.ts;
  } else {
    return null;
  }

  return sendToDevices(devices, targetUsers, {
    title: title,
    body: body,
    icon: "icon-180.png",
    tag: tag,
    type: "reward_notification",
    url: "./"
  }, "users/taemin");
});

// ── 운영 families/{familyId} (마이그레이션 후) ──────────────────────────────────

// 5) 가족 메시지 → 수신자에게 푸시 (families)
exports.onFamilyMessageFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (familyId.startsWith("dev_") || familyId.startsWith("_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();
  const oldMsgs = before.familyMessages || [];
  const newMsgs = after.familyMessages || [];
  if (newMsgs.length <= oldMsgs.length) return null;

  const devices = after.pushDevices || {};
  const names = after.users || NAMES;
  const promises = [];

  for (let i = oldMsgs.length; i < newMsgs.length; i++) {
    const msg = newMsgs[i];
    if (!msg || msg.read) continue;
    const senderName = (names[msg.from] && names[msg.from].name) || NAMES[msg.from] || "가족";

    promises.push(sendToDevices(devices, [msg.to], {
      title: senderName + "에게서 메시지가 도착했어요 💌",
      body: msg.text,
      icon: "icon-180.png",
      tag: "family-msg-" + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: "family_msg",
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "families/" + familyId));
  }

  return Promise.all(promises);
});

// 6) 기분 업데이트 → 다른 가족에게 푸시 (families)
exports.onMoodUpdateFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (familyId.startsWith("dev_") || familyId.startsWith("_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.moodNotify ||
    (before.moodNotify && before.moodNotify.ts === after.moodNotify.ts)) {
    return null;
  }

  const mn = after.moodNotify;
  const devices = after.pushDevices || {};
  const names = after.users || NAMES;
  const senderName = (names[mn.user] && names[mn.user].name) || NAMES[mn.user] || "가족";
  const allUsers = Object.keys(devices).map(k => devices[k].user).filter((v, i, a) => a.indexOf(v) === i);
  const otherUsers = allUsers.filter(u => u !== mn.user);

  return sendToDevices(devices, otherUsers, {
    title: senderName + "의 기분이 바뀌었어요 " + mn.emoji,
    body: senderName + "이(가) 지금 " + mn.label + " 기분이래요!",
    icon: "icon-180.png",
    tag: "mood-" + mn.user,
    type: "mood_update",
    from: mn.user,
    mood: mn.mood,
    url: "./"
  }, "families/" + familyId);
});

// 7) 전체 알림 (families)
exports.onBroadcastPushFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (familyId.startsWith("dev_") || familyId.startsWith("_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after.pushBroadcast ||
    (before.pushBroadcast && before.pushBroadcast.ts === after.pushBroadcast.ts)) {
    return null;
  }

  const broadcast = after.pushBroadcast;
  const devices = after.pushDevices || {};
  const allUsers = Object.keys(devices).map(k => devices[k].user).filter((v, i, a) => a.indexOf(v) === i);

  return sendToDevices(devices, allUsers, {
    title: broadcast.title || "태민이 마일리지 🌟",
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "families/" + familyId);
});

// 8) 보상 요청/승인/거절 알림 (families)
exports.onRewardRequestFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (familyId.startsWith("dev_") || familyId.startsWith("_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.rewardNotify ||
    (before.rewardNotify && before.rewardNotify.ts === after.rewardNotify.ts)) {
    return null;
  }

  const rn = after.rewardNotify;
  const devices = after.pushDevices || {};
  const targetUsers = rn.targetUsers || [];

  let title, body, tag;
  if (rn.type === 'request') {
    title = "🎁 보상 사용 요청이 도착했어요!";
    const names = after.users || NAMES;
    const requesterName = (names[rn.user] && names[rn.user].name) || NAMES[rn.user] || "가족";
    body = requesterName + '이(가) "' + rn.rwdName + '" 사용을 요청했어요';
    tag = "reward-request-" + rn.ts;
  } else if (rn.type === 'approved') {
    title = "✅ 보상 사용이 승인되었어요!";
    body = '"' + rn.rwdName + '" 사용이 승인됐어요!';
    tag = "reward-approved-" + rn.ts;
  } else if (rn.type === 'rejected') {
    title = "❌ 보상 사용이 거절되었어요";
    body = '"' + rn.rwdName + '" 사용이 거절됐어요';
    tag = "reward-rejected-" + rn.ts;
  } else {
    return null;
  }

  return sendToDevices(devices, targetUsers, {
    title: title,
    body: body,
    icon: "icon-180.png",
    tag: tag,
    type: "reward_notification",
    url: "./"
  }, "families/" + familyId);
});

// ── 개발기 families (dev_로 시작하는 familyId) ─────────────────────────────────

// 5-dev) 가족 메시지 (dev families)
exports.onFamilyMessageDevFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (!familyId.startsWith("dev_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();
  const oldMsgs = before.familyMessages || [];
  const newMsgs = after.familyMessages || [];
  if (newMsgs.length <= oldMsgs.length) return null;

  const devices = after.pushDevices || {};
  const names = after.users || NAMES;
  const promises = [];

  for (let i = oldMsgs.length; i < newMsgs.length; i++) {
    const msg = newMsgs[i];
    if (!msg || msg.read) continue;
    const senderName = (names[msg.from] && names[msg.from].name) || NAMES[msg.from] || "가족";

    promises.push(sendToDevices(devices, [msg.to], {
      title: "[DEV] " + senderName + "에게서 메시지가 도착했어요 💌",
      body: msg.text,
      icon: "icon-180.png",
      tag: "family-msg-" + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: "family_msg",
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "families/" + familyId));
  }

  return Promise.all(promises);
});

// 6-dev) 기분 업데이트 (dev families)
exports.onMoodUpdateDevFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (!familyId.startsWith("dev_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.moodNotify ||
    (before.moodNotify && before.moodNotify.ts === after.moodNotify.ts)) {
    return null;
  }

  const mn = after.moodNotify;
  const devices = after.pushDevices || {};
  const names = after.users || NAMES;
  const senderName = (names[mn.user] && names[mn.user].name) || NAMES[mn.user] || "가족";
  const allUsers = Object.keys(devices).map(k => devices[k].user).filter((v, i, a) => a.indexOf(v) === i);
  const otherUsers = allUsers.filter(u => u !== mn.user);

  return sendToDevices(devices, otherUsers, {
    title: "[DEV] " + senderName + "의 기분이 바뀌었어요 " + mn.emoji,
    body: senderName + "이(가) 지금 " + mn.label + " 기분이래요!",
    icon: "icon-180.png",
    tag: "mood-" + mn.user,
    type: "mood_update",
    from: mn.user,
    mood: mn.mood,
    url: "./"
  }, "families/" + familyId);
});

// 7-dev) 전체 알림 (dev families)
exports.onBroadcastPushDevFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (!familyId.startsWith("dev_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after.pushBroadcast ||
    (before.pushBroadcast && before.pushBroadcast.ts === after.pushBroadcast.ts)) {
    return null;
  }

  const broadcast = after.pushBroadcast;
  const devices = after.pushDevices || {};
  const allUsers = Object.keys(devices).map(k => devices[k].user).filter((v, i, a) => a.indexOf(v) === i);

  return sendToDevices(devices, allUsers, {
    title: "[DEV] " + (broadcast.title || "태민이 마일리지 🌟"),
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "families/" + familyId);
});

// 8-dev) 보상 요청/승인/거절 알림 (dev families)
exports.onRewardRequestDevFamilies = onDocumentUpdated("families/{familyId}", async (event) => {
  const familyId = event.params.familyId;
  if (!familyId.startsWith("dev_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.rewardNotify ||
    (before.rewardNotify && before.rewardNotify.ts === after.rewardNotify.ts)) {
    return null;
  }

  const rn = after.rewardNotify;
  const devices = after.pushDevices || {};
  const targetUsers = rn.targetUsers || [];

  let title, body, tag;
  if (rn.type === 'request') {
    title = "🎁 보상 사용 요청이 도착했어요!";
    const names = after.users || NAMES;
    const requesterName = (names[rn.user] && names[rn.user].name) || NAMES[rn.user] || "가족";
    body = requesterName + '이(가) "' + rn.rwdName + '" 사용을 요청했어요';
    tag = "reward-request-" + rn.ts;
  } else if (rn.type === 'approved') {
    title = "✅ 보상 사용이 승인되었어요!";
    body = '"' + rn.rwdName + '" 사용이 승인됐어요!';
    tag = "reward-approved-" + rn.ts;
  } else if (rn.type === 'rejected') {
    title = "❌ 보상 사용이 거절되었어요";
    body = '"' + rn.rwdName + '" 사용이 거절됐어요';
    tag = "reward-rejected-" + rn.ts;
  } else {
    return null;
  }

  return sendToDevices(devices, targetUsers, {
    title: title,
    body: body,
    icon: "icon-180.png",
    tag: tag,
    type: "reward_notification",
    url: "./"
  }, "families/" + familyId);
});

// ── 개발기 (users/taemin_dev) ─────────────────────────────────────────────────

// 1-dev) 가족 메시지 → 수신자에게 푸시
exports.onFamilyMessageDev = onDocumentUpdated("users/taemin_dev", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const oldMsgs = before.familyMessages || [];
  const newMsgs = after.familyMessages || [];
  if (newMsgs.length <= oldMsgs.length) return null;

  const devices = after.pushDevices || {};
  const promises = [];

  for (let i = oldMsgs.length; i < newMsgs.length; i++) {
    const msg = newMsgs[i];
    if (!msg || msg.read) continue;
    const senderName = NAMES[msg.from] || "가족";

    promises.push(sendToDevices(devices, [msg.to], {
      title: "[DEV] " + senderName + "에게서 메시지가 도착했어요 💌",
      body: msg.text,
      icon: "icon-180.png",
      tag: "family-msg-" + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: "family_msg",
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "users/taemin_dev"));
  }

  return Promise.all(promises);
});

// 2-dev) 기분 업데이트 → 다른 가족에게 푸시
exports.onMoodUpdateDev = onDocumentUpdated("users/taemin_dev", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.moodNotify ||
    (before.moodNotify && before.moodNotify.ts === after.moodNotify.ts)) {
    return null;
  }

  const mn = after.moodNotify;
  const devices = after.pushDevices || {};
  const senderName = NAMES[mn.user] || "가족";
  const allUsers = Object.keys(NAMES);
  const otherUsers = allUsers.filter(u => u !== mn.user);

  return sendToDevices(devices, otherUsers, {
    title: "[DEV] " + senderName + "의 기분이 바뀌었어요 " + mn.emoji,
    body: senderName + "이(가) 지금 " + mn.label + " 기분이래요!",
    icon: "icon-180.png",
    tag: "mood-" + mn.user,
    type: "mood_update",
    from: mn.user,
    mood: mn.mood,
    url: "./"
  }, "users/taemin_dev");
});

// 3-dev) 전체 알림 (관리자용)
exports.onBroadcastPushDev = onDocumentUpdated("users/taemin_dev", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after.pushBroadcast ||
    (before.pushBroadcast && before.pushBroadcast.ts === after.pushBroadcast.ts)) {
    return null;
  }

  const broadcast = after.pushBroadcast;
  const devices = after.pushDevices || {};
  const allUsers = Object.keys(NAMES);

  return sendToDevices(devices, allUsers, {
    title: broadcast.title || "태민이 마일리지 🌟",
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "users/taemin_dev");
});

// 4-dev) 보상 요청/승인/거절 알림
exports.onRewardRequestDev = onDocumentUpdated("users/taemin_dev", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!after.rewardNotify ||
    (before.rewardNotify && before.rewardNotify.ts === after.rewardNotify.ts)) {
    return null;
  }

  const rn = after.rewardNotify;
  const devices = after.pushDevices || {};
  const targetUsers = rn.targetUsers || [];

  let title, body, tag;
  if (rn.type === 'request') {
    title = "🎁 보상 사용 요청이 도착했어요!";
    body = `태민이가 "${rn.rwdName}" 사용을 요청했어요`;
    tag = "reward-request-" + rn.ts;
  } else if (rn.type === 'approved') {
    title = "✅ 보상 사용이 승인되었어요!";
    body = `"${rn.rwdName}" 사용이 승인됐어요!`;
    tag = "reward-approved-" + rn.ts;
  } else if (rn.type === 'rejected') {
    title = "❌ 보상 사용이 거절되었어요";
    body = `"${rn.rwdName}" 사용이 거절됐어요`;
    tag = "reward-rejected-" + rn.ts;
  } else {
    return null;
  }

  return sendToDevices(devices, targetUsers, {
    title: title,
    body: body,
    icon: "icon-180.png",
    tag: tag,
    type: "reward_notification",
    url: "./"
  }, "users/taemin_dev");
});
