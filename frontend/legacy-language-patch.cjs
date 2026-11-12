const fs = require("node:fs");
const path = require("node:path");

function patchLegacyModuleImports(source) {
  // Legacy route chunks import this bundle for its shared API helpers. Keep
  // those imports on the exact entry URL so they reuse the existing React
  // root instead of evaluating the whole application a second time.
  return source.replace(
    /(["'])\.\/index-BjXGGWCT\.js(?:\?[^"']*)?\1/g,
    '$1./index-BjXGGWCT.js?v=20261112-invite-i18n-v1$1',
  );
}

module.exports = function patchLegacyLanguageBundle(source) {
  source = patchLegacyModuleImports(source);
  // Keep the dashboard shell mounted while routes change. Keying this
  // Suspense boundary by the URL tears down and recreates its whole subtree
  // on every menu click, which makes the page flash during navigation.
  const routeKeyedBoundary = 'children:e.jsxs(s.Suspense,{key:window.location.pathname+window.location.search,fallback:e.jsx(Z,{}),children:[';
  const stableRouteBoundary = 'children:e.jsxs(s.Suspense,{fallback:e.jsx(Z,{}),children:[';
  source = source.replace(routeKeyedBoundary, stableRouteBoundary);
  source = source.replace(
    '../stock-deposits.js?v=20261101-expiry-stock-decision-v1',
    '../stock-deposits.js?v=20261101-distinct-stock-deposits-page-v2',
  );
  const currentManagerNavigation = './manager-navigation.js?v=20261104-remove-stock-deposits-menu-v10';
  source = source.replace(
    /(["'])\.\/manager-navigation\.js(?:\?[^"']*)?\1/g,
    (_match, quote) => `${quote}${currentManagerNavigation}${quote}`,
  );

  // Remove the retired old-bills page from legacy bundles that were built before this cleanup.
  source = source.replace('import OldBillsPage from "../OldBills/OldBillsPage.js";\n', "");
  source = source.replace('import OldBillsPage from "../OldBills/OldBillsPage.js";', "");
  source = source.replace(
    '"bills","old-bills","settings","stats","finance","promotions","close-shop","stock-deposits","audit","feedback"].includes(r)',
    '"bills","settings","stats","finance","promotions","close-shop","stock-deposits","audit","feedback"].includes(r)',
  );
  source = source.replace(
    'n==="stock-deposits"?e.jsx(StockDepositsPage,{restaurantId:r.restaurant.id}):n==="old-bills"?e.jsx(OldBillsPage,{restaurantId:r.restaurant.id}):n==="audit"?',
    'n==="stock-deposits"?e.jsx(StockDepositsPage,{restaurantId:r.restaurant.id}):n==="audit"?',
  );

  const oldInitializer = 'function Re(){return "th"}';
  const newInitializer = 'function Re(){try{const saved=window.localStorage.getItem(me);return["lo","en","ko","vi","zh"].includes(saved)?saved:"th"}catch{return"th"}}';
  const oldSetter = 'n=s.useCallback(c=>{r("th"),typeof window<"u"&&window.localStorage.setItem(me,"th")},[])';
  const newSetter = 'n=s.useCallback(c=>{const next=["lo","en","ko","vi","zh"].includes(c)?c:"th";r(next);try{window.localStorage.setItem(me,next)}catch{};try{if(window.parent!==window)window.parent.postMessage({type:"shopqr:locale-changed",locale:next},window.location.origin)}catch{}},[])';
  const oldEffectBoundary = '},[]),l=s.useCallback((c,i)=>';
  const newEffectBoundary = '},[]),b=s.useEffect(()=>{const listener=event=>{const code=event.data?.locale;if(event.origin===window.location.origin&&event.data?.type==="shopqr:set-locale"&&["th","lo","en","ko","vi","zh"].includes(code))n(code)};window.addEventListener("message",listener);return()=>window.removeEventListener("message",listener)},[n]),l=s.useCallback((c,i)=>';

  for (const [before, after] of [[oldInitializer, newInitializer], [oldSetter, newSetter], [oldEffectBoundary, newEffectBoundary]]) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error("Legacy language provider changed; locale compatibility patch did not apply");
    source = source.replace(before, after);
  }

  const oldLoginRedirect = 'if(!r.userId){window.location.replace("/login");return e.jsx(Z,{})}';
  const newLoginRedirect = 'if(!r.userId){const target="/login?next="+encodeURIComponent(window.location.pathname+window.location.search+window.location.hash);window.parent!==window?window.parent.location.replace(target):window.location.replace(target);return e.jsx(Z,{})}';
  if (!source.includes(newLoginRedirect)) {
    if (!source.includes(oldLoginRedirect)) throw new Error("Legacy login redirect was not found");
    source = source.replace(oldLoginRedirect, newLoginRedirect);
  }

  const authStateStart = source.indexOf("function Ge(){");
  const authStateEnd = source.indexOf("const I=", authStateStart);
  const resilientAuthState = 'function Ge(){const[t,a]=s.useState({...W,loading:!0});return s.useEffect(()=>{let r=!1,n=0,authRetryTimer=null;async function l(){const o=++n;a(v=>({...v,loading:!0}));try{const i=await _e();if(r||o!==n)return;if(!i){a(W);return}const d=i.membership,base={loading:!1,userId:i.user.id,email:i.user.email,restaurant:null,role:(d==null?void 0:d.role)??"owner"};if(!d){a(base);return}try{const m=await N(`/api/restaurants/${d.restaurant_id}`).then(h=>h.restaurant);r||o!==n||a({...base,restaurant:m})}catch{r||o!==n||a(v=>v.userId?{...v,loading:!1}:{...base,loading:!1})}}catch{if(!r&&o===n){a(v=>v.userId?{...v,loading:!1}:v);authRetryTimer=window.setTimeout(l,1500)}}}l();const d=Be(()=>{if(authRetryTimer!==null)window.clearTimeout(authRetryTimer);l()});return()=>{r=!0;n++;if(authRetryTimer!==null)window.clearTimeout(authRetryTimer);d()}},[]),t}';
  if (authStateStart < 0 || authStateEnd < 0) throw new Error("Legacy auth state guard was not found");
  if (!source.slice(authStateStart, authStateEnd).includes("authRetryTimer")) {
    source = source.slice(0, authStateStart) + resilientAuthState + source.slice(authStateEnd);
  }

  const oldApiRequest = 'async function N(t,a={}){const r=a.auth!==!1,n=await X(t,a,r);return n.status===401&&r&&await ve()?G(await X(t,a,!0)):G(n)}';
  const newApiRequest = 'async function N(t,a={}){const r=a.auth!==!1,l=A,n=await X(t,a,r);return n.status===401&&r&&await ve(l)?G(await X(t,a,!0)):G(n)}';
  const refreshStart = source.indexOf("async function ve(");
  const refreshEnd = source.indexOf("function J(t)", refreshStart);
  const safeCrossTabRefresh = 'async function ve(previous=A){return O||(O=(async()=>{let refreshStarted=false;const run=async()=>{refreshStarted=true;const latest=typeof localStorage<"u"?localStorage.getItem(F):null;if(latest&&latest!==previous){A=latest;ke();return true}const t=authGeneration;const a=await X("/api/auth/refresh",{method:"POST",auth:!1},!1);if(t!==authGeneration)return !!A;return a.status===401?(A=null,typeof localStorage<"u"&&localStorage.removeItem(F),null):J(await G(a))};try{if(typeof navigator!=="undefined"&&navigator.locks&&navigator.locks.request){try{return await navigator.locks.request("shopqr-auth-refresh",run)}catch(error){if(refreshStarted)throw error;return await run()}}return await run()}finally{O=null}})(),O)}';
  if (refreshStart < 0 || refreshEnd < 0) throw new Error("Legacy refresh function was not found");
  if (!source.slice(refreshStart, refreshEnd).includes("let refreshStarted=false")) {
    source = source.slice(0, refreshStart) + safeCrossTabRefresh + source.slice(refreshEnd);
  }
  for (const [before, after] of [[oldApiRequest, newApiRequest]]) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error("Legacy auth refresh changed; cross-tab session lock patch did not apply");
    source = source.replace(before, after);
  }

  // Use the same up-to-date dictionaries in both the legacy and source screens.
  const locales = {};
  for (const locale of ["th", "lo", "en", "ko", "vi", "zh"]) {
    locales[locale] = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", `${locale}.json`), "utf8"));
  }
  const dictionaryStart = source.indexOf("const K=");
  const dictionaryEnd = source.indexOf(",de=", dictionaryStart);
  if (dictionaryStart < 0 || dictionaryEnd < 0) throw new Error("Legacy translation dictionary was not found");
  source = `${source.slice(0, dictionaryStart)}const K=${JSON.stringify(locales)}${source.slice(dictionaryEnd)}`;

  // The legacy invitation form still renders several Thai literals and role
  // names directly. Translate in React so dynamic sentences and API failures
  // use the selected locale rather than relying on DOM text matching.
  const inviteStart = source.indexOf('function st({token:t})');
  const inviteEnd = source.indexOf('function nt()', inviteStart);
  if (inviteStart < 0 || inviteEnd < 0) throw new Error('Legacy invitation form was not found');
  let invite = source.slice(inviteStart, inviteEnd);
  const inviteReplacements = [
    ['y("ลิงก์เชิญนี้ไม่ถูกต้อง หรือไม่มีอยู่แล้ว")', 'y("INVITE_NOT_FOUND")'],
    ['y("ลิงก์เชิญนี้ถูกยกเลิกแล้ว กรุณาขอลิงก์ใหม่จากเจ้าของร้าน")', 'y("INVITE_REVOKED")'],
    ['y("ลิงก์เชิญนี้ถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่จากเจ้าของร้าน")', 'y("INVITE_ALREADY_USED")'],
    ['y("บัญชีนี้เป็นสมาชิกของร้านนี้อยู่แล้ว กรุณาออกจากระบบก่อน แล้วเปิดลิงก์นี้เพื่อสมัครบัญชีพ่อครัว/พนักงานใหม่")', 'y("ALREADY_A_MEMBER")'],
    ['y(j instanceof q?j.code:"ไม่สามารถเข้าร่วมร้านได้")', 'y(j instanceof q?j.code:"JOIN_FAILED")'],
    ['y(a("set.pw.error.short"))', 'y("PASSWORD_TOO_SHORT")'],
    ['y(Q instanceof q?Q.code:a("auth.signup.failed"))', 'y(Q instanceof q?Q.code:"SIGNUP_FAILED")'],
    ['children:"เชิญพนักงาน"', 'children:a("invite.staff_title")'],
    ['children:r?`เข้าร่วมร้าน ${r.restaurant_name}`:"เข้าร่วมทีมร้านอาหาร"', 'children:r?a("join.title",{restaurant:r.restaurant_name}):a("invite.team_title")'],
    ['children:r?`ตำแหน่งของคุณคือ ${B(r.role)} เมื่อสมัครแล้วจะเข้าเฉพาะหน้าที่ของตำแหน่งนี้`:"กำลังตรวจสอบลิงก์เชิญ"', 'children:r?a("invite.role_description",{role:a("role."+r.role)}):a("invite.checking")'],
    ['children:"กำลังตรวจสอบลิงก์เชิญ..."', 'children:a("invite.checking_ellipsis")'],
    ['children:k}', 'children:a(({INVITE_NOT_FOUND:"invite.invalid",INVALID_INVITE:"invite.invalid",INVITE_REVOKED:"invite.cancelled",INVITE_ALREADY_USED:"invite.used",ALREADY_A_MEMBER:"invite.already_member",ACCOUNT_EXISTS:"invite.account_exists",PASSWORD_TOO_SHORT:"invite.password_short",SIGNUP_FAILED:"auth.signup.failed",JOIN_FAILED:"invite.join_failed"})[k]||"invite.join_failed")}'],
    ['children:["ตอนนี้คุณล็อกอินเป็นสมาชิกของร้านนี้อยู่แล้ว กรุณาออกจากระบบก่อน แล้วสมัครบัญชีใหม่จากลิงก์นี้สำหรับตำแหน่ง"," ",B(r.role)]', 'children:a("invite.member_role",{role:a("role."+r.role)})'],
    ['children:"ออกจากระบบเพื่อสมัครทีมงาน"', 'children:a("invite.logout_to_join")'],
    ['children:_?"กำลังเข้าร่วม...":`เข้าร่วมเป็น${B(r.role)}`', 'children:_?a("invite.joining"):a("invite.join_as",{role:a("role."+r.role)})'],
    ['children:"กลับแดชบอร์ด"', 'children:a("common.back_dashboard")'],
    ['children:_?"กำลังสมัคร...":`สมัครและเข้าร่วมเป็น${B(r.role)}`', 'children:_?a("auth.signup.submitting"):a("invite.signup_as",{role:a("role."+r.role)})'],
    ['children:["มีบัญชีอยู่แล้ว? เปิดลิงก์นี้หลังจากล็อกอิน หรือ"," ",', 'children:[a("invite.have_account")," ",'],
    ['children:"เข้าสู่ระบบ"', 'children:a("auth.login.submit")'],
  ];
  for (const [before, after] of inviteReplacements) {
    if (invite.includes(after)) continue;
    if (!invite.includes(before)) throw new Error(`Legacy invitation translation anchor missing: ${before.slice(0, 60)}`);
    invite = invite.replace(before, after);
  }
  source = source.slice(0, inviteStart) + invite + source.slice(inviteEnd);
  return source;
};

module.exports.patchLegacyModuleImports = patchLegacyModuleImports;
