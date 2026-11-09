import {createRoot, type Root} from "react-dom/client";
import WeeklyHoursEditor from "./WeeklyHoursEditor";
let mounted:{original:HTMLElement;host:HTMLElement;root:Root}|null=null;
let scheduled=false;
function mount() {
  if(mounted&&!mounted.original.isConnected){mounted.root.unmount();mounted.host.remove();mounted=null;}
  if(mounted)return;
  if(window.location.pathname!=="/dashboard/settings")return;
  const input=Array.from(document.querySelectorAll<HTMLInputElement>('input[type="time"]')).find(node=>!node.closest('.weekly-hours-editor'));
  const original=input?.closest<HTMLElement>('.grid.grid-cols-2');
  if(!original||original.querySelectorAll('input[type="time"]').length!==2)return;
  const host=document.createElement('div');host.dataset.weeklyHours="true";original.before(host);original.hidden=true;original.style.display='none';
  const root=createRoot(host);mounted={original,host,root};root.render(<WeeklyHoursEditor />);
}
new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;mount();});}).observe(document.body,{childList:true,subtree:true});
mount();
