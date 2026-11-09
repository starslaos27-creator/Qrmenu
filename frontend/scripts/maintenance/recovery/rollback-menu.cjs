const fs = require('fs');
const path = require('path');
const logs = 'C:/Users/STARS/.codex/sessions/2026/09/13';
const file = fs.readdirSync(logs).find(f => f.includes('17-46-37'));
const events = fs.readFileSync(path.join(logs,file),'utf8').trim().split('\n').map(JSON.parse);
const root = path.join(__dirname,'../../../dist');
const names = ['assets/menu-list-cards.js','assets/menu-list-cards.css','index.html'];
const contents = Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(root,n),'utf8').replace(/\r\n/g,'\n')]));
const calls = events.filter(e=>e.timestamp > '2026-09-13T11:19:00' && e.payload?.type==='custom_tool_call' && e.payload.input?.startsWith('const patch = '));
for (const e of calls.reverse()) {
  const result = events.find(r=>r.payload?.type==='custom_tool_call_output' && r.payload.call_id===e.payload.call_id);
  if (JSON.stringify(result).includes('Script failed')) continue;
  const literal = e.payload.input.match(/^const patch = ("(?:[^"\\]|\\.)*");/)[1];
  const patch = JSON.parse(literal);
  for (const section of patch.split('*** Update File: ').slice(1)) {
    const lines = section.split('\n');
    const name = lines.shift().split('frontend\\dist\\')[1]?.replace(/\\/g,'/');
    if (!names.includes(name)) throw Error('Unexpected file '+name);
    const hunks = [];
    let h;
    for(const line of lines) {
      if(line.startsWith('@@')) {h=[];hunks.push(h);}
      else if(h && /^[ +\-]/.test(line)) h.push(line);
    }
    for(const hunk of hunks.reverse()) {
      const after=hunk.filter(l=>l[0]!=='-').map(l=>l.slice(1)).join('\n');
      const before=hunk.filter(l=>l[0]!=='+').map(l=>l.slice(1)).join('\n');
      if(!after) {
        if(name!=='index.html') throw Error('Missing anchor');
        contents[name]=contents[name].replace('  </head>',before+'\n  </head>');
      } else {
        const pos=contents[name].indexOf(after);
        if(pos<0) throw Error('Mismatch '+e.timestamp+' '+name+' '+after.slice(0,100));
        if(contents[name].indexOf(after,pos+1)>=0) throw Error('Ambiguous hunk '+e.timestamp+' '+name);
        contents[name]=contents[name].slice(0,pos)+before+contents[name].slice(pos+after.length);
      }
    }
  }
}
const backup=path.join(__dirname,'../../../../.local/rollback-menu-'+Date.now());
fs.mkdirSync(backup,{recursive:true});
for(const name of names) {
  fs.copyFileSync(path.join(root,name),path.join(backup,path.basename(name)));
  fs.writeFileSync(path.join(backup,'restored-'+path.basename(name)),contents[name]);
}
console.log('Prepared rollback: '+backup);
if(process.argv.includes('--apply')) {
  for(const name of names) fs.writeFileSync(path.join(root,name),contents[name]);
  console.log('Restored three menu files to 2026-09-13 18:19 +07:00');
}
