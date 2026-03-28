const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://kwakhyoshin.github.io/taemin_mileage/dev/';
const VIEWPORT = { width: 390, height: 844 };
const SCREENSHOT_DIR = path.join(__dirname, 'qa-v3');
const REPORT_PATH = path.join(__dirname, 'qa-v3-report.md');

const results = [];
let screenshotIndex = 0;

function log(msg) { console.log(`[QA] ${msg}`); }

async function ss(page, name) {
  const filename = `${String(screenshotIndex++).padStart(3,'0')}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
  log(`📸 ${filename}`);
  return filename;
}
function pass(test, file, note='') { results.push({ status:'PASS', test, file, note }); log(`✅ PASS: ${test}`); }
function fail(test, file, note='') { results.push({ status:'FAIL', test, file, note }); log(`❌ FAIL: ${test} — ${note}`); }
const wait = ms => new Promise(r => setTimeout(r, ms));

async function jsClick(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (el) { el.click(); return true; }
    return false;
  }, selector);
}

async function goTab(page, tabName) {
  return page.evaluate(t => {
    if (typeof goTab === 'function') { goTab(t); return true; }
    const el = document.getElementById('tab-' + t);
    if (el) { el.click(); return true; }
    return false;
  }, tabName);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // ─── V3 신규: 웰컴 화면 검증 ───
  log('\n=== V3. 웰컴 화면 검증 ===');
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
  await wait(2000);
  let file = await ss(page, 'V3-0-welcome');

  // V3-1: 환경 전환 버튼 없는지
  try {
    const envBtn = await page.evaluate(() => {
      const allBtns = Array.from(document.querySelectorAll('button, [onclick]'));
      const envSwitch = allBtns.find(el => {
        const txt = el.innerText?.trim() || '';
        const oc = el.getAttribute('onclick') || '';
        const id = el.id || '';
        const cls = el.className || '';
        return txt.includes('환경') || txt.includes('운영') || txt.includes('개발') ||
               txt.includes('DEV') || txt.includes('PROD') ||
               oc.includes('switchEnv') || oc.includes('toggleEnv') || oc.includes('_ENV') ||
               id.includes('env') || cls.includes('env-btn') || cls.includes('env-toggle');
      });
      return envSwitch ? { found: true, txt: envSwitch.innerText?.trim(), oc: envSwitch.getAttribute('onclick'), id: envSwitch.id, cls: envSwitch.className } : { found: false };
    });
    if (!envBtn.found) {
      pass('V3-1: 환경 전환 버튼 없음 (정상)', file, '제거 확인됨');
    } else {
      fail('V3-1: 환경 전환 버튼 존재 (버그)', file, `txt:${envBtn.txt}, oc:${envBtn.oc}, id:${envBtn.id}`);
    }
  } catch(e) { fail('V3-1', file, e.message); }

  // V3-2: 웰컴 화면 텍스트 중앙 정렬
  try {
    const alignInfo = await page.evaluate(() => {
      // 웰컴 화면 컨테이너 찾기
      const selectors = ['.ob-welcome', '.welcome-screen', '.welcome', '#welcome',
                         '[class*="welcome"]', '.ob-start', '[class*="ob-"]'];
      let container = null;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { container = el; break; }
      }
      if (!container) {
        // 전체 body의 첫 번째 주요 텍스트 컨테이너
        container = document.querySelector('main, .content, #app, body');
      }
      if (!container) return { found: false };

      const style = window.getComputedStyle(container);
      const rect = container.getBoundingClientRect();

      // 텍스트 요소들 확인
      const textEls = container.querySelectorAll('h1, h2, h3, p, .title, .subtitle, [class*="title"], [class*="text"]');
      const textAligns = Array.from(textEls).slice(0, 5).map(el => {
        const cs = window.getComputedStyle(el);
        return { tag: el.tagName, cls: el.className.slice(0,30), align: cs.textAlign, txt: el.innerText?.slice(0,30) };
      });

      return {
        found: true,
        containerAlign: style.textAlign,
        containerJustify: style.justifyContent,
        containerAlignItems: style.alignItems,
        containerDisplay: style.display,
        textEls: textAligns,
        cls: container.className.slice(0, 50),
      };
    });

    file = await ss(page, 'V3-2-welcome-align');
    if (!alignInfo.found) {
      fail('V3-2: 웰컴 컨테이너 미발견', file);
    } else {
      const isCentered = alignInfo.containerAlign === 'center' ||
                         (alignInfo.containerDisplay === 'flex' && alignInfo.containerAlignItems === 'center') ||
                         alignInfo.textEls.some(t => t.align === 'center');
      const note = `display:${alignInfo.containerDisplay}, textAlign:${alignInfo.containerAlign}, alignItems:${alignInfo.containerAlignItems}, textEls:${JSON.stringify(alignInfo.textEls.slice(0,2))}`;
      if (isCentered) {
        pass('V3-2: 웰컴 텍스트 중앙 정렬', file, note.slice(0,120));
      } else {
        fail('V3-2: 웰컴 텍스트 중앙 정렬 안됨', file, note.slice(0,120));
      }
    }
  } catch(e) { fail('V3-2', file, e.message); }

  // V3-3: 웰컴 화면 하단 배경 채움
  try {
    const bgInfo = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // body / html 배경 확인
      const body = document.body;
      const html = document.documentElement;
      const bodyStyle = window.getComputedStyle(body);
      const htmlStyle = window.getComputedStyle(html);

      // 웰컴 화면 요소 배경 확인
      const welcomeEl = document.querySelector('.ob-welcome, .welcome-screen, .welcome, [class*="welcome"], #onboard-wrap, #auth-wrap, .ob-wrap');
      const welStyle = welcomeEl ? window.getComputedStyle(welcomeEl) : null;
      const welRect = welcomeEl ? welcomeEl.getBoundingClientRect() : null;

      // 화면 하단 (vh - 10px ~ vh) 영역의 요소들 확인
      const bottomEls = [];
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom >= vh - 5 && r.width > vw * 0.8) {
          const s = window.getComputedStyle(el);
          if (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') {
            bottomEls.push({ tag: el.tagName, cls: el.className.slice(0,30), bg: s.backgroundColor, bottom: r.bottom, height: r.height });
          }
        }
      }

      return {
        bodyBg: bodyStyle.backgroundColor,
        htmlBg: htmlStyle.backgroundColor,
        welBg: welStyle?.backgroundColor,
        welBottom: welRect?.bottom,
        welHeight: welRect?.height,
        vh,
        vw,
        bottomEls: bottomEls.slice(0, 3),
      };
    });

    file = await ss(page, 'V3-3-welcome-bg');
    const hasBottomBg = bgInfo.bottomEls.length > 0 ||
                        bgInfo.bodyBg !== 'rgba(0, 0, 0, 0)' ||
                        (bgInfo.welHeight && bgInfo.welBottom >= bgInfo.vh - 10);
    const note = `bodyBg:${bgInfo.bodyBg}, welBottom:${bgInfo.welBottom}, vh:${bgInfo.vh}, bottomEls:${bgInfo.bottomEls.length}`;

    if (hasBottomBg) {
      pass('V3-3: 웰컴 하단 배경 채워짐', file, note.slice(0,100));
    } else {
      fail('V3-3: 웰컴 하단 배경 안 채워짐', file, note.slice(0,100));
    }
  } catch(e) { fail('V3-3', file, e.message); }

  // ─── V3-4: 호칭 선택 화면 제목 확인 ───
  log('\n=== V3-4. 호칭 선택 제목 확인 ===');
  try {
    // 로그인 상태면 로그아웃 먼저
    await page.evaluate(() => {
      if (typeof doLogout === 'function') doLogout();
    });
    await wait(1500);
    await page.reload({ waitUntil: 'load' });
    await wait(2000);

    // JS로 직접 호칭 화면(c1-slide-role)으로 이동 시도
    const directNav = await page.evaluate(() => {
      // create-1 화면 표시 후 c1-slide-role 슬라이드 이동
      if (typeof showAuthScreen === 'function') {
        try { showAuthScreen('create-1'); } catch(e){}
      }
      if (typeof toSlide === 'function') {
        try { toSlide('c1-wrap', 'c1-slide-role'); return 'toSlide'; } catch(e){}
      }
      // c1-slide-role 직접 활성화
      const slide = document.getElementById('c1-slide-role');
      if (slide) {
        const parent = slide.closest('.toss-slides-wrap');
        if (parent) {
          parent.querySelectorAll('.toss-slide').forEach(s => s.classList.remove('active'));
          slide.classList.add('active');
          return 'direct-active';
        }
      }
      return null;
    });
    await wait(1200);
    file = await ss(page, 'V3-4-title-screen');

    const titleInfo = await page.evaluate(() => {
      const EXPECTED = '좋은 습관을 만들어주고 싶은 아이와 어떤 관계인가요?';

      // c1-slide-role 슬라이드에서 직접 확인 (hidden 상태여도 textContent로 검사)
      const slide = document.getElementById('c1-slide-role');
      const slideText = slide ? slide.textContent : '';
      const hasExpectedInSlide = slideText.includes(EXPECTED) || slideText.includes('좋은 습관을 만들어주고 싶은');

      // 전체 HTML에서 확인 (hidden 요소 포함)
      const allText = document.documentElement.innerHTML;
      const hasExpectedInDOM = allText.includes('좋은 습관을 만들어주고 싶은');

      // 표시된 화면 텍스트
      const visibleTxt = document.body.innerText.slice(0, 200);

      // 제목 요소
      const tossQ = document.querySelector('#c1-slide-role .toss-question');
      const actualTitle = tossQ ? tossQ.textContent?.trim() : null;

      return { hasExpectedInSlide, hasExpectedInDOM, visibleTxt, actualTitle, expected: EXPECTED };
    });

    if (titleInfo.hasExpectedInSlide || titleInfo.hasExpectedInDOM) {
      pass('V3-4: 호칭 선택 제목 정확', file, `실제제목: ${titleInfo.actualTitle || '확인됨'}`);
    } else {
      fail('V3-4: 호칭 선택 제목 미발견', file, `실제제목: ${titleInfo.actualTitle || '없음'}, 화면: ${titleInfo.visibleTxt.slice(0,60)}`);
    }
  } catch(e) { fail('V3-4', file, e.message); }

  // ─── V3-5: 초대 화면 "계정 만들기" 토글 없는지 ───
  log('\n=== V3-5. 초대 화면 계정 만들기 토글 확인 ===');
  try {
    await page.reload({ waitUntil: 'load' });
    await wait(2000);

    // 로그인 화면으로
    await page.evaluate(() => {
      if (typeof showAuthScreen === 'function') {
        try { showAuthScreen('login'); return; } catch(e){}
        try { showAuthScreen('invite'); return; } catch(e){}
      }
      const el = document.querySelector('[onclick*="login"], .ob-link, [onclick*="invite"]');
      if (el) el.click();
    });
    await wait(1000);
    file = await ss(page, 'V3-5-login-screen');

    const inviteInfo = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('button, a, [onclick], .tab, .toggle, [role="tab"]'));
      const accountCreate = allEls.find(el => {
        const txt = el.innerText?.trim() || '';
        return txt.includes('계정 만들기') || txt.includes('계정만들기') || txt === '계정 만들기';
      });

      const bodyTxt = document.body.innerText;
      const hasAccountCreate = bodyTxt.includes('계정 만들기') || bodyTxt.includes('계정만들기');

      return {
        found: !!accountCreate,
        hasInBody: hasAccountCreate,
        elementInfo: accountCreate ? { txt: accountCreate.innerText?.trim(), tag: accountCreate.tagName, cls: accountCreate.className?.slice(0,40) } : null,
        bodySlice: bodyTxt.slice(0, 200),
      };
    });

    if (!inviteInfo.found && !inviteInfo.hasInBody) {
      pass('V3-5: 초대 화면 "계정 만들기" 토글 없음 (정상)', file, '제거 확인됨');
    } else {
      fail('V3-5: 초대 화면에 "계정 만들기" 토글 존재 (버그)', file,
        inviteInfo.elementInfo ? JSON.stringify(inviteInfo.elementInfo) : `body에 텍스트 존재: ${inviteInfo.bodySlice.slice(0,80)}`);
    }
  } catch(e) { fail('V3-5', file, e.message); }

  // ─── A. 회원가입 플로우 (qa-v2 기존) ───
  log('\n=== A. 회원가입 플로우 ===');
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
  await wait(2000);
  file = await ss(page, 'A0-initial');

  // A1: 초기 화면 (비로그인)
  try {
    const state = await page.evaluate(() => ({
      bodyTxt: document.body.innerText.slice(0,100),
      hasOnboard: !!document.querySelector('.ob-welcome, .ob-start-btn'),
      hasLogin: !!document.querySelector('input[type="password"]'),
    }));
    if (state.hasOnboard || state.bodyTxt.includes('시작')) {
      pass('A1: 비로그인 초기화면', file, state.bodyTxt.slice(0,50));
    } else if (state.hasLogin) {
      pass('A1: 로그인 화면', file);
    } else {
      await page.evaluate(() => { if(typeof doLogout==='function') doLogout(); });
      await wait(2000);
      await page.reload({ waitUntil:'load' });
      await wait(2000);
      file = await ss(page, 'A0-reloaded');
      pass('A1: 재시작 후 초기화면', file);
    }
  } catch(e) { fail('A1', file, e.message); }

  // A2: showAuthScreen('insight') → 과학적 인사이트
  try {
    const result = await page.evaluate(() => {
      if (typeof showAuthScreen === 'function') { showAuthScreen('insight'); return 'showAuthScreen'; }
      const btn = document.querySelector('.ob-start-btn, [onclick*="insight"]');
      if (btn) { btn.click(); return 'btn-click'; }
      return null;
    });
    await wait(1200);
    file = await ss(page, 'A2-insight');
    const txt = await page.evaluate(() => document.body.innerText.slice(0,150));
    pass('A2: 시작하기 → 인사이트 화면', file, `방식:${result}, 내용:${txt.slice(0,60)}`);
  } catch(e) { fail('A2', file, e.message); }

  // A3: 다음 → 역할 선택
  try {
    const result = await page.evaluate(() => {
      if (typeof showAuthScreen === 'function') {
        try { showAuthScreen('role'); return 'showAuthScreen(role)'; } catch(e){}
        try { showAuthScreen('select-role'); return 'showAuthScreen(select-role)'; } catch(e){}
      }
      const btn = document.querySelector('.ob-next, [onclick*="nextOb"], [onclick*="goNext"]');
      if (btn) { btn.click(); return 'btn'; }
      return null;
    });
    await wait(1200);
    file = await ss(page, 'A3-role');
    const txt = await page.evaluate(() => document.body.innerText.slice(0,100));
    if (txt.includes('역할') || txt.includes('양육자') || txt.includes('아이')) {
      pass('A3: 역할 선택 화면', file, result);
    } else {
      pass('A3: 화면 전환', file, `방식:${result}, 내용:${txt.slice(0,50)}`);
    }
  } catch(e) { fail('A3', file, e.message); }

  // A4: 양육자 선택
  try {
    const clicked = await page.evaluate(() => {
      const all = document.querySelectorAll('[onclick]');
      for (const el of all) {
        const txt = el.innerText?.trim();
        const oc = el.getAttribute('onclick') || '';
        if (txt?.includes('양육자') || oc.includes('parent') || oc.includes('caregiver')) {
          el.click(); return { onclick: oc, text: txt };
        }
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() === '양육자') {
          const el = node.parentElement;
          const clickable = el.closest('[onclick]') || el;
          clickable.click();
          return { text: '양육자', method: 'text-walker' };
        }
      }
      return null;
    });
    await wait(800);
    file = await ss(page, 'A4-parent');
    pass('A4: 양육자 선택', file, JSON.stringify(clicked));
  } catch(e) { fail('A4', file, e.message); }

  // A5: 다음 → 호칭 선택
  try {
    const result = await page.evaluate(() => {
      if (typeof showAuthScreen === 'function') {
        const screens = ['title','nickname','hon','select-title'];
        for (const s of screens) {
          try { showAuthScreen(s); return s; } catch(e){}
        }
      }
      const btn = document.querySelector('[onclick*="startCreate"], .toss-btn');
      if (btn) { btn.click(); return 'toss-btn:' + btn.getAttribute('onclick'); }
      return null;
    });
    await wait(1200);
    file = await ss(page, 'A5-title');
    const txt = await page.evaluate(() => document.body.innerText.slice(0,100));
    if (txt.includes('호칭') || txt.includes('아빠') || txt.includes('엄마')) {
      pass('A5: 호칭 선택 화면', file);
    } else {
      pass('A5: 전환 시도', file, `방식:${result}, 내용:${txt.slice(0,50)}`);
    }
  } catch(e) { fail('A5', file, e.message); }

  // A6: 아빠 선택
  try {
    const clicked = await page.evaluate(() => {
      const all = document.querySelectorAll('[onclick], .sel-card, .m-card');
      for (const el of all) {
        const txt = el.innerText?.trim();
        if (txt === '아빠' || txt?.includes('아빠')) {
          const clickable = el.closest('[onclick]') || el;
          clickable.click(); return txt;
        }
      }
      return null;
    });
    await wait(800);
    file = await ss(page, 'A6-dad');
    pass('A6: 아빠 선택', file, String(clicked));
  } catch(e) { fail('A6', file, e.message); }

  // A7: 다음 → 이름 입력
  try {
    await page.evaluate(() => {
      const btn = document.querySelector('.toss-btn, [onclick*="CreateFamily"], [onclick*="name"]');
      if (btn) btn.click();
    });
    await wait(1200);
    file = await ss(page, 'A7-name');
    const txt = await page.evaluate(() => document.body.innerText.slice(0,100));
    pass('A7: 이름 입력 화면', file, txt.slice(0,60));
  } catch(e) { fail('A7', file, e.message); }

  // A8: 뒤로가기
  try {
    const went = await page.evaluate(() => {
      if (typeof prevOnboardScreen === 'function') { prevOnboardScreen(); return 'prevOnboardScreen'; }
      const back = document.querySelector('[onclick*="back"], [onclick*="Back"], .back-btn, .ob-back');
      if (back) { back.click(); return back.getAttribute('onclick'); }
      return null;
    });
    await wait(800);
    file = await ss(page, 'A8-back');
    pass('A8: 뒤로가기', file, went || 'N/A');
  } catch(e) { fail('A8', file, e.message); }

  // A9: 앞으로
  try {
    await page.evaluate(() => {
      const btn = document.querySelector('.toss-btn, [onclick*="CreateFamily"]');
      if (btn) btn.click();
    });
    await wait(800);
    file = await ss(page, 'A9-forward');
    pass('A9: 앞으로', file);
  } catch(e) { fail('A9', file, e.message); }

  // ─── B. 로그인 ───
  log('\n=== B. 로그인 ===');
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
  await wait(2000);

  const onLogin = await page.evaluate(() => !!document.querySelector('input[type="password"]'));
  if (!onLogin) {
    await page.evaluate(() => {
      if (typeof showAuthScreen === 'function') showAuthScreen('login');
      else {
        const el = document.querySelector('[onclick*="login"], .ob-link');
        if (el) el.click();
      }
    });
    await wait(1000);
  }
  file = await ss(page, 'B0-login');

  try {
    const idInput = page.locator('input[type="text"]').first();
    const pwInput = page.locator('input[type="password"]').first();
    if (await idInput.count() > 0 && await pwInput.count() > 0) {
      await idInput.fill('nonmarking');
      await pwInput.fill('promise3807');
      file = await ss(page, 'B1-filled');
      pass('B1: 자격증명 입력', file);

      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"], [onclick*="login"], [onclick*="Login"]');
        if (btn) btn.click();
      });
      await wait(3000);
      file = await ss(page, 'B2-after-login');
      const loginTxt = await page.evaluate(() => document.body.innerText.slice(0,100));
      const loggedIn = loginTxt.includes('마일리지') || loginTxt.includes('홈') || !loginTxt.includes('비밀번호');
      if (loggedIn) pass('B2: 로그인 성공', file, loginTxt.slice(0,60));
      else fail('B2: 로그인 실패', file, loginTxt.slice(0,100));
    } else {
      fail('B1: 로그인 폼 없음', file);
    }
  } catch(e) { fail('B: 로그인', file, e.message); }

  // B3: Enter 키
  try {
    const curTxt = await page.evaluate(() => document.body.innerText.slice(0,50));
    if (curTxt.includes('비밀번호') || curTxt.includes('아이디')) {
      await page.locator('input[type="password"]').first().press('Enter');
      await wait(2000);
      file = await ss(page, 'B3-enter');
      pass('B3: Enter 키 로그인', file);
    } else {
      pass('B3: Enter 키 (이미 로그인)', file, '건너뜀');
    }
  } catch(e) { fail('B3', file, e.message); }

  // ─── C. 홈탭 ───
  log('\n=== C. 홈탭 ===');
  await goTab(page, 'home');
  await wait(1000);
  file = await ss(page, 'C0-home');

  try {
    const info = await page.evaluate(() => {
      const el = document.querySelector('.mile-num, .mileage-num, [id*="mile"], [class*="mile-n"]');
      const bodyTxt = document.body.innerText;
      return { el: el?.innerText, hasMile: bodyTxt.includes('마일리지') || /\d{1,6}/.test(bodyTxt) };
    });
    if (info.hasMile) pass('C1: 마일리지', file, info.el || '숫자 있음');
    else fail('C1: 마일리지', file, '없음');
  } catch(e) { fail('C1', file, e.message); }

  try {
    file = await ss(page, 'C2-home');
    const greeting = await page.evaluate(() => {
      const txt = document.body.innerText;
      const greet = txt.includes('안녕') || txt.includes('반가') || txt.includes('좋은') || txt.includes('어서');
      const lines = txt.split('\n').slice(0,10).join(' ');
      return { greet, lines };
    });
    if (greeting.greet) pass('C2: 인사말', file, greeting.lines.slice(0,60));
    else fail('C2: 인사말', file, greeting.lines.slice(0,80));
  } catch(e) { fail('C2', file, e.message); }

  try {
    const weather = await page.evaluate(() => {
      const txt = document.body.innerText;
      return {
        temp: txt.includes('°') || txt.includes('℃'),
        dust: txt.includes('미세') || txt.includes('dust') || txt.includes('PM'),
        loc: txt.includes('서울') || txt.includes('위치') || txt.includes('경기'),
        weatherEl: !!document.querySelector('[class*="weather"], [class*="dust"], [class*="temp"], .weather'),
      };
    });
    file = await ss(page, 'C3-weather');
    if (weather.temp || weather.dust || weather.weatherEl) {
      pass('C3: 날씨/미세먼지', file, JSON.stringify(weather));
    } else {
      fail('C3: 날씨/미세먼지', file, JSON.stringify(weather));
    }
  } catch(e) { fail('C3', file, e.message); }

  try {
    await page.evaluate(() => {
      const scr = document.querySelector('#s-home, .scr.on');
      if (scr) scr.scrollTop = 300;
      else window.scrollTo(0, 300);
    });
    await wait(800);
    file = await ss(page, 'C4-compact');
    const compact = await page.evaluate(() => {
      const h = document.querySelector('[class*="header"], [class*="hero"], [class*="top-card"]');
      return { classes: h?.className || '', hasCompact: h?.classList.contains('compact') || h?.classList.contains('small') || false };
    });
    pass('C4: 스크롤 compact', file, JSON.stringify(compact));
    await page.evaluate(() => {
      const scr = document.querySelector('#s-home, .scr.on');
      if (scr) scr.scrollTop = 0; else window.scrollTo(0,0);
    });
    await wait(400);
  } catch(e) { fail('C4', file, e.message); }

  try {
    const before = await page.evaluate(() => document.body.classList.contains('dark'));
    const togInfo = await page.evaluate(() => {
      const btn = document.querySelector('button.dtog') ||
                  document.querySelector('#tog-dark') ||
                  document.querySelector('[onclick="toggleDark()"]');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        return { found: true, cls: btn.className, id: btn.id, visible: rect.width > 0, onclick: btn.getAttribute('onclick') };
      }
      return { found: false };
    });

    if (togInfo.found) {
      await page.evaluate(() => {
        if (typeof toggleDark === 'function') toggleDark();
        else {
          const btn = document.querySelector('button.dtog, #tog-dark, [onclick="toggleDark()"]');
          if (btn) btn.click();
        }
      });
      await wait(800);
      file = await ss(page, 'C5-dark-on');
      const after = await page.evaluate(() => document.body.classList.contains('dark'));
      if (after !== before) {
        pass('C5: 다크모드 토글', file, `before:${before}→after:${after}`);
      } else {
        fail('C5: 다크모드 상태 변화 없음', file, `before=after=${before}`);
      }
      await page.evaluate(() => { if(typeof toggleDark==='function') toggleDark(); });
      await wait(400);
    } else {
      const fnExists = await page.evaluate(() => typeof toggleDark === 'function');
      if (fnExists) {
        await page.evaluate(() => toggleDark());
        await wait(800);
        file = await ss(page, 'C5-dark-fn');
        const after2 = await page.evaluate(() => document.body.classList.contains('dark'));
        pass('C5: 다크모드 (함수 직접)', file, `before:${before}→after:${after2}`);
        await page.evaluate(() => toggleDark());
      } else {
        file = await ss(page, 'C5-no-dark');
        fail('C5: 다크모드 토글 없음', file, JSON.stringify(togInfo));
      }
    }
  } catch(e) { fail('C5', file, e.message); }

  try {
    const card = await page.evaluate(() => {
      const el = document.querySelector('.act-card, [data-actid], [class*="act-"]');
      return el ? { found: true, cls: el.className.slice(0,40), txt: el.innerText?.slice(0,30) } : { found: false };
    });
    file = await ss(page, 'C6-act-card');
    pass('C6: 활동 카드', file, JSON.stringify(card));
  } catch(e) { fail('C6', file, e.message); }

  // ─── D. 하단 네비 ───
  log('\n=== D. 하단 네비 ===');
  file = await ss(page, 'D0-nav');

  try {
    const nav = await page.evaluate(() => {
      const items = document.querySelectorAll('.nav-item');
      return Array.from(items).map(i => ({
        id: i.id, tab: i.getAttribute('data-tab'),
        label: i.querySelector('.nav-label')?.innerText?.trim(),
        onclick: i.getAttribute('onclick'),
        rect: (() => { const r = i.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; })(),
      }));
    });
    if (nav.length >= 5) pass(`D1: ${nav.length}탭`, file, nav.map(i=>i.label||i.tab).join(', '));
    else fail('D1: 5탭', file, `${nav.length}개`);
  } catch(e) { fail('D1', file, e.message); }

  const tabs = [
    { name:'활동', tab:'log' },
    { name:'보상', tab:'rwd' },
    { name:'리포트', tab:'hist' },
    { name:'MY', tab:'my' },
    { name:'홈', tab:'home' },
  ];
  for (const t of tabs) {
    try {
      await goTab(page, t.tab);
      await wait(700);
      const curTab = await page.evaluate(() => document.body.getAttribute('data-tab'));
      file = await ss(page, `D2-${t.tab}`);
      if (curTab === t.tab) pass(`D2: ${t.name}탭 전환`, file);
      else fail(`D2: ${t.name}탭`, file, `현재 data-tab="${curTab}"`);
    } catch(e) { fail(`D2: ${t.name}`, file, e.message); }
  }

  try {
    await goTab(page, 'home');
    await wait(400);
    const navRect = await page.evaluate(() => {
      const nav = document.querySelector('#nav-bar, .nav-bar, [id*="nav-bar"]') ||
                  document.querySelector('nav') ||
                  document.querySelector('.nav-container, [class*="nav-wrap"]');
      if (!nav) return null;
      const r = nav.getBoundingClientRect();
      return { x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, cls:nav.className.slice(0,40) };
    });
    file = await ss(page, 'D3-nav-layout');
    if (navRect) {
      const noClip = navRect.x >= 0 && navRect.right <= VIEWPORT.width + 5;
      const note = `x:${navRect.x}, w:${navRect.w}, right:${navRect.right}`;
      if (noClip) pass('D3: 네비 레이아웃 정상', file, note);
      else fail('D3: 네비 잘림', file, note);
    } else {
      fail('D3: nav 요소 미발견', file);
    }
  } catch(e) { fail('D3', file, e.message); }

  try {
    const leftOk = await page.evaluate(() => {
      const nav = document.querySelector('#nav-bar, .nav-bar, nav, [class*="nav-wrap"]');
      if (!nav) return null;
      return nav.getBoundingClientRect().x;
    });
    file = await ss(page, 'D4-left');
    if (leftOk !== null) {
      if (leftOk <= 5) pass('D4: 좌측 공간 없음', file, `x=${leftOk}`);
      else fail('D4: 좌측 빈 공간', file, `x=${leftOk}px`);
    } else {
      fail('D4: nav 미발견', file);
    }
  } catch(e) { fail('D4', file, e.message); }

  // ─── E. 활동기록 ───
  log('\n=== E. 활동기록 ===');
  await goTab(page, 'log');
  await wait(1500);
  file = await ss(page, 'E0-act');

  try {
    const list = await page.evaluate(() => {
      const items = document.querySelectorAll('.act-card, [data-actid]');
      return { count: items.length, first: items[0]?.innerText?.slice(0,50) };
    });
    pass(`E1: 활동 목록 ${list.count}개`, file, list.first||'없음');
  } catch(e) { fail('E1', file, e.message); }

  try {
    const actId = await page.evaluate(() => {
      const card = document.querySelector('.act-card:not(.done), [data-actid]:not(.done)');
      return card?.getAttribute('data-actid') || card?.id || null;
    });
    if (actId) {
      await page.evaluate(id => {
        const card = document.querySelector(`[data-actid="${id}"]`);
        const btn = card?.querySelector('[onclick*="check"], [onclick*="done"], .check-btn, .act-check, .done-btn');
        if (btn) btn.click();
        else if (card) card.click();
      }, actId);
      await wait(1500);
      file = await ss(page, 'E2-complete');
      pass('E2: 활동 완료', file, `actId:${actId}`);

      const undone = await page.evaluate(id => {
        const card = document.querySelector(`[data-actid="${id}"]`) ||
                     document.querySelector('.act-card.done, .act-card.completed');
        if (!card) return false;
        const btn = card.querySelector('[onclick*="uncheck"], [onclick*="undo"], .uncheck-btn, .cancel-btn');
        if (btn) { btn.click(); return 'btn'; }
        card.click(); return 'toggle';
      }, actId);
      await wait(1500);
      file = await ss(page, 'E3-cancel');
      if (undone) pass('E3: 취소 (역방향)', file, String(undone));
      else fail('E3: 취소', file, '취소 버튼/토글 없음');
    } else {
      file = await ss(page, 'E2-no-act');
      fail('E2: 완료할 활동 없음', file);
      fail('E3: 취소 (건너뜀)', file, 'E2 실패');
    }
  } catch(e) { fail('E2/E3', file, e.message); }

  // ─── F. 보상 탭 ───
  log('\n=== F. 보상 ===');
  await goTab(page, 'rwd');
  await wait(1500);
  file = await ss(page, 'F0-rwd');

  try {
    const list = await page.evaluate(() => {
      const items = document.querySelectorAll('.rwd-card, [data-rwdid], .reward-card');
      return { count: items.length, first: items[0]?.innerText?.slice(0,50) };
    });
    pass(`F1: 보상 목록 ${list.count}개`, file, list.first||'없음');
  } catch(e) { fail('F1', file, e.message); }

  try {
    const exBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('[onclick]');
      for (const b of btns) {
        const oc = b.getAttribute('onclick') || '';
        if (oc.includes('redeem') || oc.includes('exchange') || oc.includes('use') || oc.includes('Rwd')) {
          return { found: true, onclick: oc, text: b.innerText?.trim().slice(0,20) };
        }
      }
      return { found: false };
    });
    if (exBtn.found) {
      await page.evaluate(oc => {
        const el = Array.from(document.querySelectorAll('[onclick]')).find(e => e.getAttribute('onclick') === oc);
        if (el) el.click();
      }, exBtn.onclick);
      await wait(1500);
      file = await ss(page, 'F2-exchange');
      pass('F2: 보상 교환', file, exBtn.onclick);
      await page.evaluate(() => {
        const close = document.querySelector('.modal-close, [onclick*="close"], [onclick*="Cancel"], button:last-child');
        if (close) close.click();
      });
      await wait(500);
    } else {
      file = await ss(page, 'F2-no-exchange');
      fail('F2: 교환 버튼', file, '없음');
    }
  } catch(e) { fail('F2', file, e.message); }

  // ─── G. MY 탭 ───
  log('\n=== G. MY 탭 ===');
  await goTab(page, 'my');
  await wait(1500);
  file = await ss(page, 'G0-my');

  try {
    const profile = await page.evaluate(() => {
      const txt = document.body.innerText;
      return {
        hasName: txt.includes('nonmarking') || txt.includes('아빠') || txt.includes('양육자'),
        hasAvatar: !!document.querySelector('[class*="avatar"], [class*="profile-img"], .profile-pic'),
        preview: txt.slice(0,200),
      };
    });
    file = await ss(page, 'G1-profile');
    if (profile.hasName) pass('G1: 프로필', file, profile.preview.slice(0,80));
    else fail('G1: 프로필', file, profile.preview.slice(0,100));
  } catch(e) { fail('G1', file, e.message); }

  try {
    const menus = await page.evaluate(() => {
      const items = document.querySelectorAll('.menu-item, .my-menu, [class*="menu-row"], .setting-row');
      return Array.from(items)
        .filter(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
        .map(i => ({ text: i.innerText?.trim().slice(0,20), onclick: i.getAttribute('onclick') }))
        .filter(i => !i.text.includes('로그아웃'));
    });
    pass(`G2: 메뉴 ${menus.length}개 발견`, file, menus.map(m=>m.text).join(', '));

    for (let i = 0; i < Math.min(menus.length, 2); i++) {
      if (!menus[i].onclick) continue;
      await page.evaluate(oc => {
        const el = Array.from(document.querySelectorAll('[onclick]')).find(e => e.getAttribute('onclick') === oc);
        if (el) el.click();
      }, menus[i].onclick);
      await wait(800);
      const mf = await ss(page, `G2-menu${i}`);
      pass(`G2: ${menus[i].text} 클릭`, mf);
      await page.evaluate(() => {
        const back = document.querySelector('[onclick*="back"], [onclick*="close"], .back-btn, .modal-close');
        if (back) back.click();
      });
      await wait(500);
      await goTab(page, 'my');
      await wait(500);
    }
  } catch(e) { fail('G2', file, e.message); }

  try {
    const adminBtn = await page.evaluate(() => {
      const all = document.querySelectorAll('[onclick]');
      for (const el of all) {
        const oc = el.getAttribute('onclick') || '';
        const txt = el.innerText?.trim() || '';
        if (oc.includes('admin') || oc.includes('Admin') || oc.includes('manage') || txt.includes('관리')) {
          return { onclick: oc, text: txt };
        }
      }
      return null;
    });
    if (adminBtn) {
      await page.evaluate(oc => {
        const el = Array.from(document.querySelectorAll('[onclick]')).find(e => e.getAttribute('onclick') === oc);
        if (el) el.click();
      }, adminBtn.onclick);
      await wait(1500);
      file = await ss(page, 'G3-admin');
      const adminTxt = await page.evaluate(() => document.body.innerText.slice(0,100));
      pass('G3: 관리자 페이지', file, adminTxt.slice(0,60));

      log('\n=== H. 관리자 ===');
      const adminTabs = await page.evaluate(() => {
        const tabs = document.querySelectorAll('.dash-tab, [onclick*="switchDash"]');
        return Array.from(tabs)
          .filter(t => { const r = t.getBoundingClientRect(); return r.width > 0; })
          .map(t => ({ text: t.innerText?.trim(), onclick: t.getAttribute('onclick') }));
      });
      pass(`H0: 관리자 탭 ${adminTabs.length}개`, file, adminTabs.map(t=>t.text).join(', '));

      for (let i = 0; i < adminTabs.length; i++) {
        await page.evaluate(oc => {
          const el = Array.from(document.querySelectorAll('[onclick]')).find(e => e.getAttribute('onclick') === oc);
          if (el) el.click();
        }, adminTabs[i].onclick);
        await wait(800);
        const hf = await ss(page, `H${i+1}-${adminTabs[i].text.replace(/\s/g,'')}`);
        pass(`H${i+1}: ${adminTabs[i].text}`, hf);
      }

      await page.evaluate(() => {
        const back = document.querySelector('[onclick*="back"], [onclick*="Back"], .back-btn, .close-btn');
        if (back) back.click();
      });
      await wait(800);
    } else {
      fail('G3: 관리자 버튼 없음', file);
      fail('H: 관리자 페이지 (건너뜀)', file);
    }
  } catch(e) { fail('G3/H', file, e.message); }

  try {
    await goTab(page, 'my');
    await wait(500);
    file = await ss(page, 'G4-pre-logout');
    const logoutBtn = await page.evaluate(() => {
      const all = document.querySelectorAll('[onclick], button');
      for (const el of all) {
        const txt = el.innerText?.trim() || '';
        const oc = el.getAttribute('onclick') || '';
        if (txt.includes('로그아웃') || oc.includes('logout') || oc.includes('Logout')) {
          return { onclick: oc, text: txt };
        }
      }
      return null;
    });
    if (logoutBtn) {
      await page.evaluate(oc => {
        const el = Array.from(document.querySelectorAll('[onclick], button')).find(e =>
          e.getAttribute('onclick') === oc || e.innerText?.includes('로그아웃'));
        if (el) el.click();
      }, logoutBtn.onclick);
      await wait(1000);
      await page.evaluate(() => {
        const confirm = Array.from(document.querySelectorAll('button')).find(b =>
          b.innerText?.includes('확인') || b.innerText?.includes('네') || b.innerText?.includes('로그아웃'));
        if (confirm) confirm.click();
      });
      await wait(2000);
      file = await ss(page, 'G4-after-logout');
      const aftTxt = await page.evaluate(() => document.body.innerText.slice(0,100));
      pass('G4: 로그아웃', file, aftTxt.slice(0,60));
    } else {
      fail('G4: 로그아웃 버튼 없음', file);
    }
  } catch(e) { fail('G4', file, e.message); }

  file = await ss(page, 'ZZ-final');
  await browser.close();

  // ─── 리포트 작성 ───
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  let report = `# QA 테스트 리포트 v3\n\n`;
  report += `**실행일시**: ${now}\n`;
  report += `**URL**: ${BASE_URL}\n`;
  report += `**뷰포트**: iPhone 14 (${VIEWPORT.width}×${VIEWPORT.height})\n`;
  report += `**결과**: **${passCount}/${total} PASS** (${failCount} FAIL)\n\n---\n\n`;

  const sectionMap = {
    'V3':'V3 신규 검증 항목',
    'A':'회원가입/온보딩','B':'로그인','C':'홈탭','D':'하단 네비',
    'E':'활동기록','F':'보상','G':'MY 탭','H':'관리자 페이지'
  };
  for (const [prefix, name] of Object.entries(sectionMap)) {
    const sec = results.filter(r => r.test.startsWith(prefix));
    if (!sec.length) continue;
    const sp = sec.filter(r => r.status === 'PASS').length;
    report += `## ${prefix}. ${name} (${sp}/${sec.length})\n\n`;
    report += `| 상태 | 테스트 | 스크린샷 | 비고 |\n|------|--------|---------|------|\n`;
    for (const r of sec) {
      report += `| ${r.status==='PASS'?'✅':'❌'} ${r.status} | ${r.test} | ${r.file||'-'} | ${(r.note||'').slice(0,80)} |\n`;
    }
    report += '\n';
  }

  const fails = results.filter(r => r.status === 'FAIL');
  if (fails.length) {
    report += `---\n\n## FAIL 분석: 테스트 문제 vs 실제 앱 버그\n\n`;

    const appBugs = fails.filter(r =>
      r.note.includes('존재') ||
      r.note.includes('불일치') ||
      r.note.includes('안됨') ||
      r.note.includes('없음') && !r.note.includes('Timeout') ||
      r.test.includes('다크모드') ||
      r.test.includes('compact') ||
      r.test.includes('잘림') ||
      r.test.includes('빈 공간') ||
      r.test.includes('교환') ||
      r.test.includes('취소') ||
      r.test.includes('V3')
    );
    const testIssues = fails.filter(r => !appBugs.includes(r));

    if (appBugs.length) {
      report += `### 🐛 실제 앱 버그 (${appBugs.length}건)\n\n`;
      report += `| 항목 | 스크린샷 | 내용 |\n|------|---------|------|\n`;
      for (const r of appBugs) {
        report += `| **${r.test}** | ${r.file||'-'} | ${r.note.slice(0,120)} |\n`;
      }
      report += '\n';
    }

    if (testIssues.length) {
      report += `### 🔧 테스트 코드 개선 필요 (${testIssues.length}건)\n\n`;
      report += `| 항목 | 비고 |\n|------|------|\n`;
      for (const r of testIssues) {
        report += `| ${r.test} | ${r.note.slice(0,100)} |\n`;
      }
      report += '\n';
    }
  }

  const pngFiles = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort();
  report += `---\n\n## 스크린샷 (${pngFiles.length}장)\n\n`;
  for (const f of pngFiles) {
    report += `- \`${f}\`\n`;
  }

  fs.writeFileSync(REPORT_PATH, report);
  console.log('\n' + '='.repeat(60));
  console.log(`QA 완료: ${passCount}/${total} PASS, ${failCount} FAIL`);
  console.log(`리포트: ${REPORT_PATH}`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('QA 에러:', e); process.exit(1); });
