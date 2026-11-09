(() => {
  const root = document.createElement('div');
  root.className = 'shopqr-chat-root';
  root.hidden = true;
  document.body.append(root);

  let mode = null;
  let tableCode = null;
  let restaurantId = null;
  let selected = null;
  let open = false;
  let conversations = [];
  let conversationSearch = '';
  let conversationFilter = 'all';
  let staffCalls = [];
  let staffRole = null;
  let messages = [];
  let pollTimer = null;
  let busy = false;
  let acknowledgingCall = false;
  let error = '';
  let composerDraft = '';

  const token = () => localStorage.getItem('shopqr_access_token') || '';
  async function request(url, options = {}, auth = false) {
    const headers = new Headers(options.headers || {});
    if (auth && token()) headers.set('Authorization', `Bearer ${token()}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, {...options, headers, credentials:'include'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP_${response.status}`);
    return data;
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = value => new Date(value).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});

  async function detectMode() {
    clearTimeout(pollTimer);
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'dashboard') {
      mode = 'staff'; tableCode = null;
      try {
        const data = await request('/api/auth/me',{},true);
        restaurantId = data.membership?.restaurant_id;
        staffRole = data.membership?.role || null;
        root.hidden = !restaurantId;
        if (restaurantId) await refresh();
      } catch { root.hidden = true; }
      return;
    }
    root.hidden = true; mode = null; open = false;
  }

  async function refresh() {
    if (!mode) return;
    try {
      if (mode === 'customer') {
        const data = await request(`/api/public/chat/${encodeURIComponent(tableCode)}${open?'?read=true':''}`);
        messages = data.messages; selected = data.table; error = '';
        render(data.unread);
      } else if (selected && open) {
        const [data, callData] = await Promise.all([
          request(`/api/restaurants/${restaurantId}/chat/${selected.table_id}?read=true`,{},true),
          request(`/api/restaurants/${restaurantId}/call-staff`,{},true)
        ]);
        messages = data.messages; selected = {...selected,...data.table}; error = '';
        staffCalls = callData.requests || [];
        render();
      } else {
        const [data, callData] = await Promise.all([
          request(`/api/restaurants/${restaurantId}/chat`,{},true),
          request(`/api/restaurants/${restaurantId}/call-staff`,{},true)
        ]);
        staffCalls = callData.requests || [];
        conversations = mergeStaffItems(data.conversations, staffCalls); error = '';
        hideLegacyCallPanel();
        render();
      }
    } catch (e) {
      error = e.message === 'TABLE_NOT_FOUND' ? 'โต๊ะนี้ยังไม่เปิดใช้งาน' : 'เชื่อมต่อแชตไม่สำเร็จ';
      render();
    }
    clearTimeout(pollTimer);
    pollTimer = setTimeout(refresh, open ? 3000 : 5000);
  }

  function launcher(unread) {
    return `<button class="shopqr-chat-launcher" type="button" aria-label="${mode==='staff'?'แชตกับลูกค้า':'แชตกับพนักงาน'}" aria-expanded="${open}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.6-4A8 8 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-linecap="round" stroke-width="2.5"/></svg>
      ${unread?`<span class="shopqr-chat-badge">${unread>99?'99+':unread}</span>`:''}</button>`;
  }
  function render(unreadValue) {
    if (mode !== 'staff') {
      root.hidden = true;
      root.innerHTML = '';
      return;
    }
    root.hidden = false;
    const unread = unreadValue ?? conversations.reduce((n,c)=>n+Number(c.unread||0)+Number(c.call_count||0),0);
    root.innerHTML = launcher(unread) + (open ? panel() : '');
    root.querySelector('.shopqr-chat-launcher')?.addEventListener('click',()=>{
      if(open){open=false;render(unread)}else{open=true;refresh()}
    });
    if (!open) return;
    const active = document.activeElement;
    const restoreComposerFocus = active?.matches?.('.shopqr-chat-form textarea') && root.contains(active);
    const selection = restoreComposerFocus ? active.selectionStart : null;
    const oldList = root.querySelector('.shopqr-chat-list');
    const listScrollTop = oldList?.scrollTop ?? 0;
    root.querySelector('.shopqr-chat-close')?.addEventListener('click',()=>{open=false;render(unread)});
    const searchInput = root.querySelector('.shopqr-chat-search-input');
    searchInput?.addEventListener('input', event => {
      conversationSearch = event.target.value;
      const query = conversationSearch.toLocaleLowerCase().trim();
      let visible = 0;
      root.querySelectorAll('.shopqr-chat-conversation-wrap').forEach(row => {
        row.hidden = !row.dataset.search.includes(query);
        if (!row.hidden) visible += 1;
      });
      const empty = root.querySelector('.shopqr-chat-list-empty');
      if (empty) empty.hidden = visible > 0;
    });
    root.querySelectorAll('.shopqr-chat-filter').forEach(button => button.addEventListener('click', () => {
      conversationFilter = button.dataset.filter;
      render(unread);
      root.querySelector('.shopqr-chat-search-input')?.focus();
    }));
    root.querySelector('.shopqr-chat-back')?.addEventListener('click',()=>{selected=null;messages=[];refresh()});
    root.querySelectorAll('.shopqr-chat-conversation').forEach(button=>button.addEventListener('click',()=>{
      const conversation=conversations.find(c=>c.table_id===button.dataset.id);
      if(!conversation)return;
      selected=conversation; messages=[]; refresh();
    }));
    root.querySelectorAll('.shopqr-chat-ack').forEach(button=>button.addEventListener('click',acknowledgeCall));
    const form=root.querySelector('.shopqr-chat-form');
    form?.addEventListener('submit',sendMessage);
    const textarea=form?.querySelector('textarea');
    if(textarea) textarea.value=composerDraft;
    textarea?.addEventListener('input',()=>{composerDraft=textarea.value;resizeComposer(textarea);});
    textarea?.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();form.requestSubmit();}});
    if(textarea) resizeComposer(textarea);
    if(restoreComposerFocus&&textarea){textarea.focus({preventScroll:true});textarea.setSelectionRange(selection,selection);}
    const body=root.querySelector('.shopqr-chat-body');
    if(body&&root.querySelector('.shopqr-chat-list')) body.scrollTop=listScrollTop;
    else if(body) body.scrollTop=body.scrollHeight;
  }
  function panel() {
    const inThread = mode==='customer' || selected;
    const title = mode==='customer' ? 'ติดต่อพนักงาน' : selected ? `โต๊ะ ${esc(selected.table_number)}` : 'แชตกับลูกค้า';
    const subtitle = mode==='customer' ? `โต๊ะ ${esc(selected?.table_number||'')} ${selected?.zone_name?`· ${esc(selected.zone_name)}`:''}` : selected ? esc(selected.zone_name||'') : '';
    return `<section class="shopqr-chat-panel" role="dialog" aria-label="${title}">
      <header class="shopqr-chat-head"><button class="shopqr-chat-back" type="button" ${mode==='staff'&&selected?'':'hidden'} aria-label="ย้อนกลับ">‹</button><div class="shopqr-chat-head-text"><strong>${title}</strong>${subtitle?`<small>${subtitle}</small>`:''}</div><button class="shopqr-chat-close" type="button" aria-label="ปิด">×</button></header>
      ${error?`<div class="shopqr-chat-error">${esc(error)}</div>`:''}
      ${inThread?thread():conversationList()}
    </section>`;
  }
  function thread() {
    const mine = mode==='customer'?'customer':'staff';
    const content = messages.length ? messages.map(m=>`<div class="shopqr-chat-row ${m.sender===mine?'is-mine':''}"><div class="shopqr-chat-bubble">${esc(m.message)}<small class="shopqr-chat-meta">${m.sender===mine?'คุณ':esc(m.sender_name||'ลูกค้า')} · ${time(m.created_at)}</small></div></div>`).join('') : `<div class="shopqr-chat-empty">ยังไม่มีข้อความ<br>พิมพ์ข้อความเพื่อเริ่มสนทนา</div>`;
    return `<div class="shopqr-chat-body">${content}</div><form class="shopqr-chat-form"><textarea maxlength="1000" rows="2" required placeholder="พิมพ์ข้อความ..."></textarea><button class="shopqr-chat-send" type="submit" aria-label="ส่งข้อความ" ${busy?'disabled':''}>➤</button></form>`;
  }
  function resizeComposer(textarea) {
    textarea.style.height='auto';
    textarea.style.height=Math.min(textarea.scrollHeight,140)+'px';
    textarea.style.overflowY=textarea.scrollHeight>140?'auto':'hidden';
  }
  function conversationList() {
    const matching = conversations.filter(c => {
      if (conversationFilter === 'unread' && !(Number(c.unread) + Number(c.call_count))) return false;
      if (conversationFilter === 'calls' && !c.call_reason) return false;
      const haystack = [c.table_number, c.zone_name, c.call_reason, c.last_message].filter(Boolean).join(' ').toLocaleLowerCase();
      return haystack.includes(conversationSearch.toLocaleLowerCase().trim());
    });
    const content = matching.map(c => {
      const pending = Number(c.call_count || 0);
      const unread = Number(c.unread || 0) + pending;
      const rowClass = pending ? 'has-call' : c.call_acknowledged ? 'has-acknowledged-call' : '';
      const preview = c.show_call_reason
        ? `🔔 ลูกค้า: ${esc(c.call_reason || 'เรียกพนักงาน')}`
        : `${c.last_sender === 'staff' ? 'คุณ: ' : 'ลูกค้า: '}${esc(c.last_message)}`;
      const search = [c.table_number, c.zone_name, c.call_reason, c.last_message].filter(Boolean).join(' ').toLocaleLowerCase();
      return `<div class="shopqr-chat-conversation-wrap ${pending && ['owner','waiter','staff'].includes(staffRole) ? 'has-quick-ack' : ''}" data-search="${esc(search)}">
        <button class="shopqr-chat-conversation ${rowClass}" type="button" data-id="${c.table_id}">
          <span class="shopqr-chat-table">${esc(c.table_number)}</span>
          <span class="shopqr-chat-preview"><strong>โต๊ะ ${esc(c.table_number)}${c.zone_name ? ` · ${esc(c.zone_name)}` : ''}</strong><span class="shopqr-chat-preview-message">${preview}</span>${pending > 1 ? `<small>มีคำขอเรียกพนักงาน ${pending} รายการ</small>` : ''}</span>
          <span class="shopqr-chat-side"><time>${time(c.activity_at || c.created_at)}</time>${unread ? `<i class="shopqr-chat-unread">${unread}</i>` : c.call_acknowledged ? '<i class="shopqr-chat-read-check" aria-label="รับทราบแล้ว">✓</i>' : ''}</span>
        </button>
        ${pending && ['owner','waiter','staff'].includes(staffRole) ? `<button type="button" class="shopqr-chat-ack shopqr-chat-quick-ack" data-id="${c.call_id}" data-table-id="${c.table_id}">&#x0e15;&#x0e2d;&#x0e1a;&#x0e41;&#x0e0a;&#x0e15;</button>` : ''}
      </div>`;
    }).join('');
    const filters = [['all', 'ทั้งหมด'], ['unread', 'ยังไม่อ่าน'], ['calls', 'คำขอ']];
    return `<div class="shopqr-chat-list-shell">
      <div class="shopqr-chat-list-toolbar">
        <label class="shopqr-chat-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16 16 4 4"></path></svg><input class="shopqr-chat-search-input" type="search" value="${esc(conversationSearch)}" placeholder="ค้นหาโต๊ะหรือข้อความ" aria-label="ค้นหาแชต"></label>
        <div class="shopqr-chat-filters">${filters.map(([key, label]) => `<button class="shopqr-chat-filter ${conversationFilter === key ? 'is-active' : ''}" type="button" data-filter="${key}">${label}</button>`).join('')}</div>
      </div>
      <div class="shopqr-chat-body shopqr-chat-list">${content}${conversations.length ? `<div class="shopqr-chat-empty shopqr-chat-list-empty" ${matching.length ? 'hidden' : ''}>ไม่พบแชตที่ตรงกับการค้นหา</div>` : '<div class="shopqr-chat-empty">ยังไม่มีข้อความหรือคำขอจากลูกค้า</div>'}</div>
    </div>`;
  }
  function mergeStaffItems(chatItems, calls) {
    const byTable = new Map(chatItems.map(item => [item.table_id, {
      ...item, call_count: 0, call_reason: null, call_activity_at: null,
      call_acknowledged: false, show_call_reason: false,
      chat_activity_at: item.created_at, activity_at: item.created_at
    }]));
    for (const call of calls) {
      const current = byTable.get(call.table_id) || {
        table_id: call.table_id, table_number: call.table_number,
        zone_name: call.zone_name, last_message: '', last_sender: 'customer',
        created_at: call.created_at, unread: 0, call_count: 0,
        call_reason: null, call_activity_at: null, call_acknowledged: false,
        show_call_reason: false, chat_activity_at: null, activity_at: call.created_at
      };
      if (!call.acknowledged) current.call_count += 1;
      if (!current.call_activity_at || new Date(call.created_at) >= new Date(current.call_activity_at)) {
        current.call_reason = call.reason || 'เรียกพนักงาน';
        current.call_id = call.id;
        current.call_activity_at = call.created_at;
        current.call_acknowledged = Boolean(call.acknowledged);
      }
      if (!current.activity_at || new Date(call.created_at) > new Date(current.activity_at)) {
        current.activity_at = call.created_at;
      }
      byTable.set(call.table_id, current);
    }
    for (const current of byTable.values()) {
      current.show_call_reason = Boolean(current.call_reason &&
        (!current.chat_activity_at || new Date(current.call_activity_at) >= new Date(current.chat_activity_at)));
    }
    return [...byTable.values()].sort((a, b) =>
      new Date(b.activity_at || b.created_at) - new Date(a.activity_at || a.created_at));
  }
  async function acknowledgeCall(event) {
    const button = event.currentTarget;
    if (acknowledgingCall) return;
    const tableId = button.dataset.tableId;
    selected = conversations.find(item => String(item.table_id) === tableId) || null;
    if (!selected) return;
    open = true;
    conversations = conversations.map(item => String(item.table_id) === tableId
      ? {...item, unread: 0, call_count: 0, call_acknowledged: true}
      : item);
    staffCalls = staffCalls.map(call => call.id === button.dataset.id ? {...call, acknowledged: true} : call);
    error = '';
    render(0);
    acknowledgingCall = true;
    button.disabled = true;
    try {
      const result = await request('/api/restaurants/' + restaurantId + '/call-staff/' + button.dataset.id + '/ack',{method:'PATCH'},true);
      staffCalls = staffCalls.map(call => call.id === button.dataset.id ? result.request : call);
      const list = await request('/api/restaurants/' + restaurantId + '/chat',{},true);
      conversations = mergeStaffItems(list.conversations,staffCalls).map(item =>
        String(item.table_id) === tableId ? {...item, unread: 0, call_count: 0, call_acknowledged: true} : item);
      selected = conversations.find(item => String(item.table_id) === tableId) || selected;
      open = true;
      error = '';
      await refresh();
    } catch {
      error = '???????????????????? ????????????????????????????';
      render(0);
    } finally {
      acknowledgingCall = false;
    }
  }
  function hideLegacyCallPanel() {
    if (mode!=='staff') return;
    document.querySelectorAll('#root section.mb-4.border-amber-200').forEach(section=>{
      if (section.querySelector('button')) section.setAttribute('hidden','');
    });
  }
  async function sendMessage(event) {
    event.preventDefault(); if(busy) return;
    const textarea=event.currentTarget.querySelector('textarea'); const message=textarea.value.trim(); if(!message)return;
    composerDraft='' ; busy=true; render();
    try {
      if(mode==='customer') await request(`/api/public/chat/${encodeURIComponent(tableCode)}`,{method:'POST',body:JSON.stringify({message})});
      else await request(`/api/restaurants/${restaurantId}/chat/${selected.table_id}`,{method:'POST',body:JSON.stringify({message})},true);
      textarea.value=''; error=''; await refresh();
    } catch(e) { composerDraft=message; error=e.message==='PLEASE_WAIT'?'ส่งข้อความเร็วเกินไป กรุณารอสักครู่':'ส่งข้อความไม่สำเร็จ'; }
    finally {busy=false; render(); root.querySelector('textarea')?.focus();}
  }

  window.addEventListener('shopqr:open-staff-chat', () => {
    if (mode !== 'staff') return;
    open = true;
    if (restaurantId) refresh();
  });
  window.addEventListener('popstate',detectMode);
  window.addEventListener('shopqr:auth-changed',detectMode);
  let legacyPanelCheckQueued=false;
  const scheduleLegacyPanelCheck=()=>{
    if(legacyPanelCheckQueued)return;
    legacyPanelCheckQueued=true;
    requestAnimationFrame(()=>{legacyPanelCheckQueued=false;hideLegacyCallPanel()});
  };
  new MutationObserver(scheduleLegacyPanelCheck).observe(document.getElementById('root'),{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',detectMode,{once:true});
  if(document.readyState!=='loading') detectMode();
})();
