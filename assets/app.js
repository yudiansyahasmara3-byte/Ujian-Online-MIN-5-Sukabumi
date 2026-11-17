async function api(action, data = {}) {
  const token = sessionStorage.getItem('tok');
  // body string tanpa header = text/plain, menghindari preflight CORS pada Apps Script
  const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, token, ...data }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j;
}
// Dipanggil di halaman terproteksi; peran: 'siswa' atau ['guru','admin']
async function guard(peran) {
  try {
    const { user } = await api('me');
    if ([].concat(peran).indexOf(user.peran) < 0) throw 0;
    return user;
  } catch (e) { sessionStorage.clear(); location.href = '../index.html'; }
}
async function keluar() { try { await api('logout'); } catch (e) {} sessionStorage.clear(); location.href = '../index.html'; }
