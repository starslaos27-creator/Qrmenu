const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), {spawn}=require('node:child_process'), assert=require('node:assert/strict');
const dist=path.resolve(__dirname,'../dist'), output=path.resolve(__dirname,'../../.local/menu-view-check');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 fs.mkdirSync(output,{recursive:true});
 const fixture=require('./menu-view-fixture.cjs');
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/dashboard/menu'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(fixture);}
  const file=path.resolve(dist,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
  const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));
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
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/dashboard/menu'});
  await wait('document.querySelectorAll("[data-menu-view-button]").length===2');
  await wait('document.querySelectorAll(".menu-list-facts").length===6');
  assert.equal(await evaluate('document.querySelector(".menu-card-list-panel").dataset.menuView'),'grid');
  const gridColumns=await evaluate('getComputedStyle(document.querySelector("section > ul")).gridTemplateColumns');assert.ok(gridColumns.split(' ').length>1);
  await evaluate('document.querySelector("[data-menu-view-button=list]").click()');
  assert.equal(await evaluate('getComputedStyle(document.querySelector("section > ul")).gridTemplateColumns.split(" ").length'),1);
  assert.equal(await evaluate('document.querySelector("[data-menu-view-button=list]").getAttribute("aria-pressed")'),'true');
  assert.ok(await evaluate('document.querySelector("section > ul > li").getBoundingClientRect().height<180'));
  assert.equal(await evaluate('document.querySelector(".fixture-image").getClientRects()[0]?.width || 0'),0);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".menu-shared-description")).display'),'none');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".menu-list-facts")).display'),'grid');
  assert.deepEqual(await evaluate('Array.from(document.querySelector(".menu-list-facts").querySelectorAll("dd"),n=>n.textContent)'),['₭45,000','₭120,000','20 จาน','—','—']);
  assert.equal(await evaluate('document.querySelectorAll(".menu-list-facts")[1].querySelector(".is-low dd").textContent'),'ใกล้หมด');
  assert.equal(await evaluate('document.querySelectorAll(".menu-list-facts")[2].querySelector(".is-empty dd").textContent'),'หมดสต็อก');
  assert.ok(await evaluate('document.querySelectorAll(".menu-list-facts")[3].textContent.includes("ไม่ติดตามสต็อก")'));
  assert.equal(await evaluate('document.querySelectorAll(".menu-list-facts")[3].querySelectorAll(".is-low,.is-empty").length'),0);
  assert.equal(await evaluate('document.querySelectorAll(".menu-list-facts")[4].querySelector("dd").textContent'),'₭0');
  assert.equal(await evaluate('document.querySelectorAll(".menu-list-facts")[5].querySelector("dd").textContent'),'—');
  await evaluate('document.querySelector("input[type=search]").value="test";document.querySelector("input[type=search]").dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("input[type=checkbox]").click();document.querySelector(".menu-card-list-content button").click();document.querySelector(".menu-list-adjust").click();');
  assert.equal(await evaluate('window.searchValue'),'test');assert.equal(await evaluate('window.editCount'),1);assert.equal(await evaluate('window.adjustOpened'),true);
  await evaluate('document.querySelector("section > ul").append(document.querySelector("section > ul > li").cloneNode(true))');await delay(100);
  assert.equal(await evaluate('document.querySelector(".menu-card-list-panel").dataset.menuView'),'list');
  fs.writeFileSync(path.join(output,'list-desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await send('Page.reload');await wait('document.querySelector(".menu-card-list-panel")?.dataset.menuView==="list"');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  fs.writeFileSync(path.join(output,'list-mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate('document.querySelector("[data-menu-view-button=grid]").click()');assert.equal(await evaluate('document.querySelector(".menu-card-list-panel").dataset.menuView'),'grid');
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('getComputedStyle(document.querySelector("section > ul")).gridTemplateColumns'),gridColumns);
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".menu-list-facts")).display'),'none');
  assert.ok(await evaluate('document.querySelector(".fixture-image").getBoundingClientRect().width>0'));
  assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".menu-shared-description")).display'),'none');
  fs.writeFileSync(path.join(output,'grid-desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[]);console.log('PASS: immediate list/grid switch, saved preference, rerender, search/edit/stock actions and mobile layout.');
  await send('Browser.close').catch(()=>{});
 }finally{socket?.close();browser.kill();server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
