/**
 * 태민이 마일리지 — 푸시 알림 발송 스크립트
 *
 * 사용법:
 *   1. npm install web-push firebase-admin
 *   2. 서비스 계정 키 파일을 serviceAccountKey.json 으로 저장
 *   3. node push-sender.js "알림 제목" "알림 내용"
 *
 * 또는 cron으로 매일 저녁 7시에 리마인더:
 *   0 19 * * * node /path/to/push-sender.js "오늘 활동은 다 했니? 🌟" "아직 안 한 활동이 있으면 마일리지를 모아보자!"
 */

const webpush = require('web-push');
const admin = require('firebase-admin');

// VAPID 설정
const VAPID_PUBLIC = 'BMqfqNW-_vInMwqdq3H01AKHBepukX3-Lk1RX8ZkZ97jlixIOS7hIZDRJ0gwNy00hARwc2XilfOHnx9WBlcNJfI';
const VAPID_PRIVATE = 'N6--Fo1_AniJRygwzF57hbNaapW26ntk30PnT1LOK1I';

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

async function sendPush(title, body) {
  try {
    // Firestore에서 구독 정보 가져오기
    const subDoc = await firestore.collection('push_subscriptions').doc('taemin').get();
    if (!subDoc.exists || !subDoc.data().enabled) {
      console.log('푸시 구독이 없거나 비활성화 상태입니다.');
      return;
    }

    const subscription = JSON.parse(subDoc.data().subscription);
    const payload = JSON.stringify({
      title: title || '태민이 마일리지 🌟',
      body: body || '오늘 활동을 확인해보세요!',
      icon: 'icon-180.png',
      url: './'
    });

    const result = await webpush.sendNotification(subscription, payload);
    console.log('✅ 푸시 발송 성공:', result.statusCode);
  } catch (error) {
    if (error.statusCode === 410) {
      console.log('구독이 만료됐습니다. Firestore에서 제거합니다.');
      await firestore.collection('push_subscriptions').doc('taemin').update({ enabled: false });
    } else {
      console.error('❌ 푸시 발송 실패:', error.message);
    }
  }
}

// CLI 실행
const title = process.argv[2] || '태민이 마일리지 🌟';
const body = process.argv[3] || '오늘 활동을 확인해보세요!';
sendPush(title, body).then(() => process.exit(0));
