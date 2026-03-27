/**
 * Firestore Migration Script (REST API 방식)
 * 운영기(users/taemin) → 개발기(families/dev_kwak_family) 마이그레이션
 *
 * 사용법:
 *   node scripts/migrate-prod-to-dev.js
 *
 * 사전 준비:
 *   firebase login 으로 로그인 되어 있어야 함
 *   ~/.config/configstore/firebase-tools.json 에 토큰이 있어야 함
 *
 * 주의: 운영기 데이터는 읽기만! 절대 수정/삭제 없음.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── 설정 ──────────────────────────────────────────────────
const PROJECT_ID = 'taemin-mileage';

// Firebase CLI OAuth 클라이언트 (firebase-tools 15.x 기준)
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

// 마이그레이션 타겟
const DEV_FAMILY_ID = 'dev_kwak_family';

// 3인 가족 멤버 정의
const MEMBER_DEFS = {
  taemin: { name: '태민', role: 'child',     displayRole: '',    color: '#D1FAE5', isAdmin: false, type: 'child'     },
  dad:    { name: '아빠', role: 'caregiver', displayRole: '아빠', color: '#EEF2FF', isAdmin: true,  type: 'caregiver' },
  mom:    { name: '엄마', role: 'caregiver', displayRole: '엄마', color: '#FDF2F8', isAdmin: false, type: 'caregiver' },
};

// ── Firebase CLI refresh_token 읽기 ──────────────────────
function getRefreshToken() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`firebase-tools config not found: ${configPath}\n  → firebase login 으로 먼저 로그인하세요.`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = config?.tokens?.refresh_token;
  if (!token) throw new Error('refresh_token 이 없습니다. firebase login 으로 재로그인하세요.');
  return token;
}

// ── OAuth 토큰 갱신 ──────────────────────────────────────
function refreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString();

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.access_token) resolve(parsed.access_token);
        else reject(new Error('Token refresh failed: ' + data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Firestore REST API 헬퍼 ───────────────────────────────
function request(method, docPath, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents${docPath}`,
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} ${method} ${docPath}: ${data}`));
          return;
        }
        try { resolve(data ? JSON.parse(data) : {}); }
        catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Firestore 값 변환 ─────────────────────────────────────
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return {};
  return fromFields(doc.fields);
}

function fromFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = fromValue(v);
  return obj;
}

function fromValue(val) {
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromValue);
  if ('mapValue' in val) return fromFields(val.mapValue.fields || {});
  return null;
}

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return { fields };
}

// ── 컬렉션 문서 목록 조회 ────────────────────────────────
async function listDocuments(token, collectionId) {
  const results = [];
  let pageToken = null;
  do {
    const qs = pageToken ? `?pageToken=${pageToken}` : '';
    const res = await request('GET', `/${collectionId}${qs}`, token);
    if (res.documents) {
      for (const doc of res.documents) results.push(doc.name.split('/').pop());
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return results;
}

// ── 유틸 ──────────────────────────────────────────────────
function generateMemberId() {
  return 'm_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function log(msg) { console.log('[migrate]', msg); }

// ── 메인 ──────────────────────────────────────────────────
async function main() {
  log('Firebase CLI refresh_token 읽는 중...');
  const refreshToken = getRefreshToken();

  log('OAuth 토큰 갱신 중...');
  const token = await refreshAccessToken(refreshToken);
  log('토큰 취득 성공');

  // A. 개발기 테스트 데이터 삭제
  log('\n=== A. 개발기 테스트 데이터 삭제 ===');
  await deleteDevData(token);

  // B. 운영기 데이터 읽기
  log('\n=== B. 운영기 데이터 읽기 ===');
  const prodData = await readProdData(token);

  // C. 마이그레이션
  log('\n=== C. 운영기 → 개발기 마이그레이션 ===');
  await migrateToFamilies(token, prodData);

  log('\n✅ 마이그레이션 완료!');
}

// ── A. 개발기 테스트 데이터 삭제 ─────────────────────────
async function deleteDevData(token) {
  const allIds = await listDocuments(token, 'families');
  log(`  families/ 전체 문서 수: ${allIds.length}`);

  let deletedCount = 0;
  for (const id of allIds) {
    if (id.startsWith('dev_') || id === '_dev_id_registry') {
      log(`  삭제: families/${id}`);
      await request('DELETE', `/families/${id}`, token);
      deletedCount++;
    }
  }

  if (deletedCount === 0) log('  삭제할 dev_ 문서 없음');
  else log(`  삭제 완료: ${deletedCount}개`);
}

// ── B. 운영기 데이터 읽기 ─────────────────────────────────
async function readProdData(token) {
  const doc = await request('GET', '/users/taemin', token);
  const data = fromFirestoreDoc(doc);

  if (!data || Object.keys(data).length === 0) {
    throw new Error('users/taemin 문서가 없거나 비어있습니다!');
  }

  log(`  users/taemin 읽기 성공`);
  log(`  pts: ${data.pts ?? '?'}, streak: ${data.streak ?? '?'}`);
  log(`  log 항목 수: ${(data.log || []).length}`);
  log(`  acts 수: ${Object.keys(data.acts || {}).length}`);
  log(`  rwds 수: ${Object.keys(data.rwds || {}).length}`);
  log(`  rewardLog 수: ${(data.rewardLog || []).length}`);
  log(`  badges 수: ${Object.keys(data.badges || {}).length}`);
  log(`  필드 목록: ${Object.keys(data).join(', ')}`);

  return data;
}

// ── C. 마이그레이션 ──────────────────────────────────────
async function migrateToFamilies(token, prodData) {
  const now = Date.now();

  const memberIds = {
    taemin: generateMemberId(),
    dad:    generateMemberId(),
    mom:    generateMemberId(),
  };
  log(`  멤버 IDs: ${JSON.stringify(memberIds)}`);

  const members = {};
  for (const [key, def] of Object.entries(MEMBER_DEFS)) {
    members[memberIds[key]] = {
      name:        def.name,
      role:        def.role,
      displayRole: def.displayRole,
      color:       def.color,
      isAdmin:     def.isAdmin,
      type:        def.type,
      account:     null, // 개발 테스트용 — 로그인 없이도 진입 가능하게
      joinedAt:    now,
    };
  }

  const familyMeta = {
    familyId:     DEV_FAMILY_ID,
    familyName:   '곽씨 가족',
    createdAt:    now,
    createdBy:    memberIds.dad,
    mode:         'shared',
    members,
    inviteTokens: [],
  };

  // 태민 memberData (독립 모드 전환 시 활용)
  const taeminMemberData = {
    pts:       prodData.pts       || 0,
    streak:    prodData.streak    || 0,
    longest:   prodData.longest   || 0,
    lastDate:  prodData.lastDate  || null,
    totalDone: prodData.totalDone || 0,
    acts:      prodData.acts      || {},
    rwds:      prodData.rwds      || {},
    log:       prodData.log       || [],
    actDone:   prodData.actDone   || {},
    moodLog:   prodData.moodLog   || [],
    badges:    prodData.badges    || {},
    badgeLog:  prodData.badgeLog  || [],
  };

  const newState = {
    // 공유 모드 포인트/활동 (운영 데이터 복사)
    pts:       prodData.pts       || 0,
    streak:    prodData.streak    || 0,
    longest:   prodData.longest   || 0,
    lastDate:  prodData.lastDate  || null,
    totalDone: prodData.totalDone || 0,
    acts:      prodData.acts      || {},
    rwds:      prodData.rwds      || {},
    log:       prodData.log       || [],
    moodLog:   prodData.moodLog   || [],
    badges:    prodData.badges    || {},
    badgeLog:  prodData.badgeLog  || [],
    settings: {
      streakBonus:    prodData.settings?.streakBonus    ?? true,
      streakBonusPts: prodData.settings?.streakBonusPts ?? 100,
      pinHash:        '', // 개발기에서는 핀 초기화
      msgMode:        prodData.settings?.msgMode        || 'auto',
      customMsg:      prodData.settings?.customMsg      || '',
    },
    actDone:         prodData.actDone         || {},
    dark:            prodData.dark            || false,
    greetings:       prodData.greetings       || {},
    customBadges:    prodData.customBadges    || [],
    badgeOverrides:  prodData.badgeOverrides  || {},
    users:           {}, // 보안상 운영 비밀번호 해시 미복사
    rewardInventory: prodData.rewardInventory || [],
    rewardRequests:  prodData.rewardRequests  || [],
    rewardLog:       prodData.rewardLog       || [],
    rewardNotify:    null,
    familyMessages:  prodData.familyMessages  || [],
    photos:          prodData.photos          || {},
    moods:           prodData.moods           || {},
    stickers:        prodData.stickers        || [],
    pushDevices:     {}, // 개발기 푸시 디바이스 초기화
    familyMeta,
    memberData:      { [memberIds.taemin]: taeminMemberData },
  };

  // families/dev_kwak_family 저장
  log(`  저장 중: families/${DEV_FAMILY_ID}...`);
  await request('PATCH', `/families/${DEV_FAMILY_ID}`, token, toFirestoreDoc(newState));
  log(`  저장 완료!`);

  // _dev_id_registry 저장 (테스트 로그인용)
  const registryData = {};
  for (const [key, memberId] of Object.entries(memberIds)) {
    registryData[`dev_${key}`] = { familyId: DEV_FAMILY_ID, memberId };
  }
  log(`  _dev_id_registry 저장 중...`);
  await request('PATCH', '/families/_dev_id_registry', token, toFirestoreDoc(registryData));
  log(`  _dev_id_registry 저장 완료!`);

  log(`\n  ─── 마이그레이션 요약 ───`);
  log(`  문서: families/${DEV_FAMILY_ID}`);
  log(`  가족명: 곽씨 가족 (mode: shared)`);
  log(`  멤버:`);
  log(`    아빠  → ${memberIds.dad}   (isAdmin: true,  로그인ID: dev_dad)`);
  log(`    엄마  → ${memberIds.mom}   (isAdmin: false, 로그인ID: dev_mom)`);
  log(`    태민  → ${memberIds.taemin} (isAdmin: false, 로그인ID: dev_taemin)`);
  log(`  포인트: ${newState.pts}점`);
  log(`  활동 기록: ${(newState.log || []).length}건`);
  log(`  보상 기록: ${(newState.rewardLog || []).length}건`);
  log(`  뱃지: ${Object.keys(newState.badges || {}).length}개`);
  log(`\n  ※ 테스트 로그인: dev_taemin / dev_dad / dev_mom`);
  log(`  ※ 비밀번호는 개발기에서 별도 설정 필요 (운영 해시 미복사)`);
}

main().catch(err => {
  console.error('[migrate] 오류:', err.message || err);
  process.exit(1);
});
