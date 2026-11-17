const $ = id => document.getElementById(id);
const ID = sessionStorage.getItem('uj');
let U, S = { soal: [], a: {}, dirty: {}, i: 0, p: 0, maks: 3, run: false, end: 0, acak: false }, lastV = 0;
$('jd').textContent = sessionStorage.getItem('ujn') || 'Ruang Ujian';
if (!ID) location.href = 'index.html';

/* acak konsisten per siswa (urutan pilihan tetap sama saat lanjut) */
function seed(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = Math.imul(h ^ h >>> 15, 1 | h); t ^= t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function urut(arr, key) {
  const a = arr.map((v, i) => [v, i]); if (!S.acak) return a;
  const r = seed(key); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}
const terisi = v => v !== undefined && v !== '' && !(Array.isArray(v) && !v.some(x => x !== '' && x !== undefined));

/* ---------- Mulai ---------- */
$('mulai').onclick = async () => {
  const b = $('mulai'); $('err').textContent = '';
  if (!document.documentElement.requestFullscreen) { $('err').textContent = 'Browser ini tidak mendukung layar penuh. Gunakan Chrome di laptop atau tablet Android.'; return; }
  b.disabled = true;
  try {
    await document.documentElement.requestFullscreen();
    const r = await api('mulaiUjian', { ujian: ID, token: sessionStorage.getItem('ujt') || '' });
    if (r.selesai) { await keluarFs(); $('awal').innerHTML = '<h1>Ujian sudah selesai</h1><p>Anda sudah menyelesaikan ujian ini.</p><p><a href="index.html">Kembali ke daftar ujian</a></p>'; return; }
    Object.assign(S, { soal: r.soal, a: r.a || {}, p: r.p, maks: r.maks, acak: r.acak, i: 0 });
    window.U = (await api('me')).user; U = window.U;
    $('hj').textContent = r.judul; sinkron(r.sisaMs); S.run = true;
    $('awal').hidden = true; $('ruang').hidden = false; bangunNav(); tampil(); pelTampil();
    setInterval(tik, 500); setInterval(simpan, 15000);
  } catch (x) { $('err').textContent = x.message; b.disabled = false; await keluarFs(); }
};
const keluarFs = async () => { if (document.fullscreenElement) try { await document.exitFullscreen(); } catch (e) {} };

/* ---------- Tampilan soal ---------- */
function set(id, v) { S.a[id] = v; S.dirty[id] = 1; bangunNav(); clearTimeout(S.t); S.t = setTimeout(simpan, 2500); }
function bangunNav() {
  const n = $('nav'); n.innerHTML = '';
  S.soal.forEach((s, i) => { const b = document.createElement('button'); b.textContent = i + 1; b.className = (terisi(S.a[s.id]) ? 'sudah ' : '') + (i === S.i ? 'kini' : ''); b.onclick = () => { S.i = i; tampil(); bangunNav(); }; n.append(b); });
}
function tampil() {
  const s = S.soal[S.i], box = $('jwb'); box.innerHTML = '';
  $('no').textContent = `Soal ${S.i + 1} dari ${S.soal.length}`; $('tks').textContent = s.teks;
  $('img').hidden = !s.gambar; if (s.gambar) $('img').src = s.gambar;
  $('sblm').disabled = S.i === 0; $('sbrk').disabled = S.i === S.soal.length - 1;
  if (s.tipe === 'pg' || s.tipe === 'pgk') {
    urut(s.opsi, U.id + s.id).forEach(([v, idx], n) => {
      const l = document.createElement('label'); l.className = 'pil'; const inp = document.createElement('input');
      inp.type = s.tipe === 'pg' ? 'radio' : 'checkbox'; inp.name = 'p';
      inp.checked = s.tipe === 'pg' ? S.a[s.id] === idx : (S.a[s.id] || []).includes(idx);
      inp.onchange = () => { if (s.tipe === 'pg') set(s.id, idx); else { const c = new Set(S.a[s.id] || []); inp.checked ? c.add(idx) : c.delete(idx); set(s.id, [...c].sort()); } };
      l.append(inp, document.createTextNode(String.fromCharCode(65 + n) + '. ' + v)); box.append(l);
    });
  } else if (s.tipe === 'bs') {
    [['B', 'Benar'], ['S', 'Salah']].forEach(([k, t]) => {
      const l = document.createElement('label'); l.className = 'pil'; const inp = document.createElement('input');
      inp.type = 'radio'; inp.name = 'bs'; inp.checked = S.a[s.id] === k; inp.onchange = () => set(s.id, k);
      l.append(inp, document.createTextNode(t)); box.append(l);
    });
  } else if (s.tipe === 'jodoh') {
    const kanan = urut(s.opsi.r, U.id + s.id).map(x => x[0]);
    s.opsi.k.forEach((k, i) => {
      const d = document.createElement('div'); d.className = 'jd'; const sp = document.createElement('span'); sp.textContent = k;
      const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Pasangan untuk ' + k);
      sel.append(new Option('Pilih pasangan', ''), ...kanan.map(v => new Option(v, v)));
      sel.value = (S.a[s.id] || [])[i] || '';
      sel.onchange = () => { const c = (S.a[s.id] || s.opsi.k.map(() => '')).slice(); c[i] = sel.value; set(s.id, c); };
      d.append(sp, sel); box.append(d);
    });
  } else {
    const el = s.tipe === 'isian' ? document.createElement('input') : document.createElement('textarea');
    if (s.tipe === 'isian') { el.type = 'text'; el.autocomplete = 'off'; } else el.placeholder = 'Tulis jawaban Anda di sini';
    el.setAttribute('aria-label', 'Jawaban'); el.value = S.a[s.id] || ''; el.oninput = () => set(s.id, el.value); box.append(el);
  }
}
$('sblm').onclick = () => { S.i--; tampil(); bangunNav(); };
$('sbrk').onclick = () => { S.i++; tampil(); bangunNav(); };

/* ---------- Simpan & waktu ---------- */
function sinkron(ms) { S.end = performance.now() + ms; }
function tik() {
  if (!S.run) return;
  const d = Math.max(0, S.end - performance.now()), m = Math.floor(d / 60000), s = Math.floor(d % 60000 / 1000);
  $('wkt').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); $('wkt').className = d < 300000 ? 'mepet' : '';
  if (d <= 0) kumpul();
}
async function simpan() {
  const k = Object.keys(S.dirty); if (!k.length || !S.run) return;
  const a = {}; k.forEach(x => a[x] = S.a[x]); S.dirty = {};
  try { const r = await api('simpanJawaban', { ujian: ID, a }); $('info').textContent = 'Tersimpan.'; if (r.selesai) akhir(); else sinkron(r.sisaMs); }
  catch (e) { k.forEach(x => S.dirty[x] = 1); $('info').textContent = 'Koneksi bermasalah, mencoba menyimpan lagi...'; }
}
async function kumpul() {
  if (!S.run) return; S.run = false; $('konf').hidden = true;
  const a = {}; Object.keys(S.a).forEach(x => a[x] = S.a[x]);
  for (let i = 0; i < 5; i++) { try { await api('kumpulkan', { ujian: ID, a }); break; } catch (e) { await new Promise(r => setTimeout(r, 2000)); } }
  akhir();
}
async function akhir() { S.run = false; $('blok').hidden = true; $('konf').hidden = true; $('akhir').hidden = false; sessionStorage.removeItem('ujt'); await keluarFs(); }
$('kmp').onclick = () => {
  const n = S.soal.filter(s => !terisi(S.a[s.id])).length;
  $('konfp').textContent = n ? `Masih ada ${n} soal yang belum dijawab.` : 'Semua soal sudah dijawab.'; $('konf').hidden = false;
};
$('tdk').onclick = () => $('konf').hidden = true; $('ya').onclick = kumpul;

/* ---------- Pelanggaran ---------- */
function pelTampil() { $('pel').textContent = 'Pelanggaran: ' + S.p + ' / ' + S.maks; }
function langgar(j) {
  if (!S.run || Date.now() - lastV < 2000) return; lastV = Date.now();
  $('blokp').textContent = `Pelanggaran dicatat. Batas ${S.maks}; jika tercapai, ujian dikumpulkan otomatis.`; $('blok').hidden = false;
  api('laporPelanggaran', { ujian: ID, jenis: j }).then(r => { if (r.p !== undefined) { S.p = r.p; pelTampil(); } if (r.selesai) akhir(); }).catch(() => { S.p++; pelTampil(); });
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) langgar('keluar_layar_penuh'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) langgar('pindah_tab'); });
window.addEventListener('blur', () => langgar('keluar_jendela'));
$('balik').onclick = async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); $('blok').hidden = true; } catch (e) { $('blokp').textContent = 'Gagal masuk layar penuh. Coba klik lagi.'; } };
['contextmenu', 'copy', 'cut', 'paste', 'dragstart'].forEach(e => document.addEventListener(e, ev => { if (S.run) ev.preventDefault(); }));
document.addEventListener('keydown', e => { if (S.run && (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 's', 'u'].includes(e.key.toLowerCase())))) e.preventDefault(); });
window.addEventListener('beforeunload', e => { if (S.run) { e.preventDefault(); e.returnValue = ''; } });
