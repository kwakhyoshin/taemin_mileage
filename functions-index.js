const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();
const db = admin.firestore();

webpush.setVapidDetails(
  "mailto:nonmarking@gmail.com",
  "BMqfqNW-_vInMwqdq3H01AKHBepukX3-Lk1RX8ZkZ97jlixIOS7hIZDRJ0gwNy00hARwc2XilfOHnx9WBlcNJfI",
  "N6--Fo1_AniJRygwzF57hbNaapW26ntk30PnT1LOK1I"
);

const NAMES = { taemin: "태민이", dad: "아빠", mom: "엄마" };

function sendToDevices(devices, targetUsers, payload) {
  const promises = [];
  for (const [deviceId, device] of Object.entries(devices)) {
    if (device.enabled && targetUsers.includes(device.user)) {
      try {
        const sub = JSON.parse(device.subscription);
        promises.push(
          webpush.sendNotification(sub, JSON.stringify(payload)).catch((err) => {
            console.log("Push failed for device", deviceId, err.statusCode);
            if (err.statusCode === 404 || err.statusCode === 410) {
              return db.doc("users/taemin").update({
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

// 1) 가족 메시지 → 수신자에게 푸시 (새로 추가된 메시지 전부 처리)
exports.onFamilyMessage = onDocumentUpdated("users/taemin", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const oldMsgs = before.familyMessages || [];
  const newMsgs = after.familyMessages || [];
  if (newMsgs.length <= oldMsgs.length) return null;

  const devices = after.pushDevices || {};
  const promises = [];

  // 새로 추가된 메시지 모두에 대해 푸시 전송
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
    }));
  }

  return Promise.all(promises);
});

// 2) 기분 업데이트 → 다른 가족에게 푸시
exports.onMoodUpdate = onDocumentUpdated("users/taemin", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // moodNotify 필드가 변경됐는지 확인
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
  });
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
  });
});

// 4) 보상 요청/승인/거절 알림
exports.onRewardRequest = onDocumentUpdated("users/taemin", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // rewardNotify 필드가 변경됐는지 확인
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
  });
});
