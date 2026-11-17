const $ = id => document.getElementById(id);
const fm = ms => new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
async function muat() {
  const d = (await api('ujianSiswa')).data, box = $('daftar'); box.innerHTML = '';
  if (!d.length) { box.textContent = 'Belum ada ujian untuk kelas Anda.'; return; }
  d.forEach(u => {
    const c = document.createElement('div'); c.className = 'kartu';
    const h = document.createElement('h2'); h.textContent = u.judul;
    const m = document.createElement('p'); m.textContent = [u.mapel, u.durasi + ' menit', u.mulai ? 'Mulai ' + fm(u.mulai) : '', u.selesai ? 'Sampai ' + fm(u.selesai) : ''].filter(Boolean).join(' | ');
    c.append(h, m);
    if (u.state === 'selesai') { const p = document.createElement('p'); p.className = 'ok'; p.textContent = 'Sudah dikerjakan.'; c.append(p); }
    else if (!u.dibuka && u.state === 'belum') { const p = document.createElement('p'); p.textContent = 'Belum dibuka atau waktunya sudah lewat.'; c.append(p); }
    else {
      const t = document.createElement('input'); t.placeholder = 'Token dari guru'; t.autocomplete = 'off'; t.setAttribute('aria-label', 'Token');
      const b = document.createElement('button'); b.className = 'go'; b.textContent = u.state === 'berjalan' ? 'Lanjutkan ujian' : 'Masuk ujian';
      if (u.state !== 'berjalan') c.append(t);
      b.onclick = () => {
        if (u.state !== 'berjalan' && !t.value.trim()) { $('err').textContent = 'Isi token terlebih dahulu.'; return; }
        sessionStorage.setItem('uj', u.id); sessionStorage.setItem('ujt', t.value); sessionStorage.setItem('ujn', u.judul);
        location.href = 'ujian.html';
      };
      c.append(b);
    }
    box.append(c);
  });
}
guard('siswa').then(u => { if (!u) return; $('salam').textContent = 'Halo, ' + u.nama + ' (' + u.kelas + ')'; window.U = u; muat().catch(x => $('err').textContent = x.message); });
