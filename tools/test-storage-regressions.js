/* Storage 실패 표시와 로그아웃 세션 제거 회귀 검사 — 외부 패키지 없이 실행한다. */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failSet = new Set();
    this.failRemove = new Set();
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) {
    key = String(key);
    if (this.failSet.has(key)) throw new Error('setItem blocked');
    this.values.set(key, String(value));
  }
  removeItem(key) {
    key = String(key);
    if (this.failRemove.has(key)) throw new Error('removeItem blocked');
    this.values.delete(key);
  }
}

function element(tag = 'div') {
  const classes = new Set();
  const attributes = new Map();
  return {
    tagName: tag.toUpperCase(), id: '', innerHTML: '', textContent: '', title: '',
    dataset: {}, style: {}, disabled: false,
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
    },
    setAttribute: (name, value) => attributes.set(String(name), String(value)),
    getAttribute: name => attributes.get(String(name)) ?? null,
  };
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const elements = new Map();
const document = {
  getElementById: id => elements.get(id) || null,
  createElement: tag => element(tag),
  addEventListener() {},
  querySelectorAll: () => [],
  body: {
    appendChild(el) { if (el.id) elements.set(el.id, el); },
  },
};
const location = { hostname: 'example.test', search: '', href: '', reload() {} };
let fetchCalls = 0;
const context = {
  console, localStorage, sessionStorage, document, location, TextEncoder,
  window: { addEventListener() {}, scrollTo() {} },
  fetch: async () => {
    fetchCalls++;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  },
  setTimeout, clearTimeout, Date, Map, Set, JSON, Math, URLSearchParams, encodeURIComponent,
  confirm: () => true, alert() {}, MutationObserver: class { observe() {} },
};
context.globalThis = context;
vm.createContext(context);

const mainPath = path.resolve(__dirname, '..', 'js', 'main.js');
const mypageSource = fs.readFileSync(path.resolve(__dirname, '..', 'mypage.html'), 'utf8');
const source = fs.readFileSync(mainPath, 'utf8')
  + '\nglobalThis.__tested={Storage,DataSync,Auth,showToast,initTempSave,maskIdNumbers,hasIdNumber};';
vm.runInContext(source, context, { filename: mainPath });
const { Storage, DataSync, Auth, showToast, initTempSave, maskIdNumbers, hasIdNumber } = context.__tested;

async function run() {
  const diagnosisKey = Storage.GUEST_PREFIX + 'diagnosis_data';
  sessionStorage.failSet.add(diagnosisKey);
  assert.strictEqual(Storage.save('diagnosis_data', { debt: 1 }), false);
  assert.strictEqual(Storage.hasSaveFailure('diagnosis_data'), true);

  const temporarySession = {
    token: 'temporary', email: 'scope@example.com', name: 'Scope',
    expiresAt: Date.now() + 60_000,
  };
  localStorage.setItem(Auth._KS, JSON.stringify(temporarySession));
  assert.strictEqual(Storage.hasSaveFailure('diagnosis_data'), false, '저장 실패 표시도 계정별이어야 한다');
  localStorage.removeItem(Auth._KS);

  showToast('진단을 완료했습니다. 결과 페이지로 이동합니다.', 'success');
  const toast = elements.get('toast');
  assert.match(toast.textContent, /저장하지 못했습니다/);
  assert.match(toast.className, /bg-red-600/);

  initTempSave(() => ({ done: 1, total: 1 }));
  const saveButton = elements.get('temp-save-btn');
  saveButton.onclick();
  assert.match(saveButton.innerHTML, /저장 안 됨/);
  assert.doesNotMatch(saveButton.innerHTML, /저장됨/);

  sessionStorage.failSet.delete(diagnosisKey);
  assert.strictEqual(Storage.save('diagnosis_data', { debt: 1 }), true);
  assert.strictEqual(Storage.hasSaveFailure('diagnosis_data'), false);
  assert.strictEqual(localStorage.getItem(diagnosisKey), null, '익명 자료는 탭 밖 localStorage에 남기면 안 된다');
  assert.ok(sessionStorage.getItem(diagnosisKey), '익명 자료는 현재 탭 sessionStorage에만 있어야 한다');

  // 옛 namespace 충돌을 만든 두 이메일도 새 UTF-8 hex namespace에서는 반드시 달라야 한다.
  assert.strictEqual(Storage._legacyScopeToken('a_b@example.com'), Storage._legacyScopeToken('a~5fb@example.com'));
  assert.notStrictEqual(Storage._scopeToken('a_b@example.com'), Storage._scopeToken('a~5fb@example.com'));
  assert.strictEqual(Storage._legacyScopeToken('a%b@example.com'), Storage._legacyScopeToken('a~25b@example.com'));
  assert.notStrictEqual(Storage._scopeToken('a%b@example.com'), Storage._scopeToken('a~25b@example.com'));

  // owner marker 없는 옛 계정 namespace는 충돌 가능성이 있으므로 자동 이관·삭제하지 않는다.
  const ambiguousEmail = 'a%b@example.com';
  const ambiguousOldKey = Storage._legacyUserPrefix(ambiguousEmail) + 'profile';
  localStorage.setItem(ambiguousOldKey, JSON.stringify({ owner: 'unknown legacy' }));
  assert.strictEqual(Storage._migrateAccountNamespace(ambiguousEmail), true);
  assert.strictEqual(Storage._readAt(Storage._userPrefix(ambiguousEmail), 'profile'), null);
  assert.ok(localStorage.getItem(ambiguousOldKey));
  assert.strictEqual(Storage.clearUser(ambiguousEmail), false, '소유 불명 legacy가 남으면 삭제 완료라고 하면 안 된다');
  localStorage.removeItem(ambiguousOldKey);

  // owner가 확인돼도 대상 쓰기 실패 시 원본을 보존하고 이관 실패를 알려야 한다.
  const ownedLegacyEmail = 'owned@example.com';
  const ownedOldToken = Storage._legacyScopeToken(ownedLegacyEmail);
  const ownedOldKey = Storage._legacyUserPrefix(ownedLegacyEmail) + 'profile';
  const ownedNewKey = Storage._userPrefix(ownedLegacyEmail) + 'profile';
  localStorage.setItem('cdg_scope_owner_' + ownedOldToken, ownedLegacyEmail);
  localStorage.setItem(ownedOldKey, JSON.stringify({ owner: 'verified legacy' }));
  localStorage.failSet.add(ownedNewKey);
  assert.strictEqual(Storage._migrateAccountNamespace(ownedLegacyEmail), false);
  assert.ok(localStorage.getItem(ownedOldKey));
  localStorage.failSet.delete(ownedNewKey);
  localStorage.removeItem(ownedOldKey);
  localStorage.removeItem('cdg_scope_owner_' + ownedOldToken);

  // 소유자를 알 수 없는 구버전 자료는 읽기만으로 삭제/귀속하지 않고, 명시적 복구 때만 현재 탭으로 옮긴다.
  Storage._clearAt(Storage.GUEST_PREFIX);

  assert.match(mypageSource, /Storage\.clearAllAppData\(\)/, '전체 초기화는 모든 계정·guest 로컬 사본을 지워야 한다');
  localStorage.setItem('cdg_profile', JSON.stringify({ owner: 'legacy guest' }));
  Storage._prefix();
  assert.ok(localStorage.getItem('cdg_profile'));
  assert.strictEqual(Storage.hasUnownedLegacy(), true);
  assert.strictEqual(Storage.importUnownedLegacyToGuest(), true);
  assert.strictEqual(localStorage.getItem('cdg_profile'), null);
  assert.strictEqual(Storage.collectGuest().profile.owner, 'legacy guest');
  Storage._clearAt(Storage.GUEST_PREFIX);

  const session = {
    token: 'token', email: 'alice@example.com', name: 'Alice',
    expiresAt: Date.now() + 60_000,
  };
  localStorage.setItem(Auth._KS, JSON.stringify(session));
  Storage.save('profile', { owner: 'Alice' });
  if (DataSync._timer) { clearTimeout(DataSync._timer); DataSync._timer = null; }
  DataSync.cancelPending(session.email);

  // 로컬 기록이 실패하면 서버 큐도 만들지 않는다.
  const failedUserKey = Storage._userPrefix(session.email) + 'server_only';
  localStorage.failSet.add(failedUserKey);
  assert.strictEqual(Storage.save('server_only', { changed: true }), false);
  assert.strictEqual(DataSync._put.has('server_only'), false);
  localStorage.failSet.delete(failedUserKey);

  // 로컬 본문 쓰기가 성공해도 영속 재시도 journal을 못 쓰면 저장 전체를 실패·원복한다.
  DataSync.cancelPending(session.email);
  const aliceJournalKey = DataSync._pendingKey(session.email);
  localStorage.failSet.add(aliceJournalKey);
  assert.strictEqual(Storage.save('journal_only', { changed: true }), false);
  assert.strictEqual(Storage.load('journal_only'), null);
  assert.strictEqual(DataSync._put.has('journal_only'), false);
  localStorage.failSet.delete(aliceJournalKey);

  // 여러 진단 키 중 하나가 실패하면 앞서 쓴 값도 원복하고 어느 값도 동기화하지 않는다.
  assert.strictEqual(Storage.saveBatch([['batch_a', { value: 'old-a' }], ['batch_b', { value: 'old-b' }]]), true);
  DataSync.cancelPending(session.email);
  const batchBKey = Storage._userPrefix(session.email) + 'batch_b';
  localStorage.failSet.add(batchBKey);
  assert.strictEqual(Storage.saveBatch([['batch_a', { value: 'new-a' }], ['batch_b', { value: 'new-b' }]]), false);
  assert.strictEqual(Storage.load('batch_a').value, 'old-a');
  assert.strictEqual(Storage.load('batch_b').value, 'old-b');
  assert.strictEqual(DataSync._put.size, 0);
  localStorage.failSet.delete(batchBKey);

  // 계정 cache 전체 교체가 중간에 실패하면 이전 snapshot을 모두 복원한다.
  const replaceFailKey = Storage._userPrefix(session.email) + 'replace_b';
  const beforeReplace = Storage.collectCurrent();
  localStorage.failSet.add(replaceFailKey);
  assert.strictEqual(Storage.replaceCurrent({ replace_a: { value: 1 }, replace_b: { value: 2 } }), false);
  assert.deepStrictEqual(Storage.collectCurrent(), beforeReplace);
  localStorage.failSet.delete(replaceFailKey);

  // 새 세션 저장이 실패하면 로그인 성공으로 취급하지 않고 이전 세션·계정 캐시를 보존한다.
  localStorage.failSet.add(Auth._KS);
  const unsaved = Auth._saveSession('new-token', {
    email: 'bob@example.com', name: 'Bob', expiresAt: Date.now() + 60_000,
  });
  assert.strictEqual(unsaved, null);
  assert.strictEqual(JSON.parse(localStorage.getItem(Auth._KS)).email, session.email);
  assert.strictEqual(Storage.load('profile').owner, 'Alice');
  localStorage.failSet.delete(Auth._KS);

  // 직접 다른 계정으로 전환해도 이전 계정 cache와 미전송 큐를 지우지 않는다.
  Storage.save('profile', { owner: 'Alice latest' });
  if (DataSync._timer) { clearTimeout(DataSync._timer); DataSync._timer = null; }
  const alicePendingKey = DataSync._pendingKey(session.email);
  assert.ok(localStorage.getItem(alicePendingKey));
  const switched = Auth._saveSession('bob-token', {
    email: 'bob@example.com', name: 'Bob', expiresAt: Date.now() + 60_000,
    sensitiveConsent: true,
  });
  assert.ok(switched);
  assert.strictEqual(switched.sensitiveConsent, true);
  assert.strictEqual(JSON.parse(localStorage.getItem(Auth._KS)).sensitiveConsent, true);
  assert.strictEqual(Storage._readAt(Storage._userPrefix(session.email), 'profile').owner, 'Alice latest');
  assert.ok(localStorage.getItem(alicePendingKey));

  // 세션 만료는 인증만 종료하며 cache와 영속 재시도 파일을 보존한다.
  Storage.save('profile', { owner: 'Bob' });
  if (DataSync._timer) { clearTimeout(DataSync._timer); DataSync._timer = null; }
  const bobPendingKey = DataSync._pendingKey('bob@example.com');
  assert.ok(localStorage.getItem(bobPendingKey));
  localStorage.setItem(Auth._KS, JSON.stringify({ ...switched, expiresAt: Date.now() - 1 }));
  assert.strictEqual(Auth.getSession(), null);
  assert.strictEqual(Storage._readAt(Storage._userPrefix('bob@example.com'), 'profile').owner, 'Bob');
  assert.ok(localStorage.getItem(bobPendingKey));

  // drain은 첫 요청 중 생긴 새 변경까지 두 번째 요청으로 보낸 뒤에만 완료한다.
  const bobSession = { ...switched, expiresAt: Date.now() + 60_000 };
  localStorage.setItem(Auth._KS, JSON.stringify(bobSession));
  DataSync.cancelPending(bobSession.email);
  const sentBodies = [];
  let releaseFirst;
  context.fetch = async (url, options = {}) => {
    sentBodies.push(JSON.parse(options.body || '{}'));
    if (sentBodies.length === 1) {
      await new Promise(resolve => { releaseFirst = resolve; });
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  Storage.save('profile', { owner: 'Bob v2' });
  if (DataSync._timer) { clearTimeout(DataSync._timer); DataSync._timer = null; }
  const draining = DataSync.drain();
  while (!releaseFirst) await new Promise(resolve => setTimeout(resolve, 0));
  Storage.save('rehab_check', { changedDuringFlush: true });
  releaseFirst();
  assert.strictEqual((await draining).ok, true);
  assert.strictEqual(sentBodies.length, 2);
  assert.strictEqual(sentBodies[1].put.rehab_check.changedDuringFlush, true);

  // A 계정의 오래된 비동기 실패가 전환 후 B 계정의 메모리 큐를 A journal로 쓰면 안 된다.
  DataSync.cancelPending(bobSession.email);
  let rejectOldFlush;
  context.fetch = async () => new Promise((resolve, reject) => { rejectOldFlush = reject; });
  assert.strictEqual(Storage.save('profile', { owner: 'Bob pending' }), true);
  if (DataSync._timer) { clearTimeout(DataSync._timer); DataSync._timer = null; }
  const oldFlush = DataSync.flush();
  while (!rejectOldFlush) await new Promise(resolve => setTimeout(resolve, 0));
  const charlie = Auth._saveSession('charlie-token', {
    email: 'charlie@example.com', name: 'Charlie', expiresAt: Date.now() + 60_000,
  });
  assert.ok(charlie);
  assert.strictEqual(Storage.save('profile', { owner: 'Charlie pending' }), true);
  if (DataSync._timer) { clearTimeout(DataSync._timer); DataSync._timer = null; }
  rejectOldFlush(new Error('old account offline'));
  const staleResult = await oldFlush;
  assert.strictEqual(staleResult.stale, true);
  const bobJournal = JSON.parse(localStorage.getItem(DataSync._pendingKey(bobSession.email)));
  const charlieJournal = JSON.parse(localStorage.getItem(DataSync._pendingKey(charlie.email)));
  assert.strictEqual(bobJournal.put.profile.owner, 'Bob pending');
  assert.strictEqual(charlieJournal.put.profile.owner, 'Charlie pending');

  context.fetch = async () => {
    fetchCalls++;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  // 재시도 파일 삭제 실패를 무시하고 로그아웃 성공을 표시하면 안 된다.
  const charliePendingKey = DataSync._pendingKey(charlie.email);
  localStorage.failRemove.add(charliePendingKey);
  const journalBlockedLogout = await Auth.logout(true);
  assert.strictEqual(journalBlockedLogout.ok, false);
  assert.ok(localStorage.getItem(Auth._KS));
  assert.ok(localStorage.getItem(charliePendingKey));
  localStorage.failRemove.delete(charliePendingKey);

  const beforeFailedLogoutFetches = fetchCalls;
  localStorage.failRemove.add(Auth._KS);
  const failedLogout = await Auth.logout(true);
  assert.strictEqual(failedLogout.ok, false);
  assert.strictEqual(failedLogout.canForce, false);
  assert.ok(localStorage.getItem(Auth._KS));
  assert.strictEqual(fetchCalls, beforeFailedLogoutFetches, '세션이 남아 있으면 서버 로그아웃 성공 흐름도 시작하면 안 된다');

  localStorage.failRemove.delete(Auth._KS);
  const completedLogout = await Auth.logout(true);
  assert.strictEqual(completedLogout.ok, true);
  assert.strictEqual(localStorage.getItem(Auth._KS), null);

  // 명시적 로그아웃은 세션이 방금 만료됐어도 raw 계정 identity로 cache·journal·guest를 지운다.
  const expiredSession = {
    token: 'expired-token', email: 'expired@example.com', name: 'Expired',
    expiresAt: Date.now() - 1,
  };
  localStorage.setItem(Auth._KS, JSON.stringify(expiredSession));
  Storage._writeAt(Storage._userPrefix(expiredSession.email), 'profile', { owner: 'Expired' });
  Storage._writeAt(Storage.GUEST_PREFIX, 'diagnosis_data', { debt: 123 });
  localStorage.setItem(DataSync._pendingKey(expiredSession.email), JSON.stringify({ put: { profile: { owner: 'Expired' } }, del: [] }));
  localStorage.setItem(DataSync._loginSyncKey(expiredSession.email), '1');
  const fingerprintBeforeExpiredLogout = Storage.scopeFingerprint();
  const expiredLogout = await Auth.logout(true);
  assert.strictEqual(expiredLogout.ok, true);
  assert.strictEqual(Storage._readAt(Storage._userPrefix(expiredSession.email), 'profile'), null);
  assert.strictEqual(Storage._readAt(Storage.GUEST_PREFIX, 'diagnosis_data'), null);
  assert.strictEqual(localStorage.getItem(DataSync._pendingKey(expiredSession.email)), null);
  assert.notStrictEqual(Storage.scopeFingerprint(), fingerprintBeforeExpiredLogout);

  // 회원탈퇴는 현재 계정만 지우고 같은 브라우저의 다른 계정 namespace는 보존한다.
  const deleteSession = { token: 'delete-token', email: 'delete@example.com', name: 'Delete', expiresAt: Date.now() + 60_000 };
  localStorage.setItem(Auth._KS, JSON.stringify(deleteSession));
  Storage._writeAt(Storage._userPrefix(deleteSession.email), 'profile', { owner: 'Delete' });
  Storage._writeAt(Storage._userPrefix('other@example.com'), 'profile', { owner: 'Other' });
  const originalApi = Auth._api;
  Auth._api = async () => ({ ok: true });
  const deleted = await Auth.deleteAccount('password');
  Auth._api = originalApi;
  assert.strictEqual(deleted.ok, true);
  assert.strictEqual(Storage._readAt(Storage._userPrefix(deleteSession.email), 'profile'), null);
  assert.strictEqual(Storage._readAt(Storage._userPrefix('other@example.com'), 'profile').owner, 'Other');

  // guest 가져오기에서 같은 키가 충돌하면 명시적으로 선택하고, 서버 반영 전에는 원본을 지우지 않는다.
  const conflictSession = {
    token: 'conflict-token', email: 'conflict@example.com', name: 'Conflict',
    expiresAt: Date.now() + 60_000,
  };
  localStorage.setItem(Auth._KS, JSON.stringify(conflictSession));
  Storage._writeAt(Storage.GUEST_PREFIX, 'diagnosis_data', { owner: 'guest-new' });
  DataSync.cancelPending(conflictSession.email);
  const confirmationAnswers = [true, true]; // 가져오기, 충돌 시 guest 우선
  context.confirm = () => confirmationAnswers.shift();
  const conflictUploads = [];
  context.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/api/data')) {
      return { ok: true, status: 200, json: async () => ({ ok: true, data: { diagnosis_data: { owner: 'server-old' } } }) };
    }
    conflictUploads.push(JSON.parse(options.body || '{}'));
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const conflictSync = await DataSync.syncOnLogin({ promptGuest: true });
  assert.strictEqual(conflictSync.ok, true);
  assert.strictEqual(Storage._readAt(Storage._userPrefix(conflictSession.email), 'diagnosis_data').owner, 'guest-new');
  assert.strictEqual(Storage._readAt(Storage.GUEST_PREFIX, 'diagnosis_data'), null);
  assert.strictEqual(conflictUploads.at(-1).put.diagnosis_data.owner, 'guest-new');
  context.confirm = () => true;

  // 주민번호 공백·점·줄바꿈 우회는 가리되, 평범한 금액 계산은 훼손하지 않는다.
  assert.strictEqual(maskIdNumbers('900101 1234568'), '○○○○○○-○○○○○○○');
  assert.strictEqual(maskIdNumbers('900101.1234568'), '○○○○○○-○○○○○○○');
  assert.strictEqual(maskIdNumbers('900101 5234561'), '○○○○○○-○○○○○○○');
  assert.strictEqual(maskIdNumbers('900101 1234567'), '○○○○○○-○○○○○○○');
  assert.match(maskIdNumbers('주민등록번호: 900101\n1234567'), /○○○○○○-○○○○○○○/);
  assert.strictEqual(maskIdNumbers('잔액 500000 1200000원'), '잔액 500000 1200000원');
  assert.strictEqual(hasIdNumber('외국인 등록 번호 900101\n5234567'), true);

  if (toast && toast._timer) clearTimeout(toast._timer);
  if (DataSync._timer) clearTimeout(DataSync._timer);
  console.log('storage regression tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
