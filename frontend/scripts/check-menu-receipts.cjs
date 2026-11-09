const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), {spawn}=require('node:child_process'), assert=require('node:assert/strict');
const dist=path.resolve(__dirname,'../dist'), output=path.resolve(__dirname,'../../.local/receipt-history-check');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
  if(req.url==='/'){
   res.setHeader('Content-Type','text/html; charset=utf-8');
   return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/menu-stock-history.css"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f6f7f3;font-family:Tahoma,sans-serif}h1,h2,p{margin:0}button,input{font:inherit}</style><div id="root"></div><script type="module">import{r as React,c as ReactDOM}from'/assets/vendor-react-DCUvmuBu.js';import{MenuStockHistory}from'/assets/menu-stock-history.js';ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MenuStockHistory,{restaurantId:'test'}));</script>`);
  }
  if(req.url==='/assets/test-api.js')return res.end(`export async function e(url){window.lastHistoryUrl=url; await new Promise(r=>setTimeout(r,40));if(window.historyMode==='error')throw Error('test');const q=new URL(url,location.origin).searchParams;const offset=Number(q.get('offset')||0);const all=Array.from({length:53},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),created_at:'2026-10-04T05:30:00Z',menu_name:i%2?'น้ำดื่ม':'เบียร์ลาว',barcode:'885000001',quantity:24,before:12,after:36,actor_name:'พนักงานรับสินค้า',unit:'ขวด',note:'เอกสาร INV-2026-001',legacy:false}));const rows=window.historyMode==='empty'?[]:all.filter(r=>!q.get('search')||r.menu_name.includes(q.get('search')));return{total:rows.length,products:rows.length?2:0,receipts:rows.slice(offset,offset+50)};}`);
  const file=path.resolve(dist,'.'+decodeURIComponent(req.url));
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  let data=fs.readFileSync(file);
  if(req.url==='/assets/menu-stock-history.js')data=data.toString().replace("'./index-BjXGGWCT.js'","'./test-api.js'");
  res.end(data);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const profile=path.join(output,'browser-profile-'+Date.now());
 const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
 let socket;
 try{
  const active=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<100&&!fs.existsSync(active);i++)await delay(100);
  const port=fs.readFileSync(active,'utf8').split('\n')[0];
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let next=0;const pending=new Map(),errors=[];
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async expression=>{for(let i=0;i<80;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw Error('Timed out: '+expression);};
  const click=label=>evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1365,height:960,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  await wait('document.querySelectorAll("tbody tr").length===50');
  fs.writeFileSync(path.join(output,'desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await click('ถัดไป →');await wait('document.querySelectorAll("tbody tr").length===3');
  await evaluate('document.querySelector(".stock-history-view").click()');await wait('document.querySelector("dialog[open]")');
  assert.ok(await evaluate('document.querySelector("dialog").textContent.includes("INV-2026-001")'));
  await click('ปิด ✕');await wait('!document.querySelector("dialog")');
  await click('วันนี้');await wait('new URL(window.lastHistoryUrl,location.origin).searchParams.get("from")!==""');
  await click('ล้างตัวกรอง');await wait('document.querySelectorAll("tbody tr").length===50');
  await evaluate(`const input=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'น้ำดื่ม');input.dispatchEvent(new Event('input',{bubbles:true}));`);
  await click('ค้นหา');await wait('document.querySelectorAll("tbody tr").length===26');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  fs.writeFileSync(path.join(output,'mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate('window.historyMode="empty"');await click('↻ รีเฟรช');await wait('document.body.textContent.includes("ไม่พบรายการรับเข้า")');
  await evaluate('window.historyMode="error"');await click('↻ รีเฟรช');await wait('document.body.textContent.includes("โหลดประวัติไม่สำเร็จ")');
  await evaluate('window.historyMode="normal"');await click('ลองใหม่');await wait('document.querySelectorAll("tbody tr").length===26');
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile rendering, details dialog, pagination, date/search filters, empty/error/retry states; screenshots in .local/receipt-history-check.');
  await send('Browser.close').catch(()=>{});
 }finally{socket?.close();browser.kill();server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
