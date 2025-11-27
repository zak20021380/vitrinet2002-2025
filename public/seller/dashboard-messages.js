// dashboard-messages.js



/*************************************************
 * ۱) Polling پیام‌ها برای به‌روزرسانی آنی لیست چت
 *************************************************/
let chatsInterval = null;           // شناسه setInterval
let currentChatId = null;           // اگر مدال باز است، آی‌دی چت فعال
let chatsBox      = null;           // بعداً در DOMContentLoaded مقدار می‌گیرد
let firstLoad     = true;           // فقط بار اول لودینگ را نشان بده
let chatsData     = [];             // ذخیره لیست چت‌ها برای محاسبه بج

const MESSAGES_API = window.VITRINET_API || null;
const apiUrl = path => MESSAGES_API ? MESSAGES_API.buildUrl(path) : `http://localhost:5000${path}`;
const withCreds = (init = {}) => {
  if (MESSAGES_API) return MESSAGES_API.ensureCredentials(init);
  if (init.credentials === undefined) {
    return { ...init, credentials: 'include' };
  }
  return init;
};

function startChatsPolling() {
  if (chatsInterval) clearInterval(chatsInterval);
  fetchChats().catch(console.error);
  chatsInterval = setInterval(() => fetchChats().catch(console.error), 5000);
}
function stopChatsPolling() {
  if (chatsInterval) {
    clearInterval(chatsInterval);
    chatsInterval = null;
  }
}
document.addEventListener('visibilitychange', () =>
  document.hidden ? stopChatsPolling() : startChatsPolling()
);
window.addEventListener('beforeunload', stopChatsPolling);

/* اجرای اولیه پس از آماده شدن کامل DOM */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMessaging);
} else {
  initMessaging();
}
function initMessaging() {
  chatsBox = document.getElementById('chats');
  startChatsPolling();
}



/***********************************************
 * ۲) متغیرها و عناصر مدال گفت‌وگو
 ***********************************************/
const chatModalBg      = document.getElementById('chatModalBg');
const closeChatModal   = document.getElementById('closeChatModal');
const chatModalTitle   = document.getElementById('chatModalTitle');
const chatModalSub     = document.getElementById('chatModalSub');
const chatModalAvatar  = document.getElementById('chatModalAvatar');
const chatModalMsgsBox = document.getElementById('chatModalMessages');
const chatReplyForm    = document.getElementById('chatReplyForm');
const chatReplyInput   = document.getElementById('chatReplyInput');

closeChatModal.addEventListener('click', () => {
  chatModalBg.classList.add('hidden');
  document.body.style.overflow = '';
  currentChatId = null;
  chatModalMsgsBox.innerHTML = '';
  chatReplyInput.value = '';
});

chatReplyForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = chatReplyInput.value.trim();
  if (!text || !currentChatId) return;
  try {
    const res = await fetch(apiUrl(`/api/chats/${currentChatId}/reply`), withCreds({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from: 'seller' })
    }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در ارسال پیام');
    }
    chatReplyInput.value = '';
    await fetchChats();          // بعد از ارسال، لیست و مدال به‌روزرسانی شوند
  } catch (err) {
    alert('❌ ' + err.message);
  }
});



/***********************************************
 * ۳) توابع کمکی
 ***********************************************/
function formatAgo(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return m + ' دقیقه پیش';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ساعت پیش';
  return Math.floor(h / 24) + ' روز پیش';
}
function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('fa-IR') + ' - ' +
         d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}
const fa = n => n.toLocaleString('fa-IR');



/***********************************************
 * ۴) واکشی و رندر لیست چت‌ها
 ***********************************************/
async function fetchChats() {
  if (firstLoad && chatsBox) {
    chatsBox.innerHTML = '<div class="text-gray-400 text-center py-8">در حال بارگذاری …</div>';
  }
  try {
  const res = await fetch(apiUrl('/api/chats'), withCreds());
    if (res.status === 401) throw new Error('لطفاً ابتدا وارد شوید.');
    if (!res.ok) throw new Error('خطا در واکشی چت‌ها');

    const chats = await res.json();
    chats.forEach(c => {
      if (Array.isArray(c.messages)) {
        c.messages.sort((a, b) => {
          const ta = new Date(a.createdAt || a.date || a.timestamp).getTime();
          const tb = new Date(b.createdAt || b.date || b.timestamp).getTime();
          return ta - tb;
        });
      }
    });

    chatsData = chats;
    if (typeof window.updateBadge === 'function') {
      const totalUnread = chatsData.reduce(
        (s, c) => s + (c.messages || []).filter(m => m.from !== 'seller' && !m.readBySeller).length,
        0
      );
      window.updateBadge(totalUnread);
    }

    // ساخت پیام مناسب وقتی چتی نیست
    if (!chats.length) {
      chatsBox.innerHTML = '<div class="text-center text-gray-400 py-8">هنوز هیچ پیامی دریافت نکرده‌ای!</div>';
      removeErrorBar();
      firstLoad = false;
      return;
    }

    // ساخت لیست در Fragment و جایگزینی اتمیک
    const frag = document.createDocumentFragment();
    chats.forEach(chat => frag.appendChild(renderChatListItem(chat)));
    chatsBox.replaceChildren(frag);
    removeErrorBar();
    firstLoad = false;

    // اگر مدال باز است آن را هم تازه کن
    if (currentChatId) {
      const active = chats.find(c => c._id === currentChatId);
      if (active) renderChatModal(active);
    }
  } catch (err) {
    console.error('fetchChats:', err);
    showErrorBar(err.message || 'خطای شبکه هنگام واکشی چت‌ها');
    firstLoad = false;
  }
}

/* نمایش نوار خطای موقت بالای لیست، بدون پاک‌کردن محتوا */
function showErrorBar(msg) {
  if (!chatsBox) return;
  let bar = document.getElementById('fetchErrorBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'fetchErrorBar';
    bar.className = 'bg-red-100 text-red-700 text-sm px-4 py-2 rounded mb-3';
    chatsBox.before(bar);
  }
  bar.textContent = '❌ ' + msg;
}
function removeErrorBar() {
  const bar = document.getElementById('fetchErrorBar');
  if (bar) bar.remove();
}



/***********************************************
 * ۵) رندر یک آیتم در لیست چت‌ها
 *    (فقط DOM می‌سازد و برمی‌گرداند)
 ***********************************************/
function renderChatListItem(chat) {
  const unread        = (chat.messages || []).filter(m => m.from !== 'seller' && !m.readBySeller).length;
  const productObj    = chat.productId || {};
  const productImg    = productObj.images?.[0] || '';
  const productTitle  = productObj.title;
  const productSlug   = productObj.slug || productObj._id || '';      // اولویت با اسلاگ
  const productLink   = productSlug ? `/product/${productSlug}` : '#';

  const lastMsg  = chat.messages?.slice(-1)[0];
  const lastText = lastMsg ? (lastMsg.text || '').slice(0, 40) : '';
  const customerName = (() => {
    const u = (chat.participants || []).find(p => p.role === 'user' || p.role === 'customer');
    return ((u?.firstname || '') + ' ' + (u?.lastname || '')).trim() || 'ناشناس';
  })();
  const customerId = (chat.participants || []).find(p => p.role === 'user' || p.role === 'customer')?._id || '';

  const lastRole =
    lastMsg?.from ||
    lastMsg?.sender?.role ||
    lastMsg?.senderId?.role;
  const title = lastRole === 'admin'
    ? 'مدیر سایت'
    : productTitle
    ? `مشتری — ${productTitle}`
    : 'مشتری';

  const wrapper = document.createElement('div');
  wrapper.className = 'chat-item cursor-pointer bg-white border rounded-xl p-4 flex justify-between items-center';
  wrapper.dataset.chatId = chat._id;

  /* === بخش تصویر و عنوان محصول با لینک قابل‌کلیک === */
  wrapper.innerHTML = `
    <div class="flex items-center gap-3 overflow-hidden">
      ${productImg
        ? `<a href="${productLink}" target="_blank" rel="noopener" data-link>
             <img src="${productImg}" class="w-10 h-10 rounded-lg border hidden sm:block flex-shrink-0" alt="">
           </a>`
        : ''}
      <div class="flex flex-col min-w-0">
        ${productTitle
          ? `<a href="${productLink}" target="_blank" rel="noopener" data-link
                 class="font-bold text-[#10b981] truncate max-w-[160px] sm:max-w-[220px]">
               ${title}
             </a>`
          : `<span class="font-bold text-[#10b981] truncate max-w-[160px] sm:max-w-[220px]">${title}</span>`}
        <span class="text-xs text-gray-500 mt-0.5 block truncate leading-5 sm:leading-4">${lastText}</span>
      </div>
    </div>
    <div class="flex items-center gap-3 flex-shrink-0">
      <span class="hidden sm:inline text-xs text-gray-400" id="chat-time-${chat._id}">${formatAgo(chat.lastUpdated)}</span>
      <span id="badge-${chat._id}" class="inline-flex items-center justify-center h-5 min-w-[20px] text-xs font-bold rounded-full bg-red-500 text-white ${unread ? '' : 'hidden'}">
        ${fa(unread)}
      </span>
      <button title="حذف چت" class="chat-delete-btn text-red-500 text-xs sm:text-sm" data-delete="${chat._id}">حذف</button>
      <button title="مسدودسازی" class="chat-block-btn text-orange-500 text-xs sm:text-sm" data-block="${customerId}">مسدود</button>
    </div>
  `;

  /* جلوگیری از بازشدن مدال هنگام کلیک روی لینک محصول */
  wrapper.querySelectorAll('[data-link]').forEach(a =>
    a.addEventListener('click', e => e.stopPropagation())
  );

  /* باز کردن مدال گفتگو */
  wrapper.addEventListener('click', async () => {
    try {
      const res = await fetch(apiUrl(`/api/chats/${chat._id}`), withCreds());
      if (res.ok) {
        const fresh = await res.json();
        chat = fresh;
        const idx = chatsData.findIndex(c => c._id === chat._id);
        if (idx !== -1) chatsData[idx] = chat;
      }
    } catch {}
    renderChatModal(chat);
    currentChatId = chat._id;
    const badge = document.getElementById(`badge-${chat._id}`);
    if (badge) badge.classList.add('hidden');
    if (typeof window.updateBadge === 'function') {
      const totalUnread = chatsData.reduce(
        (s, c) => s + (c.messages || []).filter(m => m.from !== 'seller' && !m.readBySeller).length,
        0
      );
      window.updateBadge(totalUnread);
    }
  });

  /* حذف چت */
  wrapper.querySelector('[data-delete]').addEventListener('click', async e => {
    e.stopPropagation();
    if (!confirm('آیا از حذف این چت مطمئن هستید؟')) return;
    try {
      await fetch(apiUrl(`/api/chats/${chat._id}`), withCreds({
        method: 'DELETE'
      }));
      if (currentChatId === chat._id) {
        chatModalBg.classList.add('hidden');
        document.body.style.overflow = '';
        currentChatId = null;
      }
      fetchChats();
    } catch {
      alert('❌ خطا در حذف چت');
    }
  });

  /* مسدودسازی کاربر */
  wrapper.querySelector('[data-block]').addEventListener('click', e => {
    e.stopPropagation();
    blockUserId = customerId;
    blockModalBg.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  return wrapper;
}



/***********************************************
 * ۶) رندر مدال گفتگو کامل (بدون تغییر)
 ***********************************************/
function renderChatModal(chat) {
  const productTitle = chat.productId?.title || '';
  const isAdminChat = (chat.participants || []).some(p => p.role === 'admin');
  chatModalTitle.textContent = isAdminChat
    ? 'گفتگو با مدیر سایت'
    : productTitle
    ? productTitle
    : 'گفتگو با مشتری';
  const customerName = (() => {
    const u = (chat.participants || []).find(p => p.role === 'user' || p.role === 'customer');
    return ((u?.firstname || '') + ' ' + (u?.lastname || '')).trim() || 'ناشناس';
  })();
  chatModalSub.textContent = customerName;

  if (chat.productId?.images?.[0]) {
    chatModalAvatar.src = chat.productId.images[0];
    chatModalAvatar.classList.remove('hidden');
  } else {
    chatModalAvatar.classList.add('hidden');
  }

  chatModalMsgsBox.innerHTML = '';
  const msgs = (chat.messages || []).slice().sort((a, b) => {
    const ta = new Date(a.createdAt || a.date || a.timestamp).getTime();
    const tb = new Date(b.createdAt || b.date || b.timestamp).getTime();
    return ta - tb;
  });
  msgs.forEach(m => {
    const bubble = document.createElement('div');

    const role = m.from || m.sender?.role || m.senderId?.role;
    const fromSeller = role === 'seller';
    const fromAdmin  = role === 'admin';

    const clsAlign   = fromSeller ? 'self-end' : 'self-start';
    const clsRole    = fromAdmin ? 'msg-admin' : fromSeller ? 'msg-seller' : 'msg-customer';
    let senderName;
    if (fromSeller)       senderName = 'شما';
    else if (fromAdmin)   senderName = 'مدیر سایت';
    else if (role === 'user')    senderName = 'مشتری';
    else if (role === 'seller')  senderName = 'فروشنده';
    else if (role === 'admin')   senderName = 'مدیر سایت';
    else                        senderName = 'ناشناس';

    const timeISO    = m.createdAt || m.created_at || m.date || m.updatedAt || m.timestamp;

    bubble.className = `msg-bubble ${clsRole} ${clsAlign} px-4 py-2 rounded-2xl text-sm leading-relaxed`;
    bubble.innerHTML = `
      <div class="font-semibold text-xs mb-1">${senderName}</div>
      <div>${m.text}</div>
      <div class="text-[10px] text-gray-400 mt-1 text-left">${formatDateTime(timeISO)}</div>
    `;
    chatModalMsgsBox.appendChild(bubble);
  });

  setTimeout(() => (chatModalMsgsBox.scrollTop = chatModalMsgsBox.scrollHeight), 0);
  chatReplyForm.dataset.chatId = chat._id;
  chatModalBg.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}



/****************************************************************
 * ۷) بخش ارسال تبلیغ – بدون تغییر
 ****************************************************************/
const adModalBg = document.getElementById('adModalBg');
document.getElementById('closeAdModal').onclick = () => {
  adModalBg.classList.add('hidden');
  document.getElementById('adForm').reset();
  updateCharCount();
  document.getElementById('adSuccess').classList.add('hidden');
  updateAdCost();
};

const adText = document.getElementById('adText');
adText.addEventListener('input', updateCharCount);
function updateCharCount() {
  const max = document.querySelector('input[name=adType]:checked').value === 'sms' ? 70 : 1000;
  if (adText.value.length > max) adText.value = adText.value.slice(0, max);
  document.getElementById('charCount').innerText = fa(adText.value.length) + '/' + fa(max);
}
document.querySelectorAll('input[name=adType]').forEach(el =>
  el.addEventListener('change', () => {
    adText.maxLength = el.value === 'sms' ? 70 : 1000;
    updateCharCount();
    updateAdCost();
  })
);
document.querySelector('input[name=adCount]').addEventListener('input', updateAdCost);
function updateAdCost() {
  const type  = document.querySelector('input[name=adType]:checked').value;
  const count = +document.querySelector('input[name=adCount]').value || 0;
  const price = type === 'sms' ? 300 : 100;
  document.getElementById('adCostBox').innerText = fa(count * price) + ' تومان';
}
updateAdCost();

document.getElementById('adForm').onsubmit = e => {
  e.preventDefault();
  const btn = document.getElementById('adSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<svg class="animate-spin" width="20" height="20"><circle cx="10" cy="10" r="8" stroke="#fff" stroke-width="3" fill="none"/></svg> در حال ارسال...';
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = 'ارسال تبلیغ';
  }, 1000);
};



/****************************************************************
 * ۸) مدال «ارتباط با مدیر» – بدون تغییر
 ****************************************************************/
const openContactBtn  = document.getElementById('openContactAdmin');
const closeContactBtn = document.getElementById('closeContactModal');
const contactModalBg  = document.getElementById('contactModalBg');
const contactForm     = document.getElementById('contactForm');
const textarea        = document.getElementById('contactText');
const successBox      = document.getElementById('contactSuccess');

const blockModalBg    = document.getElementById('blockModalBg');
const closeBlockModal = document.getElementById('closeBlockModal');
const confirmBlockBtn = document.getElementById('confirmBlockBtn');
const cancelBlockBtn  = document.getElementById('cancelBlockBtn');
const blockReason     = document.getElementById('blockReason');
const blockSuccess    = document.getElementById('blockSuccess');
let blockUserId = null;

openContactBtn.addEventListener('click', () => {
  contactModalBg.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
});
closeContactBtn.addEventListener('click', () => {
  contactModalBg.classList.add('hidden');
  document.body.style.overflow = '';
  successBox.classList.add('hidden');
});

contactForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = textarea.value.trim();
  if (!text) return textarea.focus();

  const btn = contactForm.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.innerText = 'در حال ارسال…';

  try {
    const res = await fetch(apiUrl('/api/chats/contact-admin'), withCreds({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || 'خطا در ارسال پیام');
    }
    successBox.classList.remove('hidden');
    textarea.value = '';
    setTimeout(() => {
      contactModalBg.classList.add('hidden');
      document.body.style.overflow = '';
      successBox.classList.add('hidden');
    }, 2000);
  } catch (err) {
    alert('❌ ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'ارسال پیام';
  }
});

closeBlockModal.addEventListener('click', closeBlock);
cancelBlockBtn.addEventListener('click', closeBlock);

function closeBlock() {
  blockModalBg.classList.add('hidden');
  document.body.style.overflow = '';
  blockReason.value = '';
  blockUserId = null;
}

function showBlockSuccess() {
  if (!blockSuccess) return;
  blockSuccess.classList.add('show');
  blockSuccess.style.opacity = '1';
  setTimeout(() => {
    blockSuccess.style.opacity = '0';
    setTimeout(() => blockSuccess.classList.remove('show'), 300);
  }, 3000);
}

confirmBlockBtn.addEventListener('click', async () => {
  const reason = blockReason.value.trim();
  if (!blockUserId) return;
  confirmBlockBtn.disabled = true;
  try {
    const res = await fetch(apiUrl(`/api/user/block/${blockUserId}`), withCreds({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    }));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'خطا در مسدودسازی');
    }
    closeBlock();
    fetchChats();
    showBlockSuccess();
  } catch (err) {
    alert('❌ ' + err.message);
  } finally {
    confirmBlockBtn.disabled = false;
  }
});
