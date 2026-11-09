const fs=require("node:fs"),dir="dist/assets",dict=require("./i18n/th.json"),mapped=new Set(Object.values(dict));
const re=new RegExp("[\\\"\\x27]([^\\\"\\x27\\\\]{1,220})[\\\"\\x27]","g");
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith(".js"))){const s=fs.readFileSync(`${dir}/${f}`,"utf8"),v=new Set([...s.matchAll(re)].map(m=>m[1]).filter(x=>/[\u0e00-\u0e7f]/.test(x)));const m=[...v].filter(x=>!mapped.has(x)&&!x.includes("${")&&x.length>3);if(m.length)console.log(`${String(m.length).padStart(4)} ${f}`)}
