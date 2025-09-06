(function(){
  async function checkStatus(){
    const raw = localStorage.getItem('vt:lastBooking');
    if(!raw) return false;
    let b; try { b = JSON.parse(raw); } catch{ return false; }
    if(!b) return false;

    const show = (st)=>{
      const msg = st === 'confirmed' ? 'رزرو شما تایید شد 🎉' : 'رزرو شما رد شد ❌';
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
      const box = document.createElement('div');
      box.className = 'bg-white rounded-lg p-6 max-w-sm w-11/12 text-center shadow-lg';
      box.innerHTML = `<p class="text-lg mb-4">${msg}</p><button class="mt-2 px-4 py-2 bg-blue-600 text-white rounded">بستن</button>`;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      box.querySelector('button').addEventListener('click',()=>overlay.remove());
    };

    if(b.status && b.status !== 'pending'){
      show(b.status);
      localStorage.removeItem('vt:lastBooking');
      return true;
    }

    const base = window.__API_BASE__ || '';
    try{
      const res = await fetch(`${base}/api/bookings/status?phone=${encodeURIComponent(b.phone||'')}`);
      if(res.ok){
        const data = await res.json();
        if(data.status && data.status !== 'pending'){
          show(data.status);
          localStorage.setItem('vt:lastBooking', JSON.stringify({...b, status:data.status}));
          return true;
        }
      }
    }catch(err){
      console.warn('booking status check failed', err);
    }
    return false;
  }

  function start(){
    const run = async()=>{ if(await checkStatus()) clearInterval(id); };
    run();
    const id = setInterval(run,15000);
  }
  document.addEventListener('DOMContentLoaded', start);
})();
