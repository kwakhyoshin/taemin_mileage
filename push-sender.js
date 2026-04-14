/**
 * 태민이 마일리지 — 푸시 알림 발송 스크립트
 *
 * 사용법:
 *   1. npm install web-push firebase-admin
 *   2. 서비스 계정 키 파일을 serviceAccountKey.json 으로 저장
 *   3. node push-sender.js "알림 제목" "알림 내용"
 *      node push-sender.js --env=dev "알림 제목" "알림 내용"
 *
 * 옵션:
 *   --env=dev    개발 환경 (users/taemin_dev 문서에서 구독 정보 읽기)
 *   --env=prod   운영 환경 (기본값, users/taemin 문서)
 *
 * 또는 cron으로 매일 저녁 7시에 리마인더:
 *   0 19 * * * node /path/to/push-sender.js "오늘 활동은 다 했니? 🌟" "아직 안 한 활동이 있으면 마일리지를 모아보자!"
 */

const webpush = require('web-push');
const admin = require('firebase-admin');

// VAPID 설정 — Private Key는 환경변수에서 로드 (코드에 하드코딩 금지)
// 실행 전: export VAPID_PRIVATE_KEY="your-vapid-private-key"
const VAPID_PUBLIC = 'BMqfqNW-_vInMwqdq3H01AKHBepukX3-Lk1RX8ZkZ97jlixIOS7hIZDRJ0gwNy00hARwc2XilfOHnx9WBlcNJfI';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
if (!VAPID_PRIVATE) { console.error('ERROR: VAPID_PRIVATE_KEY 환경변수가 설정되지 않았습니다.'); process.exit(1); }

webpush.setVapidDetails(
  'mailto:nonmarking@gmail.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// Firebase 초기화
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();
const messaging = admin.messaging();

// CLI 인자 파싱
const args = process.argv.slice(2);
let env = 'prod';
const nonFlagArgs = [];
for (const arg of args) {
  if (arg.startsWith('--env=')) {
    env = arg.split('=')[1];
  } else {
    nonFlagArgs.push(arg);
  }
}

const ENV_CONFIG = {
  prod: { docPath: 'users/taemin', prefix: '' },
  dev:  { docPath: 'users/taemin_dev', prefix: '[DEV] ' }
};

if (!ENV_CONFIG[env]) {
  console.error(`❌ 알 수 없는 환경: ${env}. 'prod' 또는 'dev'를 사용하세요.`);
  process.exit(1);
}

const { docPath, prefix } = ENV_CONFIG[env];
console.log(`📡 환경: ${env.toUpperCase()} (${docPath})`);

async function sendPush(title, body) {
  try {
    // Firestore에서 pushDevices 가져오기 (새 구조)
    const doc = await firestore.doc(docPath).get();
    if (!doc.exists) {
      console.log(`문서가 없습니다: ${docPath}`);
      return;
    }

    const data = doc.data();
    const devices = data.pushDevices || {};
    const enabledDevices = Object.entries(devices).filter(([,d]) => d.enabled);

    if (enabledDevices.length === 0) {
      console.log('활성화된 기기가 없습니다.');
      return;
    }

    console.log(`📱 ${enabledDevices.length}대의 기기에 발송 중...`);

    const finalTitle = prefix + (title || '태민이 마일리지 🌟');
    const finalBody = body || '오늘 활동을 확인해보세요!';
    // Web Push 페이로드 (JSON 문자열)
    const webPayload = JSON.stringify({
      title: finalTitle,
      body: finalBody,
      icon: 'icon-180.png',
      url: './'
    });

    let success = 0, failed = 0;
    for (const [deviceId, device] of enabledDevices) {
      // ── FCM (Android 네이티브 앱) 분기 ──
      if (device.type === 'fcm' && device.fcmToken) {
        try {
          const mid = await messaging.send({
            token: device.fcmToken,
            // APK MilelyFirebaseMessagingService는 data 우선 읽음 → notification 블록 미포함
            android: {
              priority: 'high',
              notification: { icon: 'ic_notification', color: '#6366F1', sound: 'default' }
            },
            data: {
              type:    'broadcast',
              title:   finalTitle,
              body:    finalBody,
              from:    '',
              msgText: finalBody,
              emotion: '',
              url:     './',
              tag:     'cli-broadcast'
            }
          });
          console.log(`  ✅ ${deviceId} (${device.user}) [FCM]: ${mid}`);
          success++;
        } catch (error) {
          if (error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token') {
            console.log(`  ⚠️ ${deviceId}: FCM 토큰 만료, 비활성화 처리`);
            await firestore.doc(docPath).update({
              [`pushDevices.${deviceId}.enabled`]: false
            });
          } else {
            console.error(`  ❌ ${deviceId} [FCM]: ${error.message}`);
          }
          failed++;
        }
        continue;
      }
      // ── Web Push (PWA / 브라우저) 분기 ──
      if (!device.subscription) {
        console.log(`  ⚠️ ${deviceId}: subscription 없음 (type=${device.type||'?'}) — 건너뜀`);
        failed++;
        continue;
      }
      try {
        const sub = JSON.parse(device.subscription);
        const result = await webpush.sendNotification(sub, webPayload);
        console.log(`  ✅ ${deviceId} (${device.user}) [WebPush]: ${result.statusCode}`);
        success++;
      } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`  ⚠️ ${deviceId}: WebPush 구독 만료, 비활성화 처리`);
          await firestore.doc(docPath).update({
            [`pushDevices.${deviceId}.enabled`]: false
          });
        } else {
          console.error(`  ❌ ${deviceId} [WebPush]: ${error.message}`);
        }
        failed++;
      }
    }

    console.log(`\n📊 결과: 성공 ${success}, 실패 ${failed}`);
  } catch (error) {
    console.error('❌ 푸시 발송 실패:', error.message);
  }
}

// CLI 실행
const title = nonFlagArgs[0] || '태민이 마일리지 🌟';
const body = nonFlagArgs[1] || '오늘 활동을 확인해보세요!';
sendPush(title, body).then(() => process.exit(0));
