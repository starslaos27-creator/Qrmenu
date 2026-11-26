import type {Root} from "react-dom/client";
let mounted:{original:HTMLElement;host:HTMLElement;root:Root|null}|null=null;
let scheduled=false;
let loading=false;
async function mount() {
  if(mounted&&!mounted.original.isConnected){mounted.root?.unmount();mounted.host.remove();mounted=null;loading=false;}
  if(mounted)return;
  if(window.location.pathname!=="/dashboard/settings")return;
  const input=Array.from(document.querySelectorAll<HTMLInputElement>('input[type="time"]')).find(node=>!node.closest('.weekly-hours-editor'));
  const original=input?.closest<HTMLElement>('.grid.grid-cols-2');
  if(!original||original.querySelectorAll('input[type="time"]').length!==2||loading)return;
  const host=document.createElement('div');host.dataset.weeklyHours="true";original.before(host);original.hidden=true;original.style.display='none';
  mounted={original,host,root:null};loading=true;
  try {
    const [{createRoot},{createElement},{default:WeeklyHoursEditor}]=await Promise.all([import("react-dom/client"),import("react"),import("./WeeklyHoursEditor")]);
    if(!host.isConnected||window.location.pathname!=="/dashboard/settings")return;
    const root=createRoot(host);mounted={original,host,root};root.render(createElement(WeeklyHoursEditor));
  } catch(error) {
    host.remove();original.hidden=false;original.style.display="";mounted=null;console.error("Weekly hours settings failed to load",error);
  } finally {loading=false;}
}
new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;void mount();});}).observe(document.body,{childList:true,subtree:true});
void mount();
