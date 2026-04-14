const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// VAPID Private Key는 Firebase Functions 환경변수에서 로드
// 설정: firebase functions:secrets:set VAPID_PRIVATE_KEY
const { defineSecret } = require("firebase-functions/params");
const vapidPrivateKey = defineSecret("VAPID_PRIVATE_KEY");

const VAPID_PUBLIC = "BMqfqNW-_vInMwqdq3H01AKHBepukX3-Lk1RX8ZkZ97jlixIOS7hIZDRJ0gwNy00hARwc2XilfOHnx9WBlcNJfI";

// VAPID 설정은 함수 핸들러 내부에서만 호출 가능 (defineSecret은 런타임에서만 .value() 사용 가능)
let vapidConfigured = false;
function ensureVapid() {
  if (!vapidConfigured) {
    webpush.setVapidDetails("mailto:nonmarking@gmail.com", VAPID_PUBLIC, vapidPrivateKey.value());
    vapidConfigured = true;
  }
}

const NAMES = { taemin: "태민이", dad: "아빠", mom: "엄마" };

// 가족 메시지의 msg.type에 따라 푸시 페이로드(타입/제목)를 결정
// — APK handleNativeNotificationClick이 type별로 화면 분기 처리함
function buildFamilyMsgPayload(msg, senderName) {
  const t = msg.type || "";
  let pushType = "family_msg";
  let title = senderName + "에게서 메시지가 도착했어요 💌";
  if (t === "activity_verify_request") {
    pushType = "activity_verify";
    title = "✋ " + senderName + "이(가) 활동 승인을 요청했어요";
  } else if (t === "activity_verify_approval") {
    pushType = "activity_verify";
    title = "✅ 활동 승인됨";
  } else if (t === "activity_verify_rejection") {
    pushType = "activity_verify";
    title = "❌ 활동 반려됨";
  }
  return { pushType, title };
}

function sendToDevices(devices, targetUsers, payload, docPath) {
  const promises = [];
  for (const [deviceId, device] of Object.entries(devices)) {
    if (!device.enabled || !targetUsers.includes(device.user)) continue;

    if (device.type === "fcm" && device.fcmToken) {
      // ── FCM (Android 네이티브 앱) ──────────────────────────────────────────
      promises.push(
        messaging.send({
          token: device.fcmToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          android: {
            notification: {
              icon: "ic_notification",
              color: "#6366F1",
              sound: "default",
            },
            priority: "high",
          },
          // ★ APK MilelyFirebaseMessagingService는 data 페이로드를 우선 읽음
          //   notification 블록만 있으면 앱 백그라운드 시 FCM SDK가 기본 트레이로
          //   그려서 채널/Importance 커스터마이즈가 무시됨 → title/body도 data에 포함
          data: {
            type:     String(payload.type    || ""),
            title:    String(payload.title   || ""),
            body:     String(payload.body    || ""),
            from:     String(payload.from    || ""),
            msgText:  String(payload.msgText || payload.body || ""),
            emotion:  String(payload.emotion || ""),
            url:      String(payload.url     || ""),
            tag:      String(payload.tag     || ""),
          },
        }).catch((err) => {
          console.log("FCM send failed for device", deviceId, err.code);
          // 토큰 만료 또는 무효 → Firestore에서 비활성화
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            return db.doc(docPath).update({
              [`pushDevices.${deviceId}.enabled`]: false,
            });
          }
        })
      );
    } else if (device.subscription) {
      // ── Web Push (PWA / 브라우저) ─────────────────────────────────────────
      try {
        const sub = JSON.parse(device.subscription);
        promises.push(
          webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
            console.log("Web Push failed for device", deviceId, err.statusCode);
            if (err.statusCode === 404 || err.statusCode === 410) {
              return db.doc(docPath).update({
                [`pushDevices.${deviceId}.enabled`]: false,
              });
            }
          })
        );
      } catch (e) {
        console.log("Invalid web push subscription for device", deviceId);
      }
    }
  }
  return Promise.all(promises);
}

// ── 운영 (users/taemin) ──────────────────────────────────────────────────────

// 1) 가족 메시지 → 수신자에게 푸시
exports.onFamilyMessage = onDocumentUpdated({ document: "users/taemin", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
    const pp = buildFamilyMsgPayload(msg, senderName);

    promises.push(sendToDevices(devices, [msg.to], {
      title: pp.title,
      body: msg.text,
      icon: "icon-180.png",
      tag: (pp.pushType === "activity_verify" ? "activity-verify-" : "family-msg-") + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: pp.pushType,
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "users/taemin"));
  }

  return Promise.all(promises);
});

// 2) 기분 업데이트 → 다른 가족에게 푸시
exports.onMoodUpdate = onDocumentUpdated({ document: "users/taemin", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
exports.onBroadcastPush = onDocumentUpdated({ document: "users/taemin", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after.pushBroadcast ||
    (before.pushBroadcast && before.pushBroadcast.ts === after.pushBroadcast.ts)) {
    return null;
  }

  const broadcast = after.pushBroadcast;
  const devices = after.pushDevices || {};
  const allUsers = Object.keys(NAMES);
  // targetUser 지정 시 해당 유저에게만 발송 (관리자 테스트 알림)
  const targetUsers = broadcast.targetUser ? [broadcast.targetUser] : allUsers;

  return sendToDevices(devices, targetUsers, {
    title: broadcast.title || "태민이 마일리지 🌟",
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "users/taemin");
});

// 4) 보상 요청/승인/거절 알림
exports.onRewardRequest = onDocumentUpdated({ document: "users/taemin", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
exports.onFamilyMessageFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
    const pp = buildFamilyMsgPayload(msg, senderName);

    promises.push(sendToDevices(devices, [msg.to], {
      title: pp.title,
      body: msg.text,
      icon: "icon-180.png",
      tag: (pp.pushType === "activity_verify" ? "activity-verify-" : "family-msg-") + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: pp.pushType,
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "families/" + familyId));
  }

  return Promise.all(promises);
});

// 6) 기분 업데이트 → 다른 가족에게 푸시 (families)
exports.onMoodUpdateFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
exports.onBroadcastPushFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
  const targetUsers = broadcast.targetUser ? [broadcast.targetUser] : allUsers;

  return sendToDevices(devices, targetUsers, {
    title: broadcast.title || "태민이 마일리지 🌟",
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "families/" + familyId);
});

// 8) 보상 요청/승인/거절 알림 (families)
exports.onRewardRequestFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
exports.onFamilyMessageDevFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
    const pp = buildFamilyMsgPayload(msg, senderName);

    promises.push(sendToDevices(devices, [msg.to], {
      title: "[DEV] " + pp.title,
      body: msg.text,
      icon: "icon-180.png",
      tag: (pp.pushType === "activity_verify" ? "activity-verify-" : "family-msg-") + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: pp.pushType,
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "families/" + familyId));
  }

  return Promise.all(promises);
});

// 6-dev) 기분 업데이트 (dev families)
exports.onMoodUpdateDevFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
exports.onBroadcastPushDevFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
  const targetUsers = broadcast.targetUser ? [broadcast.targetUser] : allUsers;

  return sendToDevices(devices, targetUsers, {
    title: "[DEV] " + (broadcast.title || "태민이 마일리지 🌟"),
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "families/" + familyId);
});

// 8-dev) 보상 요청/승인/거절 알림 (dev families)
exports.onRewardRequestDevFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
exports.onFamilyMessageDev = onDocumentUpdated({ document: "users/taemin_dev", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
    const pp = buildFamilyMsgPayload(msg, senderName);

    promises.push(sendToDevices(devices, [msg.to], {
      title: "[DEV] " + pp.title,
      body: msg.text,
      icon: "icon-180.png",
      tag: (pp.pushType === "activity_verify" ? "activity-verify-" : "family-msg-") + msg.from + "-" + msg.to + "-" + (msg.ts || Date.now()),
      type: pp.pushType,
      from: msg.from,
      msgText: msg.text,
      url: "./"
    }, "users/taemin_dev"));
  }

  return Promise.all(promises);
});

// 2-dev) 기분 업데이트 → 다른 가족에게 푸시
exports.onMoodUpdateDev = onDocumentUpdated({ document: "users/taemin_dev", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
exports.onBroadcastPushDev = onDocumentUpdated({ document: "users/taemin_dev", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after.pushBroadcast ||
    (before.pushBroadcast && before.pushBroadcast.ts === after.pushBroadcast.ts)) {
    return null;
  }

  const broadcast = after.pushBroadcast;
  const devices = after.pushDevices || {};
  const allUsers = Object.keys(NAMES);
  const targetUsers = broadcast.targetUser ? [broadcast.targetUser] : allUsers;

  return sendToDevices(devices, targetUsers, {
    title: broadcast.title || "태민이 마일리지 🌟",
    body: broadcast.body || "새 알림이 있어요!",
    icon: "icon-180.png",
    tag: "broadcast",
    type: "broadcast",
    url: "./"
  }, "users/taemin_dev");
});

// ── activity_verify: actVerifyRequests 배열 변화 감지 ────────────────────────
// 이미 familyMessages의 activity_verify_request 타입으로도 푸시가 발송되지만,
// 만일 familyMessage 쓰기가 실패하거나 누락된 경우를 대비한 안전망 트리거.
// 새 pending 요청이 추가된 경우에만 발송 (승인/반려는 이미 familyMessage가 처리).
function _findNewActVerifyRequest(before, after) {
  const arrA = Array.isArray(after && after.actVerifyRequests) ? after.actVerifyRequests : [];
  if (!arrA.length) return null;
  const arrB = Array.isArray(before && before.actVerifyRequests) ? before.actVerifyRequests : [];
  const seen = new Set(arrB.map(r => r && r.id).filter(Boolean));
  // 마지막 원소부터 훑어 pending 상태 새 요청 1개 반환
  for (let i = arrA.length - 1; i >= 0; i--) {
    const r = arrA[i];
    if (!r || !r.id) continue;
    if (seen.has(r.id)) continue;
    if (r.status && r.status !== 'pending') continue;
    return r;
  }
  return null;
}

function _buildActVerifyPayload(req, after) {
  const names = (after && after.users) || NAMES;
  const childId = req.forChild || req.fromUser;
  const childName = (names[childId] && names[childId].name) || NAMES[childId] || "자녀";
  return {
    title: "✋ " + childName + "이(가) 활동 승인을 요청했어요",
    body: '"' + (req.actName || "활동") + '" 완료를 승인해주세요',
    icon: "icon-180.png",
    tag: "activity-verify-" + req.id,
    type: "activity_verify",
    url: "./"
  };
}

// 운영 families
exports.onActVerifyRequestFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
  const familyId = event.params.familyId;
  if (familyId.startsWith("dev_") || familyId.startsWith("_")) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();
  const req = _findNewActVerifyRequest(before, after);
  if (!req) return null;
  const devices = after.pushDevices || {};
  const targetUsers = Array.isArray(req.toUsers) ? req.toUsers : [];
  if (!targetUsers.length) return null;
  return sendToDevices(devices, targetUsers, _buildActVerifyPayload(req, after), "families/" + familyId);
});

// 개발 families
exports.onActVerifyRequestDevFamilies = onDocumentUpdated({ document: "families/{familyId}", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
  const familyId = event.params.familyId;
  if (!(familyId.startsWith("dev_") || familyId.startsWith("_"))) return null;
  const before = event.data.before.data();
  const after = event.data.after.data();
  const req = _findNewActVerifyRequest(before, after);
  if (!req) return null;
  const devices = after.pushDevices || {};
  const targetUsers = Array.isArray(req.toUsers) ? req.toUsers : [];
  if (!targetUsers.length) return null;
  const payload = _buildActVerifyPayload(req, after);
  payload.title = "[DEV] " + payload.title;
  return sendToDevices(devices, targetUsers, payload, "families/" + familyId);
});

// 레거시 users/taemin(_dev)
exports.onActVerifyRequestLegacy = onDocumentUpdated({ document: "users/taemin", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
  const before = event.data.before.data();
  const after = event.data.after.data();
  const req = _findNewActVerifyRequest(before, after);
  if (!req) return null;
  const devices = after.pushDevices || {};
  const targetUsers = Array.isArray(req.toUsers) ? req.toUsers : [];
  if (!targetUsers.length) return null;
  return sendToDevices(devices, targetUsers, _buildActVerifyPayload(req, after), "users/taemin");
});
exports.onActVerifyRequestLegacyDev = onDocumentUpdated({ document: "users/taemin_dev", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
  const before = event.data.before.data();
  const after = event.data.after.data();
  const req = _findNewActVerifyRequest(before, after);
  if (!req) return null;
  const devices = after.pushDevices || {};
  const targetUsers = Array.isArray(req.toUsers) ? req.toUsers : [];
  if (!targetUsers.length) return null;
  const payload = _buildActVerifyPayload(req, after);
  payload.title = "[DEV] " + payload.title;
  return sendToDevices(devices, targetUsers, payload, "users/taemin_dev");
});

// 4-dev) 보상 요청/승인/거절 알림
exports.onRewardRequestDev = onDocumentUpdated({ document: "users/taemin_dev", secrets: [vapidPrivateKey] }, async (event) => {
  ensureVapid();
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
