import{j as e}from"./jsx-runtime-C8_8iAox.js";import{r}from"./index-Dkaqzkgy.js";import{a as ie,s as le,A as W}from"./client-CTyvSzmk.js";import{u as R,L as ce}from"./index-jP6be0Hw.js";import{d as ue}from"./qr-dining-banner-DOXFmVqY.js";import"./client-BPAFkSeE.js";import"./preload-helper-ckwbz45p.js";function de({title:a,subtitle:n,children:s}){const{t}=R();return e.jsxs("main",{className:"relative isolate flex h-dvh items-center justify-center overflow-hidden bg-[#10291f] px-3 py-3 text-[#173b2d] sm:px-8 sm:py-4",children:[e.jsx("img",{src:ue,alt:"",className:"fixed inset-0 -z-20 h-full w-full object-cover object-center"}),e.jsx("div",{className:"fixed inset-0 -z-10 bg-gradient-to-r from-[#092116]/85 via-[#123825]/65 to-[#f5ecdc]/75"}),e.jsxs("section",{className:"max-h-full w-full max-w-lg overflow-x-hidden overflow-y-auto overscroll-contain rounded-[28px] border border-white/75 bg-[#fffdf8]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-8",children:[e.jsxs("div",{className:"sticky top-0 z-20 -mx-6 -mt-6 mb-5 flex items-center justify-between border-b border-[#e8e1d5] bg-[#fffdf8]/95 px-6 py-3 backdrop-blur-xl sm:-mx-8 sm:-mt-8 sm:px-8",children:[e.jsxs("a",{href:"/",className:"inline-flex items-center gap-2 text-sm font-extrabold text-[#14543b]",children:[e.jsx("span",{className:"text-lg text-[#c88b29]",children:"★"})," Starsmenu"]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(ce,{inline:!0}),e.jsx("a",{href:"/","aria-label":t("auth.close_back_home"),title:t("auth.close_back_home"),className:"grid h-9 w-9 place-items-center rounded-xl border border-[#e5d8c4] bg-white text-xl font-bold leading-none text-[#8c342b] shadow-sm transition hover:bg-[#fff2ef]",children:"×"})]})]}),e.jsxs("div",{className:"mb-6 mt-5 text-center",children:[e.jsx("span",{className:"mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[#eaf2ec] text-2xl font-black text-[#14543b] shadow-inner",children:"★"}),e.jsx("h1",{className:"mt-3 text-2xl font-black tracking-tight text-[#14543b]",children:a}),e.jsx("p",{className:"mt-1 text-sm font-medium text-[#6e786f]",children:n})]}),s]})]})}const j=256,he={lat:17.9757,lon:102.6331};function pe({value:a,onChange:n}){const{t:s}=R(),[t,h]=r.useState(he),[u,v]=r.useState(12),[y,S]=r.useState({x:0,y:0}),f=r.useRef(null),[x,C]=r.useState(""),p=J(t,u),N=2**u,T=Math.floor(p.x/j),i=Math.floor(p.y/j),d=p.x%j,M=p.y%j,b=a?J(a,u):null;function K(l){l.currentTarget.setPointerCapture(l.pointerId),f.current={startX:l.clientX,startY:l.clientY,x:0,y:0,moved:!1}}function A(l){const c=f.current;c&&(c.x=l.clientX-c.startX,c.y=l.clientY-c.startY,Math.abs(c.x)+Math.abs(c.y)>5&&(c.moved=!0),S({x:c.x,y:c.y}))}function _(l){const c=f.current;if(c){if(c.moved)h(X({x:p.x-c.x,y:p.y-c.y},u));else{const w=l.currentTarget.getBoundingClientRect();n(X({x:p.x+l.clientX-w.left-w.width/2,y:p.y+l.clientY-w.top-w.height/2},u))}f.current=null,S({x:0,y:0})}}function B(){if(C(""),!navigator.geolocation){C(s("map.geo_unsupported"));return}navigator.geolocation.getCurrentPosition(({coords:l})=>{const c={lat:l.latitude,lon:l.longitude};h(c),v(16),n(c)},()=>C(s("map.geo_denied")))}return e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsx("span",{className:"text-xs font-medium text-[#6e786f]",children:s("map.instructions")}),e.jsx("button",{type:"button",onClick:B,className:"text-xs font-bold text-[#14543b] hover:underline",children:s("map.use_current")})]}),e.jsxs("div",{className:"relative h-72 touch-none select-none overflow-hidden rounded-xl border border-[#d5c4aa] bg-[#e8eee8] sm:h-80",onPointerDown:K,onPointerMove:A,onPointerUp:_,onPointerCancel:_,children:[Array.from({length:25},(l,c)=>{const w=c%5-2,L=Math.floor(c/5)-2,G=T+w,D=(G%N+N)%N,P=i+L;return P<0||P>=N?null:e.jsx("img",{draggable:!1,alt:"",src:`https://tile.openstreetmap.org/${u}/${D}/${P}.png`,className:"pointer-events-none absolute max-w-none",style:{width:j,height:j,left:`calc(50% + ${w*j-d+y.x}px)`,top:`calc(50% + ${L*j-M+y.y}px)`}},`${u}-${G}-${P}`)}),b&&e.jsx("div",{"aria-label":s("map.pin_aria"),className:"pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full text-3xl drop-shadow",style:{left:`calc(50% + ${b.x-p.x+y.x}px)`,top:`calc(50% + ${b.y-p.y+y.y}px)`},children:"📍"}),e.jsxs("div",{className:"absolute right-2 top-2 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow",children:[e.jsx("button",{type:"button","aria-label":s("map.zoom_in"),onPointerDown:l=>l.stopPropagation(),onClick:()=>v(l=>Math.min(18,l+1)),className:"h-9 w-9 text-xl font-bold text-slate-700 hover:bg-slate-100",children:"+"}),e.jsx("button",{type:"button","aria-label":s("map.zoom_out"),onPointerDown:l=>l.stopPropagation(),onClick:()=>v(l=>Math.max(3,l-1)),className:"h-9 w-9 border-t text-xl font-bold text-slate-700 hover:bg-slate-100",children:"−"})]}),e.jsx("span",{className:"pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-slate-700",children:"© OpenStreetMap contributors"})]}),x&&e.jsx("p",{role:"status",className:"text-xs text-rose-700",children:x}),a?e.jsxs("p",{className:"text-xs font-medium text-[#315842]",children:[s("map.selected_coordinates",{lat:a.lat.toFixed(6),lon:a.lon.toFixed(6)})," ",e.jsx("button",{type:"button",onClick:()=>n(null),className:"ml-2 text-rose-700 underline",children:s("map.remove_pin")})]}):e.jsx("p",{className:"text-xs text-[#6e786f]",children:s("map.no_location")})]})}function J({lat:a,lon:n},s){const t=j*2**s,h=Math.max(-85.0511,Math.min(85.0511,a)),u=Math.sin(h*Math.PI/180);return{x:(n+180)/360*t,y:(.5-Math.log((1+u)/(1-u))/(4*Math.PI))*t}}function X({x:a,y:n},s){const t=j*2**s,h=a/t*360-180,u=Math.PI-2*Math.PI*n/t;return{lat:180/Math.PI*Math.atan(Math.sinh(u)),lon:h}}const me=`
AF|Afghanistan|93
AX|Åland Islands|358
AL|Albania|355
DZ|Algeria|213
AS|American Samoa|1
AD|Andorra|376
AO|Angola|244
AI|Anguilla|1
AG|Antigua and Barbuda|1
AR|Argentina|54
AM|Armenia|374
AW|Aruba|297
AC|Ascension Island|247
AU|Australia|61
AT|Austria|43
AZ|Azerbaijan|994
BS|Bahamas|1
BH|Bahrain|973
BD|Bangladesh|880
BB|Barbados|1
BY|Belarus|375
BE|Belgium|32
BZ|Belize|501
BJ|Benin|229
BM|Bermuda|1
BT|Bhutan|975
BO|Bolivia|591
BQ|Bonaire, Sint Eustatius and Saba|599
BA|Bosnia and Herzegovina|387
BW|Botswana|267
BR|Brazil|55
IO|British Indian Ocean Territory|246
VG|British Virgin Islands|1
BN|Brunei|673
BG|Bulgaria|359
BF|Burkina Faso|226
BI|Burundi|257
KH|Cambodia|855
CM|Cameroon|237
CA|Canada|1
CV|Cape Verde|238
KY|Cayman Islands|1
CF|Central African Republic|236
TD|Chad|235
CL|Chile|56
CN|China|86
CX|Christmas Island|61
CC|Cocos (Keeling) Islands|61
CO|Colombia|57
KM|Comoros|269
CG|Congo|242
CD|Congo, Democratic Republic of the|243
CK|Cook Islands|682
CR|Costa Rica|506
CI|Côte d’Ivoire|225
HR|Croatia|385
CU|Cuba|53
CW|Curaçao|599
CY|Cyprus|357
CZ|Czechia|420
DK|Denmark|45
DG|Diego Garcia|246
DJ|Djibouti|253
DM|Dominica|1
DO|Dominican Republic|1
EC|Ecuador|593
EG|Egypt|20
SV|El Salvador|503
GQ|Equatorial Guinea|240
ER|Eritrea|291
EE|Estonia|372
SZ|Eswatini|268
ET|Ethiopia|251
FK|Falkland Islands|500
FO|Faroe Islands|298
FJ|Fiji|679
FI|Finland|358
FR|France|33
GF|French Guiana|594
PF|French Polynesia|689
TF|French Southern Territories|262
GA|Gabon|241
GM|Gambia|220
GE|Georgia|995
DE|Germany|49
GH|Ghana|233
GI|Gibraltar|350
GR|Greece|30
GL|Greenland|299
GD|Grenada|1
GS|South Georgia and the South Sandwich Islands|500
GP|Guadeloupe|590
GU|Guam|1
GT|Guatemala|502
GG|Guernsey|44
GN|Guinea|224
GW|Guinea-Bissau|245
GY|Guyana|592
HT|Haiti|509
HN|Honduras|504
HK|Hong Kong|852
HU|Hungary|36
IS|Iceland|354
IN|India|91
ID|Indonesia|62
IR|Iran|98
IQ|Iraq|964
IE|Ireland|353
IM|Isle of Man|44
IL|Israel|972
IT|Italy|39
JM|Jamaica|1
JP|Japan|81
JE|Jersey|44
JO|Jordan|962
KZ|Kazakhstan|7
KE|Kenya|254
KI|Kiribati|686
KP|Korea, North|850
KR|Korea, South|82
XK|Kosovo|383
KW|Kuwait|965
KG|Kyrgyzstan|996
LA|Laos|856
LV|Latvia|371
LB|Lebanon|961
LS|Lesotho|266
LR|Liberia|231
LY|Libya|218
LI|Liechtenstein|423
LT|Lithuania|370
LU|Luxembourg|352
MO|Macao|853
MG|Madagascar|261
MW|Malawi|265
MY|Malaysia|60
MV|Maldives|960
ML|Mali|223
MT|Malta|356
MH|Marshall Islands|692
MQ|Martinique|596
MR|Mauritania|222
MU|Mauritius|230
YT|Mayotte|262
MX|Mexico|52
FM|Micronesia|691
MD|Moldova|373
MC|Monaco|377
MN|Mongolia|976
ME|Montenegro|382
MS|Montserrat|1
MA|Morocco|212
MZ|Mozambique|258
MM|Myanmar|95
NA|Namibia|264
NR|Nauru|674
NP|Nepal|977
NL|Netherlands|31
NC|New Caledonia|687
NZ|New Zealand|64
NI|Nicaragua|505
NE|Niger|227
NG|Nigeria|234
NU|Niue|683
NF|Norfolk Island|672
MK|North Macedonia|389
MP|Northern Mariana Islands|1
NO|Norway|47
OM|Oman|968
PK|Pakistan|92
PW|Palau|680
PS|Palestine|970
PA|Panama|507
PG|Papua New Guinea|675
PY|Paraguay|595
PE|Peru|51
PH|Philippines|63
PL|Poland|48
PN|Pitcairn Islands|64
PT|Portugal|351
PR|Puerto Rico|1
QA|Qatar|974
RE|Réunion|262
RO|Romania|40
RU|Russia|7
RW|Rwanda|250
BL|Saint Barthélemy|590
SH|Saint Helena|290
KN|Saint Kitts and Nevis|1
LC|Saint Lucia|1
MF|Saint Martin|590
PM|Saint Pierre and Miquelon|508
VC|Saint Vincent and the Grenadines|1
WS|Samoa|685
SM|San Marino|378
ST|São Tomé and Príncipe|239
SA|Saudi Arabia|966
SN|Senegal|221
RS|Serbia|381
SC|Seychelles|248
SL|Sierra Leone|232
SG|Singapore|65
SX|Sint Maarten|1
SK|Slovakia|421
SI|Slovenia|386
SB|Solomon Islands|677
SO|Somalia|252
ZA|South Africa|27
SS|South Sudan|211
ES|Spain|34
LK|Sri Lanka|94
SD|Sudan|249
SR|Suriname|597
SJ|Svalbard and Jan Mayen|47
SE|Sweden|46
CH|Switzerland|41
SY|Syria|963
TW|Taiwan|886
TJ|Tajikistan|992
TZ|Tanzania|255
TH|Thailand|66
TL|Timor-Leste|670
TG|Togo|228
TK|Tokelau|690
TO|Tonga|676
TT|Trinidad and Tobago|1
TN|Tunisia|216
TR|Türkiye|90
TM|Turkmenistan|993
TC|Turks and Caicos Islands|1
TV|Tuvalu|688
VI|U.S. Virgin Islands|1
UG|Uganda|256
UA|Ukraine|380
AE|United Arab Emirates|971
GB|United Kingdom|44
US|United States|1
UY|Uruguay|598
UZ|Uzbekistan|998
VU|Vanuatu|678
VA|Vatican City|39
VE|Venezuela|58
VN|Vietnam|84
WF|Wallis and Futuna|681
EH|Western Sahara|212
YE|Yemen|967
ZM|Zambia|260
ZW|Zimbabwe|263
`.trim(),E=me.split(`
`).map(a=>{const[n,s,t]=a.split("|");return{iso2:n,name:s,code:`+${t}`}}).sort((a,n)=>a.name.localeCompare(n.name));function xe({value:a,onChange:n}){const{locale:s,t}=R(),[h,u]=r.useState(!1),[v,y]=r.useState(""),S=r.useRef(null),f=r.useMemo(()=>new Intl.DisplayNames([s],{type:"region"}),[s]),x=E.find(i=>i.iso2===a)??E.find(i=>i.iso2==="LA"),C=v.trim().toLocaleLowerCase(),p=r.useMemo(()=>E.filter(({iso2:i,name:d,code:M})=>{const b=$(i,d,f);return!C||`${i} ${d} ${b} ${M}`.toLocaleLowerCase().includes(C)}),[C,f]);function N(i){i.currentTarget.contains(i.relatedTarget)||u(!1)}function T(i){var d;i.key==="Escape"&&(u(!1),(d=S.current)==null||d.focus())}return e.jsxs("div",{className:"relative w-[46%] min-w-0",onBlur:N,onKeyDown:T,children:[e.jsxs("button",{ref:S,type:"button","aria-label":t("phone.country_select_aria"),"aria-haspopup":"listbox","aria-expanded":h,onClick:()=>{u(i=>!i),y("")},className:`${Q} flex items-center justify-between gap-2 text-left`,children:[e.jsxs("span",{className:"flex min-w-0 items-center truncate",children:[e.jsx(q,{iso2:x.iso2}),e.jsxs("span",{className:"truncate",children:[x.code," · ",$(x.iso2,x.name,f)]})]}),e.jsx("span",{"aria-hidden":"true",className:"shrink-0 text-xs",children:"⌄"})]}),h&&e.jsxs("div",{className:"absolute left-0 top-full z-50 mt-1 w-[min(22rem,85vw)] overflow-hidden rounded-xl border border-[#d5c4aa] bg-white shadow-xl",children:[e.jsx("div",{className:"border-b border-[#e5ded1] p-2",children:e.jsx("input",{autoFocus:!0,type:"search",autoComplete:"off","aria-label":t("phone.country_search_aria"),placeholder:t("phone.country_search_placeholder"),value:v,onChange:i=>y(i.target.value),className:`${Q} py-2.5`})}),e.jsx("div",{role:"listbox","aria-label":t("phone.country_list_aria"),className:"max-h-56 overflow-y-auto p-1",children:p.length===0?e.jsx("p",{className:"px-3 py-4 text-center text-sm text-[#6e786f]",children:t("phone.country_none")}):p.map(({iso2:i,name:d,code:M})=>e.jsxs("button",{type:"button",role:"option","aria-selected":i===x.iso2,onClick:()=>{var b;n(i),u(!1),y(""),(b=S.current)==null||b.focus()},className:`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[#edf4ef] ${i===x.iso2?"bg-[#eaf2ec] font-bold text-[#14543b]":"text-[#294536]"}`,children:[e.jsx(q,{iso2:i}),M," · ",$(i,d,f)]},i))})]})]})}function $(a,n,s){const t=s.of(a);return t&&t!==a?t:n}function ge(a){return[...a.toUpperCase()].map(n=>String.fromCodePoint(127397+n.charCodeAt(0))).join("")}function q({iso2:a}){const[n,s]=r.useState(!1);return r.useEffect(()=>s(!1),[a]),n?e.jsx("span",{"aria-hidden":"true",className:"mr-2 inline-block w-5 shrink-0 text-center",children:ge(a)}):e.jsx("img",{"aria-hidden":"true",src:`https://flagcdn.com/w40/${a.toLowerCase()}.png`,alt:"",loading:"lazy",onError:()=>s(!0),className:"mr-2 inline-block h-[14px] w-5 shrink-0 rounded-[2px] border border-black/10 object-cover"})}const Q="w-full rounded-xl border border-[#d5c4aa] bg-[#edf2fc] px-3.5 py-3 text-sm text-[#18362a] shadow-sm transition focus:border-[#56806f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174a34]/10",I={th:{label:"สกุลเงินหลักของร้าน",lak:"กีบลาว",thb:"บาทไทย",usd:"ดอลลาร์สหรัฐ",help:"ราคาสินค้า บิล และยอดขายของร้านจะใช้สกุลเงินนี้"},lo:{label:"ສະກຸນເງິນຫຼັກຂອງຮ້ານ",lak:"ກີບລາວ",thb:"ບາດໄທ",usd:"ໂດລາສະຫະລັດ",help:"ລາຄາສິນຄ້າ ບິນ ແລະຍອດຂາຍຂອງຮ້ານຈະໃຊ້ສະກຸນເງິນນີ້"},en:{label:"Restaurant currency",lak:"Lao kip",thb:"Thai baht",usd:"US dollar",help:"Menu prices, bills and sales use this currency."},ko:{label:"매장 기본 통화",lak:"라오스 킵",thb:"태국 바트",usd:"미국 달러",help:"메뉴 가격, 영수증 및 매출에 이 통화를 사용합니다."},vi:{label:"Tiền tệ của nhà hàng",lak:"Kip Lào",thb:"Baht Thái",usd:"Đô la Mỹ",help:"Giá món, hóa đơn và doanh thu sử dụng tiền tệ này."},zh:{label:"餐厅使用的货币",lak:"老挝基普",thb:"泰铢",usd:"美元",help:"菜单价格、账单和销售额均使用此货币。"}};function Te(){const{t:a,locale:n}=R(),t=new URLSearchParams(window.location.search).get("inviteToken")??"",[h,u]=r.useState(""),[v,y]=r.useState("LAK"),[S,f]=r.useState(""),[x,C]=r.useState(""),[p,N]=r.useState(""),[T,i]=r.useState(""),[d,M]=r.useState(null),[b,K]=r.useState(""),[A,_]=r.useState(""),[B,l]=r.useState(""),[c,w]=r.useState("LA"),[L,G]=r.useState(""),[D,P]=r.useState(""),[ae,te]=r.useState(""),[F,ne]=r.useState(!1),[U,se]=r.useState(!1),[O,H]=r.useState(!1),[V,z]=r.useState("");async function oe(o){if(o.preventDefault(),O)return;const Y=new FormData(o.currentTarget),Z=String(Y.get("password")??""),re=String(Y.get("confirmPassword")??"");if(Z!==re){z(a("auth.signup.password_mismatch"));return}H(!0),z("");try{const k=await ie("/api/auth/signup",{method:"POST",headers:be,body:JSON.stringify({email:B.trim(),password:Z,phone:fe(L,c),restaurantName:t?void 0:h.trim(),currencyCode:t?void 0:v,street:t?void 0:S.trim(),village:t?void 0:x.trim(),city:t?void 0:p.trim(),province:t?void 0:T.trim(),latitude:t||d==null?void 0:d.lat,longitude:t||d==null?void 0:d.lon,restaurantType:t?void 0:b,restaurantDescription:t?void 0:A.trim(),inviteToken:t||void 0})},{auth:!1});le(k.accessToken),window.location.assign("/dashboard")}catch(k){z(k instanceof W&&k.code==="ACCOUNT_EXISTS"?a("auth.signup.account_exists"):k instanceof W&&k.code==="PASSWORD_TOO_SHORT"?a("auth.signup.password_short"):a("auth.signup.failed"))}finally{H(!1)}}return e.jsx(de,{title:a(t?"auth.signup.invite_title":"auth.signup.title"),subtitle:a(t?"auth.signup.invite_subtitle":"auth.signup.form_subtitle"),children:e.jsxs("form",{onSubmit:oe,className:"space-y-4",children:[!t&&e.jsxs(e.Fragment,{children:[e.jsx(m,{label:a("auth.field.shop_name"),children:e.jsx("input",{required:!0,maxLength:200,value:h,onChange:o=>u(o.target.value),className:g})}),e.jsxs(m,{label:I[n].label,children:[e.jsxs("select",{value:v,onChange:o=>y(o.target.value),className:g,children:[e.jsxs("option",{value:"LAK",children:["LAK — ",I[n].lak]}),e.jsxs("option",{value:"THB",children:["THB — ",I[n].thb]}),e.jsxs("option",{value:"USD",children:["USD — ",I[n].usd]})]}),e.jsx("span",{className:"block text-xs font-normal text-[#6e786f]",children:I[n].help})]}),e.jsx(m,{label:a("auth.signup.street"),children:e.jsx("input",{maxLength:200,autoComplete:"address-line1",value:S,onChange:o=>f(o.target.value),className:g})}),e.jsx(m,{label:a("auth.signup.village"),children:e.jsx("input",{maxLength:200,autoComplete:"address-line2",value:x,onChange:o=>C(o.target.value),className:g})}),e.jsx(m,{label:a("auth.signup.city"),children:e.jsx("input",{maxLength:200,autoComplete:"address-level2",value:p,onChange:o=>N(o.target.value),className:g})}),e.jsx(m,{label:a("auth.signup.province"),children:e.jsx("input",{maxLength:200,autoComplete:"address-level1",value:T,onChange:o=>i(o.target.value),className:g})}),e.jsx(m,{label:a("auth.signup.location_label"),children:e.jsx(pe,{value:d,onChange:M})}),e.jsx(m,{label:a("auth.signup.restaurant_type"),children:e.jsxs("select",{required:!0,value:b,onChange:o=>K(o.target.value),className:g,children:[e.jsx("option",{value:"",children:a("auth.signup.restaurant_type.select")}),e.jsx("option",{value:"thai",children:a("auth.signup.restaurant_type.thai")}),e.jsx("option",{value:"lao",children:a("auth.signup.restaurant_type.lao")}),e.jsx("option",{value:"cafe",children:a("auth.signup.restaurant_type.cafe")}),e.jsx("option",{value:"made_to_order",children:a("auth.signup.restaurant_type.made_to_order")}),e.jsx("option",{value:"seafood",children:a("auth.signup.restaurant_type.seafood")}),e.jsx("option",{value:"buffet",children:a("auth.signup.restaurant_type.buffet")}),e.jsx("option",{value:"other",children:a("auth.signup.restaurant_type.other")})]})}),e.jsx(m,{label:a("auth.signup.description"),children:e.jsx("textarea",{maxLength:1e3,rows:4,value:A,onChange:o=>_(o.target.value),placeholder:a("auth.signup.description.placeholder"),className:`${g} resize-y`})})]}),e.jsx(m,{label:a("auth.field.email"),children:e.jsx("input",{required:!0,autoComplete:"email",type:"email",value:B,onChange:o=>l(o.target.value),className:g})}),e.jsxs(m,{label:a("auth.signup.phone_optional"),children:[e.jsxs("span",{className:"flex gap-2",children:[e.jsx(xe,{value:c,onChange:w}),e.jsx("input",{"aria-label":a("auth.field.phone"),autoComplete:"tel-national",maxLength:25,type:"tel",inputMode:"tel",placeholder:a("auth.signup.phone_placeholder"),value:L,onChange:o=>G(o.target.value),className:`${g} min-w-0 flex-1`})]}),e.jsx("span",{className:"block text-xs font-normal text-[#6e786f]",children:a("auth.signup.phone_help")})]}),e.jsxs(m,{label:a("auth.field.password"),children:[e.jsxs("span",{className:"relative block",children:[e.jsx("input",{required:!0,minLength:8,name:"password",autoComplete:"new-password",type:F?"text":"password",value:D,onChange:o=>P(o.target.value),className:`${g} pr-11`}),e.jsx("button",{type:"button","aria-label":a(F?"password.hide":"password.show"),onClick:()=>ne(o=>!o),className:"absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#68766d]",children:e.jsx(ee,{visible:F})})]}),e.jsx("span",{className:"block text-xs font-normal text-[#6e786f]",children:a("auth.signup.password_hint")})]}),e.jsxs(m,{label:a("auth.signup.confirm_password"),children:[e.jsxs("span",{className:"relative block",children:[e.jsx("input",{required:!0,minLength:8,name:"confirmPassword",autoComplete:"new-password",type:U?"text":"password",value:ae,onChange:o=>te(o.target.value),className:`${g} pr-11`}),e.jsx("button",{type:"button","aria-label":a(U?"password.hide":"password.show"),onClick:()=>se(o=>!o),className:"absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#68766d]",children:e.jsx(ee,{visible:U})})]}),e.jsx("span",{className:"block text-xs font-normal text-[#6e786f]",children:a("auth.signup.password_hint")})]}),V&&e.jsx("p",{role:"alert",className:"rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700",children:V}),e.jsx("button",{disabled:O,className:ye,children:a(O?"auth.signup.submitting":"auth.signup.submit")}),e.jsxs("p",{className:"text-center text-sm text-[#6e786f]",children:[a("auth.signup.has_account")," ",e.jsx("a",{className:"font-bold text-[#14543b] hover:underline",href:t?`/login?next=${encodeURIComponent(`/join/${t}`)}`:"/login",children:a("auth.signup.login_link")})]})]})})}function m({label:a,children:n}){return e.jsxs("label",{className:"block space-y-1.5 text-sm font-bold text-[#315842]",children:[a,n]})}function fe(a,n){const s=a.replace(/\D/g,""),t=["IT","VA"].includes(n)?s:s.replace(/^0+/,"");if(!t)return null;const h=E.find(({iso2:u})=>u===n);return`${(h==null?void 0:h.code)??"+856"}${t}`}function ee({visible:a}){return e.jsx("svg",{"aria-hidden":"true",viewBox:"0 0 24 24",fill:"none",className:"h-4 w-4",stroke:"currentColor",strokeWidth:"1.7",children:a?e.jsxs(e.Fragment,{children:[e.jsx("path",{d:"M3 3l18 18"}),e.jsx("path",{d:"M10.6 10.6a2 2 0 0 0 2.8 2.8"}),e.jsx("path",{d:"M9.9 5.2A10.8 10.8 0 0 1 12 5c6.1 0 9.5 7 9.5 7a16 16 0 0 1-3.1 3.8M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.4 7 9.5 7c1.3 0 2.5-.3 3.5-.8"})]}):e.jsxs(e.Fragment,{children:[e.jsx("path",{d:"M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"}),e.jsx("circle",{cx:"12",cy:"12",r:"2.5"})]})})}const be={"Content-Type":"application/json"},g="mt-1 w-full rounded-xl border border-[#d5c4aa] bg-[#edf2fc] px-3.5 py-3 text-sm text-[#18362a] shadow-sm transition focus:border-[#56806f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#174a34]/10",ye="w-full rounded-xl bg-gradient-to-r from-[#14633f] to-[#0d5035] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(20,99,63,0.24)] transition hover:brightness-105 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50";export{Te as default};
