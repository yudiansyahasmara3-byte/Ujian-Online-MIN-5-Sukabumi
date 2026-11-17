let U, SOAL = [], PILIH = new Set(), GAMBAR = '', EDIT = null;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMA = { pg: 'Pilihan ganda', pgk: 'PG kompleks', bs: 'Benar/Salah', jodoh: 'Menjodohkan', isian: 'Isian singkat', essay: 'Essay' };
const L = 'ABCDE';
const KOLOM = ['mapel', 'tingkat', 'tipe', 'teks', 'gambar', 'A', 'B', 'C', 'D', 'E', 'kunci', 'bobot'];

function pesan(t, baik) { const e = $('err'); e.textContent = t; e.style.color = baik ? 'var(--hijau)' : 'var(--salah)'; }
async function aksi(fn) { try { pesan(''); await fn(); } catch (x) { pesan(x.message); } }

/* ---------- Excel <-> soal ---------- */
function keRow(s) {
  const r = { mapel: s.mapel, tingkat: s.tingkat, tipe: s.tipe, teks: s.teks, gambar: s.gambar, bobot: s.bobot, kunci: '' };
  L.split('').forEach((h, i) => r[h] = '');
  if (s.tipe === 'jodoh') s.opsi.forEach((p, i) => r[L[i]] = p[0] + '=' + p[1]);
  else s.opsi.forEach((o, i) => r[L[i]] = o);
  if (s.tipe === 'pg') r.kunci = L[s.kunci];
  else if (s.tipe === 'pgk') r.kunci = s.kunci.map(i => L[i]).join(',');
  else if (s.tipe === 'isian') r.kunci = s.kunci.join('|');
  else if (s.tipe !== 'jodoh') r.kunci = s.kunci;
  return r;
}
function dariRow(r) {
  const t = String(r.tipe).trim().toLowerCase(), k = String(r.kunci).trim();
  const o = L.split('').map(h => String(r[h] ?? '').trim()).filter(Boolean);
  const s = { mapel: r.mapel, tingkat: r.tingkat, tipe: t, teks: r.teks, gambar: r.gambar, bobot: r.bobot, opsi: o, kunci: '' };
  if (t === 'pg') s.kunci = L.indexOf(k.toUpperCase());
  else if (t === 'pgk') s.kunci = k.toUpperCase().split(/[,\s]+/).filter(Boolean).map(x => L.indexOf(x)).filter(i => i >= 0);
  else if (t === 'bs') { s.opsi = []; s.kunci = k.toUpperCase().startsWith('B') ? 'B' : k ? 'S' : ''; }
  else if (t === 'jodoh') s.opsi = o.map(x => x.split('=').map(y => y.trim()));
  else if (t === 'isian') { s.opsi = []; s.kunci = k.split('|').map(x => x.trim()).filter(Boolean); }
  else if (t === 'essay') { s.opsi = []; s.kunci = k; }
  return s;
}
function unduh(rows, kolom, nama) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: kolom }), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data'); XLSX.writeFile(wb, nama);
}
async function bacaExcel(file) {
  const wb = XLSX.read(await file.arrayBuffer());
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}
const CONTOH = [
  { mapel: 'Matematika', tingkat: 5, tipe: 'pg', teks: 'Hasil 6 x 7 adalah ...', A: '36', B: '42', C: '48', kunci: 'B', bobot: 1 },
  { mapel: 'Matematika', tingkat: 5, tipe: 'pgk', teks: 'Pilih bilangan genap.', A: '2', B: '3', C: '4', kunci: 'A,C', bobot: 2 },
  { mapel: 'IPAS', tingkat: 5, tipe: 'bs', teks: 'Matahari adalah bintang.', kunci: 'B', bobot: 1 },
  { mapel: 'Bahasa Indonesia', tingkat: 5, tipe: 'jodoh', teks: 'Jodohkan lawan kata.', A: 'besar=kecil', B: 'tinggi=rendah', bobot: 2 },
  { mapel: 'IPAS', tingkat: 5, tipe: 'isian', teks: 'Ibu kota Indonesia adalah ...', kunci: 'Jakarta|DKI Jakarta', bobot: 1 },
  { mapel: 'Fikih', tingkat: 5, tipe: 'essay', teks: 'Sebutkan rukun wudhu!', kunci: 'Pedoman: niat, membasuh muka, ...', bobot: 5 }
];

/* ---------- Bank soal ---------- */
async function muat() {
  SOAL = (await api('daftarSoal')).data; PILIH.clear();
  const m = [...new Set(SOAL.map(s => s.mapel))].sort();
  $('fm').innerHTML = '<option value="">Semua mapel</option>' + m.map(x => `<option>${esc(x)}</option>`).join('');
  $('dm').innerHTML = m.map(x => `<option value="${esc(x)}">`).join('');
  render();
}
function render() {
  const f = $('fm').value, c = $('cari').value.toLowerCase();
  const d = SOAL.filter(s => (!f || s.mapel === f) && (!c || s.teks.toLowerCase().includes(c)));
  $('tb').innerHTML = d.length ? d.map(s => `<tr><td><input type="checkbox" data-p="${s.id}" ${PILIH.has(s.id) ? 'checked' : ''} aria-label="Pilih soal"></td>
    <td>${NAMA[s.tipe]}</td><td>${esc(s.mapel)}</td><td>${esc(s.tingkat)}</td><td>${s.gambar ? '[gambar] ' : ''}${esc(s.teks.slice(0, 90))}</td>
    <td><button data-e="${s.id}">Ubah</button></td></tr>`).join('')
    : '<tr><td colspan="6">Belum ada soal. Klik "Tambah soal" atau impor dari Excel.</td></tr>';
  $('hps').disabled = !PILIH.size;
}
function bangun(t, s) {
  s = s || {}; const o = s.opsi || [], k = s.kunci; let h = '';
  if (t === 'pg' || t === 'pgk') {
    h = '<p class="ket">Isi pilihan, lalu tandai jawaban yang benar. Pilihan kosong diabaikan.</p>';
    for (let i = 0; i < 5; i++) {
      const on = t === 'pg' ? k === i : Array.isArray(k) && k.includes(i);
      h += `<div class="op"><input type="${t === 'pg' ? 'radio' : 'checkbox'}" name="k" ${on ? 'checked' : ''} aria-label="Kunci ${L[i]}"><b>${L[i]}</b><input class="ot" value="${esc(o[i] || '')}"></div>`;
    }
  } else if (t === 'bs') {
    h = `<p class="ket">Kunci jawaban:</p><label><input type="radio" name="bs" value="B" ${k === 'B' ? 'checked' : ''}> Benar</label> <label><input type="radio" name="bs" value="S" ${k === 'S' ? 'checked' : ''}> Salah</label>`;
  } else if (t === 'jodoh') {
    h = '<p class="ket">Isi pasangan kiri dan kanan (minimal 2). Kanan akan diacak saat ujian.</p>';
    for (let i = 0; i < 5; i++) h += `<div class="op jd"><input placeholder="Kiri" value="${esc((o[i] || [])[0] || '')}"><input placeholder="Pasangannya" value="${esc((o[i] || [])[1] || '')}"></div>`;
  } else if (t === 'isian') {
    h = `<label for="ik">Jawaban yang diterima (satu per baris)</label><textarea id="ik" rows="3">${esc(Array.isArray(k) ? k.join('\n') : '')}</textarea>`;
  } else {
    h = `<label for="ie">Pedoman penilaian (hanya terlihat guru)</label><textarea id="ie" rows="3">${esc(typeof k === 'string' ? k : '')}</textarea>`;
  }
  $('area').innerHTML = h;
}
function gambar(u) { GAMBAR = u || ''; $('prev').innerHTML = GAMBAR ? `<img src="${esc(GAMBAR)}" alt="Gambar soal"> <button type="button" id="hg">Hapus gambar</button>` : ''; }
function buka(id) {
  EDIT = SOAL.find(s => s.id === id) || null; const s = EDIT || { tipe: 'pg', bobot: 1 };
  $('jd').textContent = EDIT ? 'Ubah soal' : 'Tambah soal';
  $('mapel').value = s.mapel || ''; $('tingkat').value = s.tingkat || ''; $('tipe').value = s.tipe;
  $('teks').value = s.teks || ''; $('bobot').value = s.bobot; $('derr').textContent = '';
  gambar(s.gambar); bangun(s.tipe, EDIT); $('dlg').showModal();
}
function kumpul() {
  const t = $('tipe').value; let opsi = [], kunci = '';
  if (t === 'pg' || t === 'pgk') {
    const rows = [...document.querySelectorAll('#area .op')], map = [];
    rows.forEach((r, i) => { const v = r.querySelector('.ot').value.trim(); if (v) { map[i] = opsi.length; opsi.push(v); } });
    const ck = rows.map((r, i) => r.querySelector('[name=k]').checked && map[i] !== undefined ? map[i] : -1).filter(i => i >= 0);
    kunci = t === 'pg' ? (ck.length ? ck[0] : -1) : ck;
  } else if (t === 'bs') kunci = (document.querySelector('[name=bs]:checked') || {}).value || '';
  else if (t === 'jodoh') opsi = [...document.querySelectorAll('#area .jd')].map(r => [...r.querySelectorAll('input')].map(i => i.value.trim())).filter(p => p[0] || p[1]);
  else if (t === 'isian') kunci = $('ik').value.split('\n').map(x => x.trim()).filter(Boolean);
  else kunci = $('ie').value.trim();
  return { id: EDIT && EDIT.id, mapel: $('mapel').value, tingkat: $('tingkat').value, tipe: t, teks: $('teks').value, gambar: GAMBAR, opsi, kunci, bobot: $('bobot').value };
}
async function kecil(file) {
  const b = await createImageBitmap(file), k = Math.min(1, 1000 / Math.max(b.width, b.height));
  const c = document.createElement('canvas'); c.width = Math.round(b.width * k); c.height = Math.round(b.height * k);
  c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .8).split(',')[1];
}

/* ---------- Admin ---------- */
async function muatGuru() {
  const d = (await api('daftarGuru')).data;
  $('tg').innerHTML = d.map(g => `<tr><td>${esc(g.nama)}</td><td>${esc(g.username)}</td><td>${esc(g.peran)}</td><td>${esc(g.mapel)}</td><td>${esc(g.kelas)}</td></tr>`).join('');
}

/* ---------- Peristiwa ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.e) buka(t.dataset.e);
  if (t.id === 'hg') gambar('');
  if (t.dataset.p) { t.checked ? PILIH.add(t.dataset.p) : PILIH.delete(t.dataset.p); $('hps').disabled = !PILIH.size; }
  if (t.dataset.t) { ['soal', 'ujian', 'admin'].forEach(x => { $(x).hidden = x !== t.dataset.t; $('t-' + x).setAttribute('aria-selected', x === t.dataset.t); }); pesan(''); if (t.dataset.t === 'admin') aksi(muatGuru); if (t.dataset.t === 'ujian') aksi(muatUjian); }
});
$('fm').onchange = $('cari').oninput = render;
$('tipe').onchange = () => bangun($('tipe').value);
$('baru').onclick = () => buka(null);
$('batal').onclick = () => $('dlg').close();
$('berkas').onchange = async e => {
  const f = e.target.files[0]; if (!f) return; if (!/^image\//.test(f.type)) { $('derr').textContent = 'Pilih file gambar.'; return; }
  $('derr').textContent = 'Mengunggah gambar...';
  try { gambar((await api('unggahGambar', { mime: 'image/jpeg', data: await kecil(f) })).url); $('derr').textContent = ''; } catch (x) { $('derr').textContent = x.message; }
  e.target.value = '';
};
$('simpan').onclick = async () => {
  $('simpan').disabled = true;
  try { await api('simpanSoal', { soal: kumpul() }); $('dlg').close(); await muat(); pesan('Soal tersimpan.', 1); } catch (x) { $('derr').textContent = x.message; }
  $('simpan').disabled = false;
};
$('hps').onclick = () => aksi(async () => {
  if (!confirm('Hapus ' + PILIH.size + ' soal terpilih? Tindakan ini tidak bisa dibatalkan.')) return;
  const r = await api('hapusSoal', { ids: [...PILIH] }); await muat(); pesan(r.dihapus + ' soal dihapus.', 1);
});
$('tpl').onclick = () => unduh(CONTOH, KOLOM, 'template-soal.xlsx');
$('eks').onclick = () => unduh(SOAL.map(keRow), KOLOM, 'bank-soal.xlsx');
$('imp').onchange = e => aksi(async () => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const r = await api('imporSoal', { data: (await bacaExcel(f)).map(dariRow) }); await muat();
  pesan(r.ditambah + ' soal diimpor.' + (r.gagal.length ? ' Gagal: ' + r.gagal.map(g => `baris ${g.baris} (${g.error})`).join('; ') : ''), !r.gagal.length);
});
$('fg').onsubmit = e => { e.preventDefault(); aksi(async () => {
  await api('tambahGuru', { nama: $('gn').value, username: $('gu').value, password: $('gp').value, peran: $('gr').value, mapel: $('gm').value, kelas: $('gk').value });
  e.target.reset(); await muatGuru(); pesan('Guru ditambahkan.', 1); }); };
$('tsw').onclick = () => unduh([{ nisn: '0123456789', nama: 'Contoh Siswa', kelas: '5A', pin: '' }], ['nisn', 'nama', 'kelas', 'pin'], 'template-siswa.xlsx');
$('isw').onchange = e => aksi(async () => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const r = await api('imporSiswa', { data: (await bacaExcel(f)).map(x => ({ nisn: x.nisn, nama: x.nama, kelas: x.kelas, pin: x.pin })) });
  if (r.daftar.length) unduh(r.daftar, ['nisn', 'nama', 'kelas', 'pin'], 'daftar-pin-siswa.xlsx');
  pesan(r.ditambah + ' siswa ditambahkan. Daftar PIN terunduh otomatis, simpan dan bagikan ke wali kelas. NISN yang sudah ada dilewati.', 1);
});
$('bpw').onclick = () => aksi(async () => {
  const lama = prompt('Password lama:'); if (lama === null) return; const baru = prompt('Password baru (minimal 6 karakter):'); if (baru === null) return;
  await api('gantiPassword', { lama, baru }); pesan('Password berhasil diganti.', 1);
});
guard(['guru', 'admin']).then(u => {
  if (!u) return; U = u; $('salam').textContent = u.nama;
  if (u.peran === 'admin') $('t-admin').hidden = false;
  aksi(muat);
});
