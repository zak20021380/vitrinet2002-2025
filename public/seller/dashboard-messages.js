// dashboard-messages.js



/*************************************************
 * ۱) Polling پیام‌ها برای به‌روزرسانی آنی لیست چت
 *************************************************/
let chatsInterval = null;           // شناسه setInterval
let currentChatId = null;           // اگر مدال باز است، آی‌دی چت فعال
let chatsBox      = null;           // بعداً در DOMContentLoaded مقدار می‌گیرد
let firstLoad     = true;           // فقط بار اول لودینگ را نشان بده
let chatsData     = [];             // ذخیره لیست چت‌ها برای محاسبه بج
let unreadSnapshot = {};            // آخرین تعداد پیام‌ خوانده‌نشده هر چت برای تشخیص پیام جدید
let toastTimer     = null;          // برای مدیریت خودکار بسته شدن نوتیفیکیشن

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
  if (chatsBox) {
    chatsBox.addEventListener('click', e => {
      const deleteBtn = e.target.closest('[data-delete]');
      const blockBtn = e.target.closest('[data-block]');
      if (deleteBtn || blockBtn) return;
      const item = e.target.closest('.chat-item[data-chat-id]');
      if (!item) return;
      openChatById(item.dataset.chatId);
    });
  }
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

// تمام شناسه‌های ممکن فروشنده را جمع‌آوری می‌کنیم تا بتوانیم نقش پیام را با اطمینان تشخیص دهیم
const sellerIds = new Set(
  [
    window.seller?.id,
    window.seller?._id,
    window.seller?.sellerId,
    window.seller?.seller_id,
    window.__SELLER_ID__
  ]
    .filter(Boolean)
    .map(String)
);

function hideChatModal() {
  chatModalBg.classList.add('hidden');
  document.body.style.overflow = '';
  document.body.classList.remove('chat-modal-open');
  currentChatId = null;
  chatModalMsgsBox.innerHTML = '';
  chatReplyInput.value = '';
  
  // Show notification FAB when chat modal closes
  const notificationFab = document.querySelector('.notification-fab');
  if (notificationFab) {
    notificationFab.style.opacity = '';
    notificationFab.style.pointerEvents = '';
    notificationFab.style.transform = '';
  }
}

closeChatModal.addEventListener('click', hideChatModal);

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

function getCustomerName(chat) {
  const user = (chat.participants || []).find(p => p.role === 'user' || p.role === 'customer');
  return ((user?.firstname || '') + ' ' + (user?.lastname || '')).trim() || 'مشتری';
}

function countUnreadMessages(chat) {
  return (chat.messages || []).filter(m => m.from !== 'seller' && !m.readBySeller).length;
}

function normalizeRole(value) {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

function extractSenderId(message) {
  return (
    message.senderId?._id ||
    message.senderId?.id ||
    message.senderId ||
    message.sender?._id ||
    message.sender?.id ||
    message.fromId ||
    message.from?._id ||
    message.from?.id ||
    ''
  );
}

function resolveMessageRole(message, chat, customerName) {
  const participants = Array.isArray(chat?.participants) ? chat.participants : [];

  const participantRoleById = new Map();
  const participantSellerIds = [];
  participants.forEach(p => {
    const pid = p?._id || p.id || p.userId || p.sellerId;
    if (!pid) return;
    const normalized = normalizeRole(p.role);
    participantRoleById.set(String(pid), normalized);
    if (normalized === 'seller') {
      participantSellerIds.push(String(pid));
    }
  });

  participantSellerIds.forEach(id => sellerIds.add(id));

  const senderId = String(extractSenderId(message) || '');
  const roleCandidates = [
    message.from,
    message.sender?.role,
    message.senderRole,
    message.senderId?.role,
    participantRoleById.get(senderId)
  ];

  let normalizedRole = roleCandidates.map(normalizeRole).find(r => !!r) || '';

  // اگر نقش «فروشنده» ارسال شده ولی شناسه فرستنده متعلق به فروشنده نیست، نقش را بر اساس شرکت‌کنندگان تصحیح کن
  if (
    normalizedRole === 'seller' &&
    senderId &&
    participantRoleById.has(senderId) &&
    participantRoleById.get(senderId) !== 'seller'
  ) {
    normalizedRole = participantRoleById.get(senderId) || '';
  }

  const fromAdmin = normalizedRole === 'admin' || normalizedRole === 'support';
  const fromSeller = normalizedRole === 'seller' || (senderId && sellerIds.has(senderId));
  const fromUser =
    normalizedRole === 'user' ||
    normalizedRole === 'customer' ||
    normalizedRole === 'buyer' ||
    (!fromAdmin && !fromSeller);

  let senderName;
  if (fromSeller) {
    senderName = 'شما';
  } else if (fromAdmin) {
    senderName = 'مدیر سایت';
  } else if (fromUser) {
    senderName = customerName || 'مشتری';
  }

  const roleClass = fromAdmin ? 'msg-admin' : fromSeller ? 'msg-seller' : 'msg-customer';
  const alignClass = fromSeller ? 'self-end' : 'self-start';

  return {
    senderName: senderName || customerName || 'مشتری',
    roleClass,
    alignClass
  };
}

function showNewMessageToast(title, desc, isAdmin = false) {
  const toast = document.getElementById('newMessageToast');
  const toastTitle = document.getElementById('toastTitle');
  const toastDesc = document.getElementById('toastDesc');
  const toastTime = document.getElementById('toastTime');
  const toastIcon = document.getElementById('toastIcon');
  const toastProgress = document.getElementById('toastProgress');
  const toastClose = document.getElementById('toastClose');
  
  if (!toast || !toastTitle || !toastDesc) return;

  // تنظیم محتوا
  toastTitle.textContent = title;
  toastDesc.textContent = desc;
  if (toastTime) {
    toastTime.textContent = 'همین الان';
  }
  
  // تنظیم استایل بر اساس نوع پیام (مشتری یا ادمین)
  toast.classList.remove('toast--admin');
  if (isAdmin) {
    toast.classList.add('toast--admin');
    if (toastIcon) {
      toastIcon.innerHTML = `
        <svg fill="none" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
      `;
    }
  } else {
    if (toastIcon) {
      toastIcon.innerHTML = `
        <svg fill="none" viewBox="0 0 24 24" stroke="#10b981" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
      `;
    }
  }
  
  // ریست انیمیشن progress bar
  if (toastProgress) {
    toastProgress.style.animation = 'none';
    toastProgress.offsetHeight; // force reflow
    toastProgress.style.animation = 'toastProgress 4s linear forwards';
  }
  
  // نمایش toast
  toast.classList.add('show');
  
  // پخش صدای نوتیفیکیشن (اختیاری)
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  } catch (e) {}

  // تایمر برای بستن خودکار
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
  
  // دکمه بستن
  if (toastClose) {
    toastClose.onclick = () => {
      toast.classList.remove('show');
      if (toastTimer) clearTimeout(toastTimer);
    };
  }
}



/***********************************************
 * ۴) واکشی و رندر لیست چت‌ها
 ***********************************************/
function detectNewMessages(chats) {
  const highlightIds = new Set();
  const notifications = [];

  chats.forEach(chat => {
    const unread = countUnreadMessages(chat);
    const previous = unreadSnapshot[chat._id] ?? 0;
    if (unread > previous) {
      highlightIds.add(chat._id);
      const unreadMessages = (chat.messages || []).filter(m => m.from !== 'seller' && !m.readBySeller);
      const latestUnread = unreadMessages[unreadMessages.length - 1];
      const fromAdmin = latestUnread?.from === 'admin' || latestUnread?.sender?.role === 'admin';
      const title = fromAdmin ? 'پیام جدید از مدیر سایت' : 'پیام جدید از مشتری';
      const subtitle = fromAdmin
        ? 'پاسخ جدید مدیریت دریافت شد.'
        : `${getCustomerName(chat)}${chat.productId?.title ? ` • ${chat.productId.title}` : ''}`;
      notifications.push({ title, subtitle, isAdmin: fromAdmin });
    }
    unreadSnapshot[chat._id] = unread;
  });

  return { highlightIds, notifications };
}

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

    const detection = detectNewMessages(chats);
    const highlightIds = firstLoad ? new Set() : detection.highlightIds;
    const notifications = firstLoad ? [] : detection.notifications;

    chatsData = chats;
    if (typeof window.updateBadge === 'function') {
      const totalUnread = chatsData.reduce(
        (s, c) => s + countUnreadMessages(c),
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
    chats.forEach(chat => frag.appendChild(renderChatListItem(chat, highlightIds.has(chat._id))));
    chatsBox.replaceChildren(frag);
    removeErrorBar();
    firstLoad = false;

    notifications.forEach(n => showNewMessageToast(n.title, n.subtitle, n.isAdmin));

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
async function openChatById(chatId) {
  if (!chatId) return;
  let chat = chatsData.find(c => c._id === chatId);
  
  try {
    // ۱) واکشی چت (این درخواست پیام‌ها را به عنوان خوانده شده علامت‌گذاری می‌کند)
    const res = await fetch(apiUrl(`/api/chats/${chatId}`), withCreds());
    if (res.ok) {
      const fresh = await res.json();
      chat = fresh;
      const idx = chatsData.findIndex(c => c._id === chatId);
      if (idx !== -1) chatsData[idx] = chat;
    }
  } catch (err) {
    console.error('openChatById fetch:', err);
  }
  
  if (!chat) return;

  // ۲) نمایش مدال چت
  renderChatModal(chat);
  currentChatId = chat._id;
  
  // ۳) علامت‌گذاری پیام‌ها به عنوان خوانده شده در سرور
  try {
    await fetch(apiUrl(`/api/chats/${chatId}/mark-read-seller`), withCreds({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (err) {
    console.error('mark-read-seller error:', err);
  }
  
  // ۴) آپدیت unreadSnapshot برای این چت (صفر کردن چون همه پیام‌ها خوانده شدند)
  unreadSnapshot[chatId] = 0;
  
  // ۵) مخفی کردن badge این چت
  const badge = document.getElementById(`badge-${chatId}`);
  if (badge) badge.classList.add('hidden');
  
  // ۶) آپدیت chatsData برای این چت (علامت‌گذاری همه پیام‌ها به عنوان خوانده شده)
  const chatIdx = chatsData.findIndex(c => c._id === chatId);
  if (chatIdx !== -1 && chatsData[chatIdx].messages) {
    chatsData[chatIdx].messages = chatsData[chatIdx].messages.map(m => ({
      ...m,
      readBySeller: m.from === 'seller' ? m.readBySeller : true
    }));
  }
  
  // ۷) آپدیت شمارنده کلی پیام‌های خوانده نشده
  if (typeof window.updateBadge === 'function') {
    const totalUnread = chatsData.reduce(
      (s, c) => s + countUnreadMessages(c),
      0
    );
    window.updateBadge(totalUnread);
  }

  // ۸) تازه‌سازی لیست چت‌ها برای اطمینان از همگام‌سازی با سرور
  try {
    await fetchChats();
  } catch (err) {
    console.error('refresh after openChatById:', err);
  }
}

function renderChatListItem(chat, highlightNew = false) {
  const unread        = countUnreadMessages(chat);
  const productObj    = chat.productId || {};
  const productImg    = productObj.images?.[0] || '';
  const productTitle  = productObj.title || '';
  const productPrice  = productObj.price;
  const productDesc   = productObj.desc || productObj.description || '';
  const productCategory = productObj.category || '';
  const productTag    = productObj.tag || productObj.tags?.[0] || '';
  const productId     = productObj._id || '';
  const productLink   = productId ? `/product.html?id=${productId}` : '';

  const lastMsg  = chat.messages?.slice(-1)[0];
  const lastText = lastMsg ? (lastMsg.text || '').slice(0, 40) : '';
  const customerName = getCustomerName(chat) || 'ناشناس';
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
  wrapper.className = `chat-item cursor-pointer bg-white border rounded-xl p-4 flex justify-between items-center${highlightNew ? ' chat-item--new' : ''}`;
  wrapper.dataset.chatId = chat._id;

  /* === بخش تصویر و عنوان محصول + دکمه مشاهده محصول در سمت راست === */
  wrapper.innerHTML = `
    <div class="flex items-center gap-3 overflow-hidden flex-1">
      ${productImg
        ? `<img src="${productImg}" class="w-10 h-10 rounded-lg border hidden sm:block flex-shrink-0 object-cover" alt="">`
        : ''}
      <div class="flex flex-col min-w-0">
        <span class="font-bold text-[#10b981] truncate max-w-[140px] sm:max-w-[200px]">${title}</span>
        <span class="text-xs text-gray-500 mt-0.5 block truncate leading-5 sm:leading-4">${customerName}</span>
      </div>
    </div>
    <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
      ${productId
        ? `<button type="button" data-product-preview
               class="product-view-link inline-flex items-center gap-1 text-[10px] sm:text-[11px] text-[#0ea5e9] hover:text-[#0284c7] font-semibold transition-all"
               data-product-img="${productImg}"
               data-product-title="${productTitle}"
               data-product-price="${productPrice || ''}"
               data-product-desc="${productDesc.replace(/"/g, '&quot;')}"
               data-product-category="${productCategory}"
               data-product-tag="${productTag}"
               data-product-link="${productLink}">
             <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
               <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
               <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
             </svg>
             <span class="hidden sm:inline">مشاهده محصول</span>
           </button>`
        : ''}
      <span class="hidden sm:inline text-xs text-gray-400" id="chat-time-${chat._id}">${formatAgo(chat.lastUpdated)}</span>
      <span id="badge-${chat._id}" class="inline-flex items-center justify-center h-5 min-w-[20px] text-xs font-bold rounded-full bg-red-500 text-white ${unread ? '' : 'hidden'} ${highlightNew && unread ? 'badge-pulse' : ''}">
        ${fa(unread)}
      </span>
      <button title="حذف چت" class="chat-delete-btn text-red-500 text-xs sm:text-sm" data-delete="${chat._id}">حذف</button>
      <button title="مسدودسازی" class="chat-block-btn text-orange-500 text-xs sm:text-sm" data-block="${customerId}">مسدود</button>
    </div>
  `;

  /* باز کردن مدال پیش‌نمایش محصول */
  const previewBtn = wrapper.querySelector('[data-product-preview]');
  if (previewBtn) {
    previewBtn.addEventListener('click', e => {
      e.stopPropagation();
      openProductPreviewModal({
        img: previewBtn.dataset.productImg,
        title: previewBtn.dataset.productTitle,
        price: previewBtn.dataset.productPrice,
        desc: previewBtn.dataset.productDesc,
        category: previewBtn.dataset.productCategory,
        tag: previewBtn.dataset.productTag,
        link: previewBtn.dataset.productLink
      });
    });
  }

  /* باز کردن مدال گفتگو */
  wrapper.addEventListener('click', () => openChatById(chat._id));

  /* حذف چت */
  wrapper.querySelector('[data-delete]').addEventListener('click', async e => {
    e.stopPropagation();
    if (!confirm('آیا از حذف این چت مطمئن هستید؟')) return;
    try {
      await fetch(apiUrl(`/api/chats/${chat._id}`), withCreds({
        method: 'DELETE'
      }));
      if (currentChatId === chat._id) {
        hideChatModal();
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
 * مدال پیش‌نمایش محصول
 ***********************************************/
const productPreviewModalBg = document.getElementById('productPreviewModalBg');
const closeProductPreviewModal = document.getElementById('closeProductPreviewModal');
const closeProductPreviewBtn = document.getElementById('closeProductPreviewBtn');

function openProductPreviewModal(product) {
  if (!productPreviewModalBg) return;
  
  const imgEl = document.getElementById('productPreviewImage');
  const titleEl = document.getElementById('productPreviewTitle');
  const priceEl = document.getElementById('productPreviewPrice');
  const descEl = document.getElementById('productPreviewDesc');
  const categoryEl = document.getElementById('productPreviewCategory');
  const tagEl = document.getElementById('productPreviewTag');
  const linkEl = document.getElementById('productPreviewLink');
  
  if (imgEl) {
    imgEl.src = product.img || '/assets/images/placeholder.png';
    imgEl.alt = product.title || 'تصویر محصول';
  }
  if (titleEl) titleEl.textContent = product.title || 'بدون عنوان';
  if (priceEl) {
    const price = product.price ? Number(product.price).toLocaleString('fa-IR') : '-';
    priceEl.textContent = price;
  }
  if (descEl) descEl.textContent = product.desc || 'توضیحاتی برای این محصول ثبت نشده است.';
  if (categoryEl) categoryEl.textContent = product.category || 'نامشخص';
  if (tagEl) tagEl.textContent = product.tag || 'بدون برچسب';
  if (linkEl) linkEl.href = product.link || '#';
  
  productPreviewModalBg.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('product-modal-open');
}

function hideProductPreviewModal() {
  if (!productPreviewModalBg) return;
  productPreviewModalBg.classList.add('hidden');
  document.body.style.overflow = '';
  document.body.classList.remove('product-modal-open');
}

if (closeProductPreviewModal) {
  closeProductPreviewModal.addEventListener('click', hideProductPreviewModal);
}
if (closeProductPreviewBtn) {
  closeProductPreviewBtn.addEventListener('click', hideProductPreviewModal);
}
if (productPreviewModalBg) {
  productPreviewModalBg.addEventListener('click', e => {
    if (e.target === productPreviewModalBg) hideProductPreviewModal();
  });
}



/***********************************************
 * ۶) رندر مدال گفتگو کامل (بدون تغییر)
 ***********************************************/
function renderChatModal(chat) {
  const productTitle = chat.productId?.title || '';
  const hasAdminParticipant = (chat.participants || []).some(p => p.role === 'admin');
  const hasAdminMessage = (chat.messages || []).some(m => {
    const role = m.from || m.sender?.role || m.senderId?.role;
    return role === 'admin';
  });
  const isAdminChat = hasAdminParticipant || hasAdminMessage;
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

    const { senderName, roleClass, alignClass } = resolveMessageRole(m, chat, customerName);

    const timeISO = m.createdAt || m.created_at || m.date || m.updatedAt || m.timestamp;

    bubble.className = `msg-bubble ${roleClass} ${alignClass} px-4 py-2 rounded-2xl text-sm leading-relaxed`;
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
  document.body.classList.add('chat-modal-open');
  
  // Hide notification FAB when chat modal opens
  const notificationFab = document.querySelector('.notification-fab');
  if (notificationFab) {
    notificationFab.style.opacity = '0';
    notificationFab.style.pointerEvents = 'none';
    notificationFab.style.transform = 'translateY(20px)';
  }
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
