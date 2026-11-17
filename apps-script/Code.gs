/**
 * API Ujian Online MIN 5 Sukabumi - TAHAP 1 (fondasi + login)
 * Pasang di: Spreadsheet > Ekstensi > Apps Script. Jalankan setup() sekali.
 */
const H = {
  Guru: ['id','nama','username','pass','peran','mapel','kelas','aktif'],
  Siswa: ['nisn','nama','kelas','pin','aktif'],
  Kelas: ['kelas','wali'],
  Mapel: ['kode','nama'],
  BankSoal: ['id','guru_id','mapel','tingkat','tipe','teks','gambar','opsi','kunci','bobot'],
  Ujian: ['id','guru_id','judul','mapel','kelas','token','durasi','mulai','selesai','acak','maks_langgar','status','soal'],
  Jawaban: ['ujian_id','nisn','soal_id','jawaban','waktu'],
  Hasil: ['ujian_id','nisn','nilai','benar','salah','status','mulai','selesai'],
  Pelanggaran: ['ujian_id','nisn','jenis','waktu','poin'],
  Log: ['waktu','pengguna','aksi','detail']
};

// Jalankan sekali untuk mengatur ulang login admin ke: admin / Admin123
function resetAdmin() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Guru');
  const u = rows_('Guru').find(r => String(r.username).toLowerCase() === 'admin');
  if (!u) { sh.appendRow(['G001','Administrator','admin',hash_('Admin123'),'admin','','',true]); return; }
  sh.getRange(u._row, H.Guru.indexOf('pass') + 1).setValue(hash_('Admin123'));
  sh.getRange(u._row, H.Guru.indexOf('peran') + 1).setValue('admin');
  sh.getRange(u._row, H.Guru.indexOf('aktif') + 1).setValue(true);
  Logger.log('Login admin diatur: admin / Admin123');
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(H).forEach(n => {
    const s = ss.getSheetByName(n) || ss.insertSheet(n);
    const lc = s.getLastColumn();
    if (s.getLastRow() === 0) {
      s.appendRow(H[n]); s.setFrozenRows(1);
      s.getRange(1, 1, 1, H[n].length).setFontWeight('bold');
    } else if (lc < H[n].length) { // migrasi kolom baru
      s.getRange(1, lc + 1, 1, H[n].length - lc).setValues([H[n].slice(lc)]).setFontWeight('bold');
    }
  });
  ss.getSheetByName('Siswa').getRange('A:A').setNumberFormat('@'); // NISN teks
  ['Jawaban', 'Hasil', 'Pelanggaran'].forEach(n => ss.getSheetByName(n).getRange('B:B').setNumberFormat('@'));
  ss.getSheetByName('Ujian').getRange('F:F').setNumberFormat('@'); // token teks
  const d = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1') || ss.getSheetByName('Lembar1');
  if (d && d.getLastRow() === 0) ss.deleteSheet(d);
  const g = ss.getSheetByName('Guru');
  if (g.getLastRow() < 2) g.appendRow(['G001','Administrator','admin',hash_('Admin123'),'admin','','',true]);
  Logger.log('Selesai. Login awal: admin / Admin123 (segera ganti password!)');
}

/* ---------- Helper ---------- */
function hash_(p, salt) {
  salt = salt || Utilities.getUuid().slice(0, 8);
  const h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + p));
  return salt + ':' + h;
}
function check_(p, stored) { return hash_(String(p), String(stored).split(':')[0]) === String(stored); }
function aktif_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function rows_(n) {
  const v = SpreadsheetApp.getActive().getSheetByName(n).getDataRange().getValues();
  const h = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => o[k] = r[j]); return o; });
}
function log_(who, aksi, detail) {
  SpreadsheetApp.getActive().getSheetByName('Log').appendRow([new Date(), who, aksi, detail || '']);
}
function newSession_(d) {
  const t = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('S_' + t, JSON.stringify(d), 21600); // 6 jam
  return t;
}
function session_(t) { const v = t && CacheService.getScriptCache().get('S_' + t); return v ? JSON.parse(v) : null; }
function auth_(q, peran) {
  const s = session_(q.token);
  if (!s) throw new Error('Sesi berakhir, silakan login ulang.');
  if (peran && [].concat(peran).indexOf(s.peran) < 0) throw new Error('Anda tidak punya akses ke fitur ini.');
  return s;
}
function locked_(k) { return Number(CacheService.getScriptCache().get('F_' + k) || 0) >= 5; }
function fail_(k) { const c = CacheService.getScriptCache(); c.put('F_' + k, String(Number(c.get('F_' + k) || 0) + 1), 600); }
function ok_(k) { CacheService.getScriptCache().remove('F_' + k); }

/* ---------- Router ---------- */
function doGet() { return ContentService.createTextOutput('API Ujian MIN 5 Sukabumi aktif'); }
function doPost(e) {
  let r;
  try {
    const q = JSON.parse(e.postData.contents);
    const A = { loginGuru, loginSiswa, me, logout, gantiPassword, tambahGuru, imporSiswa, daftarGuru, monitorUjian, tutupPaksa, ulangSiswa, daftarEssay, simpanKoreksi, laporanUjian, daftarSiswa, resetPin, aktifSiswa, resetGuru, aktifGuru, simpanUjian, daftarUjian, statusUjian, ujianSiswa, mulaiUjian, simpanJawaban, laporPelanggaran, kumpulkan, daftarSoal, simpanSoal, hapusSoal, imporSoal, unggahGambar };
    if (!A[q.action]) throw new Error('Aksi tidak dikenal.');
    r = A[q.action](q);
  } catch (x) { r = { ok: false, error: String(x.message || x) }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Aksi ---------- */
function loginGuru(q) {
  const key = String(q.username || '').trim().toLowerCase();
  if (locked_(key)) throw new Error('Terlalu banyak percobaan. Coba lagi 10 menit lagi.');
  const u = rows_('Guru').find(r => String(r.username).toLowerCase() === key && aktif_(r.aktif));
  if (!u || !check_(q.password, u.pass)) { fail_(key); throw new Error('Username atau password salah.'); }
  ok_(key);
  const s = { id: u.id, nama: u.nama, peran: u.peran };
  log_(u.username, 'login', u.peran);
  return { ok: true, token: newSession_(s), user: s };
}

function loginSiswa(q) {
  const key = 'S' + String(q.nisn || '').trim();
  if (locked_(key)) throw new Error('Terlalu banyak percobaan. Coba lagi 10 menit lagi.');
  const u = rows_('Siswa').find(r => String(r.nisn) === String(q.nisn).trim() && aktif_(r.aktif));
  if (!u || !check_(q.pin, u.pin)) { fail_(key); throw new Error('NISN atau PIN salah.'); }
  ok_(key);
  const s = { id: String(u.nisn), nama: u.nama, kelas: u.kelas, peran: 'siswa' };
  log_(s.id, 'login', 'siswa');
  return { ok: true, token: newSession_(s), user: s };
}

function me(q) { return { ok: true, user: auth_(q) }; }
function logout(q) { CacheService.getScriptCache().remove('S_' + q.token); return { ok: true }; }

function gantiPassword(q) {
  const s = auth_(q, ['admin', 'guru']);
  if (String(q.baru || '').length < 6) throw new Error('Password baru minimal 6 karakter.');
  const u = rows_('Guru').find(r => r.id === s.id);
  if (!check_(q.lama, u.pass)) throw new Error('Password lama salah.');
  SpreadsheetApp.getActive().getSheetByName('Guru').getRange(u._row, H.Guru.indexOf('pass') + 1).setValue(hash_(q.baru));
  log_(s.id, 'ganti_password');
  return { ok: true };
}

function tambahGuru(q) {
  const s = auth_(q, 'admin');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const all = rows_('Guru');
    const un = String(q.username || '').trim().toLowerCase();
    if (!q.nama || !un || String(q.password || '').length < 6) throw new Error('Nama, username, dan password (min. 6 karakter) wajib diisi.');
    if (all.some(r => String(r.username).toLowerCase() === un)) throw new Error('Username sudah dipakai.');
    const id = 'G' + ('000' + (all.length + 1)).slice(-3);
    SpreadsheetApp.getActive().getSheetByName('Guru')
      .appendRow([id, q.nama, un, hash_(q.password), q.peran === 'admin' ? 'admin' : 'guru', q.mapel || '', q.kelas || '', true]);
    log_(s.id, 'tambah_guru', un);
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

// q.data = [{nisn, nama, kelas, pin?}] -> PIN kosong dibuat acak 6 digit
function imporSiswa(q) {
  const s = auth_(q, 'admin');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('Siswa');
    const ada = {}; rows_('Siswa').forEach(r => ada[String(r.nisn)] = 1);
    const baru = [], hasil = [];
    (q.data || []).forEach(d => {
      const n = String(d.nisn || '').trim();
      if (!n || !d.nama || ada[n]) return;
      ada[n] = 1;
      const pin = String(d.pin || '') || String(Math.floor(100000 + Math.random() * 900000));
      baru.push([n, d.nama, d.kelas || '', hash_(pin), true]);
      hasil.push({ nisn: n, nama: d.nama, kelas: d.kelas || '', pin: pin });
    });
    if (baru.length) sh.getRange(sh.getLastRow() + 1, 1, baru.length, 5).setValues(baru);
    log_(s.id, 'impor_siswa', baru.length + ' siswa');
    return { ok: true, ditambah: baru.length, daftar: hasil };
  } finally { lock.releaseLock(); }
}

/* ---------- TAHAP 2: Admin & Bank Soal ---------- */
// pg: opsi=[teks], kunci=indeks | pgk: kunci=[indeks] | bs: kunci='B'/'S'
// jodoh: opsi=[[kiri,kanan]] | isian: kunci=[jawaban diterima] | essay: kunci=pedoman
const TIPE = ['pg', 'pgk', 'bs', 'jodoh', 'isian', 'essay'];

function daftarGuru(q) {
  auth_(q, 'admin');
  return { ok: true, data: rows_('Guru').map(r => ({ id: r.id, nama: r.nama, username: r.username, peran: r.peran, mapel: r.mapel, kelas: r.kelas, aktif: aktif_(r.aktif) })) };
}
function parse_(v) { try { return JSON.parse(String(v)); } catch (e) { return v; } }
function safe_(v) { return String(v).replace(/^([=+\-@])/, ' $1'); } // cegah formula injection
function newId_() { return 'Q' + Utilities.getUuid().slice(0, 8); }

function norm_(x) {
  const s = { mapel: String(x.mapel || '').trim(), tingkat: String(x.tingkat || '').trim(), tipe: String(x.tipe || '').trim().toLowerCase(),
    teks: String(x.teks || '').trim(), gambar: String(x.gambar || '').trim(), opsi: x.opsi || [], kunci: x.kunci === undefined ? '' : x.kunci,
    bobot: Number(x.bobot) > 0 ? Number(x.bobot) : 1 };
  const n = s.opsi.length;
  if (TIPE.indexOf(s.tipe) < 0) throw new Error('Tipe soal tidak dikenal.');
  if (!s.mapel) throw new Error('Mapel wajib diisi.');
  if (!s.teks && !s.gambar) throw new Error('Isi teks atau gambar soal.');
  if (s.gambar && !/^https:\/\//.test(s.gambar)) throw new Error('Alamat gambar harus diawali https://');
  if (s.tipe === 'pg' && (n < 2 || !Number.isInteger(s.kunci) || s.kunci < 0 || s.kunci >= n)) throw new Error('Pilihan ganda: isi minimal 2 pilihan dan tandai 1 kunci.');
  if (s.tipe === 'pgk' && (n < 2 || !Array.isArray(s.kunci) || !s.kunci.length)) throw new Error('PG kompleks: isi minimal 2 pilihan dan tandai kunci.');
  if (s.tipe === 'bs' && ['B', 'S'].indexOf(s.kunci) < 0) throw new Error('Pilih kunci Benar atau Salah.');
  if (s.tipe === 'jodoh' && (n < 2 || s.opsi.some(p => !p[0] || !p[1]))) throw new Error('Menjodohkan: isi minimal 2 pasangan lengkap.');
  if (s.tipe === 'isian' && (!Array.isArray(s.kunci) || !s.kunci.length)) throw new Error('Isian singkat: isi minimal 1 jawaban yang diterima.');
  return s;
}
function baris_(id, guru, x) {
  return [id, guru, safe_(x.mapel), safe_(x.tingkat), x.tipe, safe_(x.teks), x.gambar, JSON.stringify(x.opsi), JSON.stringify(x.kunci), x.bobot];
}

function daftarSoal(q) {
  const s = auth_(q, ['guru', 'admin']);
  const data = rows_('BankSoal').filter(r => s.peran === 'admin' || r.guru_id === s.id).map(r => ({
    id: r.id, guru_id: r.guru_id, mapel: r.mapel, tingkat: String(r.tingkat), tipe: r.tipe, teks: String(r.teks).trim(), gambar: r.gambar,
    opsi: parse_(r.opsi || '[]'), kunci: parse_(r.kunci), bobot: Number(r.bobot) || 1 }));
  return { ok: true, data: data };
}

function simpanSoal(q) {
  const s = auth_(q, ['guru', 'admin']);
  const x = norm_(q.soal || {});
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('BankSoal');
    if (q.soal.id) {
      const r = rows_('BankSoal').find(r => r.id === q.soal.id);
      if (!r) throw new Error('Soal tidak ditemukan.');
      if (s.peran !== 'admin' && r.guru_id !== s.id) throw new Error('Itu bukan soal Anda.');
      sh.getRange(r._row, 1, 1, 10).setValues([baris_(r.id, r.guru_id, x)]);
      return { ok: true, id: r.id };
    }
    const id = newId_(); sh.appendRow(baris_(id, s.id, x));
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

function hapusSoal(q) {
  const s = auth_(q, ['guru', 'admin']);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('BankSoal'), ids = q.ids || [];
    const t = rows_('BankSoal').filter(r => ids.indexOf(r.id) >= 0 && (s.peran === 'admin' || r.guru_id === s.id)).sort((a, b) => b._row - a._row);
    t.forEach(r => sh.deleteRow(r._row));
    log_(s.id, 'hapus_soal', t.length + ' soal');
    return { ok: true, dihapus: t.length };
  } finally { lock.releaseLock(); }
}

function imporSoal(q) {
  const s = auth_(q, ['guru', 'admin']);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const baru = [], gagal = [];
    (q.data || []).forEach((d, i) => {
      try { baru.push(baris_(newId_(), s.id, norm_(d))); } catch (e) { gagal.push({ baris: i + 2, error: e.message }); }
    });
    const sh = SpreadsheetApp.getActive().getSheetByName('BankSoal');
    if (baru.length) sh.getRange(sh.getLastRow() + 1, 1, baru.length, 10).setValues(baru);
    log_(s.id, 'impor_soal', baru.length + ' soal');
    return { ok: true, ditambah: baru.length, gagal: gagal };
  } finally { lock.releaseLock(); }
}

function folder_() {
  const it = DriveApp.getFoldersByName('Gambar Soal Ujian');
  return it.hasNext() ? it.next() : DriveApp.createFolder('Gambar Soal Ujian');
}
function unggahGambar(q) {
  auth_(q, ['guru', 'admin']);
  if (!/^image\/(jpeg|png|webp)$/.test(q.mime)) throw new Error('Format gambar harus JPG, PNG, atau WebP.');
  if (!q.data || q.data.length > 1500000) throw new Error('Ukuran gambar terlalu besar.');
  const f = folder_().createFile(Utilities.newBlob(Utilities.base64Decode(q.data), q.mime, 'soal_' + Date.now()));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1000' };
}

/* ---------- TAHAP 3: Ujian (guru) & Ruang Ujian (siswa) ---------- */
function ms_(v) { return Number(v) || 0; }
function shuffle_(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function kelasCocok_(daftar, k) {
  const d = String(daftar).toUpperCase().split(/[,;]+/).map(x => x.trim());
  return d.indexOf('SEMUA') >= 0 || d.indexOf(String(k).toUpperCase().trim()) >= 0;
}

function simpanUjian(q) {
  const s = auth_(q, ['guru', 'admin']), u = q.u || {}, soal = u.soal || [];
  const judul = String(u.judul || '').trim(), kelas = String(u.kelas || '').trim(), dur = Number(u.durasi);
  if (!judul || !kelas) throw new Error('Judul dan kelas wajib diisi.');
  if (!soal.length) throw new Error('Pilih minimal 1 soal.');
  if (!(dur > 0)) throw new Error('Durasi (menit) harus lebih dari 0.');
  const mulai = ms_(u.mulai), selesai = ms_(u.selesai);
  if (mulai && selesai && selesai <= mulai) throw new Error('Waktu selesai harus setelah waktu mulai.');
  const bank = rows_('BankSoal');
  if (!soal.every(id => bank.some(r => r.id === id && (s.peran === 'admin' || r.guru_id === s.id)))) throw new Error('Ada soal yang tidak ditemukan atau bukan milik Anda.');
  const token = String(u.token || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  const row = [null, s.id, safe_(judul), safe_(String(u.mapel || '').trim()), safe_(kelas), token, dur, mulai, selesai, u.acak ? true : false, Math.max(1, Number(u.maks) || 3), 'buka', JSON.stringify(soal)];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('Ujian');
    if (u.id) {
      const r = rows_('Ujian').find(r => r.id === u.id);
      if (!r) throw new Error('Ujian tidak ditemukan.');
      if (s.peran !== 'admin' && r.guru_id !== s.id) throw new Error('Itu bukan ujian Anda.');
      row[0] = r.id; row[1] = r.guru_id; row[11] = r.status;
      sh.getRange(r._row, 1, 1, 13).setValues([row]);
      return { ok: true, id: r.id };
    }
    row[0] = 'U' + Utilities.getUuid().slice(0, 6); sh.appendRow(row);
    return { ok: true, id: row[0] };
  } finally { lock.releaseLock(); }
}

function daftarUjian(q) {
  const s = auth_(q, ['guru', 'admin']), h = {};
  rows_('Hasil').forEach(r => { const o = h[r.ujian_id] = h[r.ujian_id] || { m: 0, s: 0 }; o.m++; if (r.status !== 'berjalan') o.s++; });
  return { ok: true, data: rows_('Ujian').filter(r => s.peran === 'admin' || r.guru_id === s.id).map(r => ({
    id: r.id, judul: r.judul, mapel: r.mapel, kelas: r.kelas, token: String(r.token), durasi: r.durasi, mulai: ms_(r.mulai), selesai: ms_(r.selesai),
    acak: aktif_(r.acak), maks: r.maks_langgar, status: r.status, soal: parse_(r.soal || '[]'), mulaiN: (h[r.id] || {}).m || 0, selesaiN: (h[r.id] || {}).s || 0 })) };
}

function statusUjian(q) {
  const s = auth_(q, ['guru', 'admin']);
  if (['buka', 'tutup'].indexOf(q.status) < 0) throw new Error('Status tidak valid.');
  const r = rows_('Ujian').find(r => r.id === q.id);
  if (!r || (s.peran !== 'admin' && r.guru_id !== s.id)) throw new Error('Ujian tidak ditemukan.');
  SpreadsheetApp.getActive().getSheetByName('Ujian').getRange(r._row, H.Ujian.indexOf('status') + 1).setValue(q.status);
  return { ok: true };
}

function ujianSiswa(q) {
  const s = auth_(q, 'siswa'), now = Date.now(), h = {};
  rows_('Hasil').filter(r => String(r.nisn) === s.id).forEach(r => h[r.ujian_id] = r.status);
  return { ok: true, data: rows_('Ujian').filter(r => r.status === 'buka' && kelasCocok_(r.kelas, s.kelas)).map(r => {
    const m = ms_(r.mulai), e = ms_(r.selesai);
    return { id: r.id, judul: r.judul, mapel: r.mapel, durasi: r.durasi, mulai: m, selesai: e,
      state: h[r.id] ? (h[r.id] === 'berjalan' ? 'berjalan' : 'selesai') : 'belum', dibuka: (!m || now >= m) && (!e || now <= e) };
  }) };
}

// Sesi ujian siswa = 1 baris Jawaban {o:urutan soal, a:jawaban, p:pelanggaran} + 1 baris Hasil
function ses_(uid, nisn) {
  const c = CacheService.getScriptCache(), k = 'R_' + uid + '_' + nisn, ss = SpreadsheetApp.getActive();
  const J = ss.getSheetByName('Jawaban'), Hs = ss.getSheetByName('Hasil');
  const m = parse_(c.get(k) || 'null');
  if (m) { const jv = J.getRange(m.j, 1, 1, 2).getValues()[0], hh = Hs.getRange(m.h, 1, 1, 2).getValues()[0]; if (String(jv[0]) === uid && String(jv[1]) === nisn && String(hh[0]) === uid && String(hh[1]) === nisn) return { m: m, J: J, Hs: Hs }; }
  const jr = rows_('Jawaban').find(r => r.ujian_id === uid && String(r.nisn) === nisn);
  const hr = rows_('Hasil').find(r => r.ujian_id === uid && String(r.nisn) === nisn);
  if (!jr || !hr) return null;
  const n = { j: jr._row, h: hr._row }; c.put(k, JSON.stringify(n), 21600);
  return { m: n, J: J, Hs: Hs };
}
function ctx_(q) {
  const s = auth_(q, 'siswa'), u = rows_('Ujian').find(r => r.id === q.ujian);
  if (!u) throw new Error('Ujian tidak ditemukan.');
  const x = ses_(q.ujian, s.id);
  if (!x) throw new Error('Sesi ujian tidak ditemukan. Mulai dari daftar ujian.');
  return { s: s, u: u, x: x };
}
function batas_(u, mulai) { let d = Number(mulai) + Number(u.durasi) * 60000; const e = ms_(u.selesai); if (e && e < d) d = e; return d; }
function hv_(x) { return x.Hs.getRange(x.m.h, 1, 1, 8).getValues()[0]; }
function st_(x) { return parse_(x.J.getRange(x.m.j, 4).getValue()); }
function tulis_(x, st) { x.J.getRange(x.m.j, 4, 1, 2).setValues([[JSON.stringify(st), Date.now()]]); }

function mulaiUjian(q) {
  const s = auth_(q, 'siswa'), now = Date.now();
  const u = rows_('Ujian').find(r => r.id === q.ujian && r.status === 'buka' && kelasCocok_(r.kelas, s.kelas));
  if (!u) throw new Error('Ujian tidak tersedia.');
  let x = ses_(q.ujian, s.id);
  if (!x) {
    if (String(q.token || '').trim().toUpperCase() !== String(u.token).toUpperCase()) throw new Error('Token salah. Tanyakan token ke guru.');
    const m = ms_(u.mulai), e = ms_(u.selesai);
    if (m && now < m) throw new Error('Ujian belum dimulai.');
    if (e && now > e) throw new Error('Waktu ujian sudah berakhir.');
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      if (!ses_(q.ujian, s.id)) {
        const ids = parse_(u.soal || '[]'), ss = SpreadsheetApp.getActive();
        ss.getSheetByName('Jawaban').appendRow([q.ujian, s.id, '*', JSON.stringify({ o: aktif_(u.acak) ? shuffle_(ids) : ids, a: {}, p: 0 }), now]);
        ss.getSheetByName('Hasil').appendRow([q.ujian, s.id, '', '', '', 'berjalan', now, '']);
      }
    } finally { lock.releaseLock(); }
    x = ses_(q.ujian, s.id);
    log_(s.id, 'mulai_ujian', q.ujian);
  }
  const hv = hv_(x);
  if (hv[5] !== 'berjalan') return { ok: true, selesai: true };
  const sisa = batas_(u, hv[6]) - Date.now();
  if (sisa <= 0) return kumpul_(u, x);
  const st = st_(x), bank = {}; rows_('BankSoal').forEach(r => bank[r.id] = r);
  const soal = st.o.filter(id => bank[id]).map(id => {
    const r = bank[id], t = r.tipe, o = parse_(r.opsi || '[]');
    return { id: id, tipe: t, teks: String(r.teks).trim(), gambar: r.gambar, bobot: Number(r.bobot) || 1,
      opsi: t === 'jodoh' ? { k: o.map(p => p[0]), r: shuffle_(o.map(p => p[1])) } : (t === 'pg' || t === 'pgk' ? o : []) };
  });
  return { ok: true, judul: u.judul, soal: soal, a: st.a, p: st.p || 0, maks: Number(u.maks_langgar) || 3, acak: aktif_(u.acak), sisaMs: sisa };
}

function simpanJawaban(q) {
  const c = ctx_(q), hv = hv_(c.x);
  if (hv[5] !== 'berjalan') return { ok: true, selesai: true };
  const sisa = batas_(c.u, hv[6]) - Date.now();
  if (sisa < -15000) return kumpul_(c.u, c.x);
  simpan_(c.x, q.a);
  if (sisa <= 0) return kumpul_(c.u, c.x);
  return { ok: true, sisaMs: sisa };
}
function simpan_(x, a) {
  const st = st_(x);
  Object.keys(a || {}).forEach(k => { if (st.o.indexOf(k) >= 0) st.a[k] = a[k]; });
  tulis_(x, st);
}

function laporPelanggaran(q) {
  const c = ctx_(q), hv = hv_(c.x);
  if (hv[5] !== 'berjalan') return { ok: true, selesai: true };
  const jenis = ['keluar_layar_penuh', 'pindah_tab', 'keluar_jendela'].indexOf(q.jenis) >= 0 ? q.jenis : 'lainnya';
  const st = st_(c.x); st.p = (st.p || 0) + 1; tulis_(c.x, st);
  SpreadsheetApp.getActive().getSheetByName('Pelanggaran').appendRow([q.ujian, c.s.id, jenis, new Date(), 1]);
  const maks = Number(c.u.maks_langgar) || 3;
  if (st.p >= maks) return Object.assign(kumpul_(c.u, c.x), { p: st.p, maks: maks });
  return { ok: true, p: st.p, maks: maks };
}

function kumpulkan(q) {
  const c = ctx_(q), hv = hv_(c.x);
  if (hv[5] === 'berjalan' && batas_(c.u, hv[6]) - Date.now() > -15000) simpan_(c.x, q.a);
  return kumpul_(c.u, c.x);
}

function nilai_(r, a) {
  const t = r.tipe, o = parse_(r.opsi || '[]'), k = parse_(r.kunci);
  if (t === 'essay') return null; // dikoreksi guru
  if (a === undefined || a === null || a === '') return 0;
  if (t === 'pg') return Number(a) === k ? 1 : 0;
  if (t === 'pgk') return [].concat(a).map(Number).sort().join() === [].concat(k).map(Number).sort().join() ? 1 : 0;
  if (t === 'bs') return a === k ? 1 : 0;
  if (t === 'jodoh') { let n = 0; o.forEach((p, i) => { if (String((a || [])[i] || '').trim() === String(p[1]).trim()) n++; }); return n / o.length; }
  if (t === 'isian') { const f = v => String(v).trim().toLowerCase().replace(/\s+/g, ' '); return [].concat(k).some(x => f(x) === f(a)) ? 1 : 0; }
  return 0;
}
// Hitung nilai dari jawaban (st.a) dan skor essay yang sudah dikoreksi guru (st.e)
function hitung_(st, bank) {
  let got = 0, tot = 0, b = 0, sl = 0, es = false;
  st.o.forEach(id => {
    const r = bank[id]; if (!r) return;
    const w = Number(r.bobot) || 1; tot += w;
    let f = nilai_(r, st.a[id]);
    if (f === null) {
      const e = (st.e || {})[id];
      if (e !== undefined) f = e / w;
      else if (!String(st.a[id] || '').trim()) f = 0; // essay kosong = 0
      else { es = true; return; }
    }
    got += w * f; if (f >= 1) b++; else sl++;
  });
  return { nilai: tot ? Math.round(got / tot * 10000) / 100 : 0, b: b, sl: sl, es: es };
}
function kumpul_(u, x) {
  const hv = hv_(x);
  if (hv[5] !== 'berjalan') return { ok: true, selesai: true };
  const bank = {}; rows_('BankSoal').forEach(r => bank[r.id] = r);
  const h = hitung_(st_(x), bank);
  x.Hs.getRange(x.m.h, 3, 1, 6).setValues([[h.nilai, h.b, h.sl, h.es ? 'menunggu koreksi' : 'selesai', hv[6], Date.now()]]);
  return { ok: true, selesai: true };
}

/* ---------- TAHAP 4: Monitoring, koreksi, laporan, pengelolaan ---------- */
function milik_(q) {
  const s = auth_(q, ['guru', 'admin']), u = rows_('Ujian').find(r => r.id === q.id);
  if (!u || (s.peran !== 'admin' && u.guru_id !== s.id)) throw new Error('Ujian tidak ditemukan.');
  return { s: s, u: u };
}

function monitorUjian(q) {
  const u = milik_(q).u, id = u.id, Hh = {}, Jj = {}, Pp = {};
  rows_('Hasil').filter(r => r.ujian_id === id).forEach(r => Hh[String(r.nisn)] = r);
  rows_('Jawaban').filter(r => r.ujian_id === id).forEach(r => Jj[String(r.nisn)] = parse_(r.jawaban));
  rows_('Pelanggaran').filter(r => r.ujian_id === id).forEach(r => { const n = String(r.nisn); Pp[n] = (Pp[n] || 0) + 1; });
  const siswa = rows_('Siswa').filter(r => aktif_(r.aktif) && kelasCocok_(u.kelas, r.kelas)).map(r => {
    const n = String(r.nisn), h = Hh[n], st = Jj[n] || {};
    return { nisn: n, nama: r.nama, kelas: String(r.kelas), status: h ? (h.status === 'berjalan' ? 'mengerjakan' : h.status) : 'belum',
      terjawab: Object.keys(st.a || {}).length, pel: Pp[n] || 0 };
  });
  return { ok: true, total: parse_(u.soal || '[]').length, siswa: siswa };
}

function tutupPaksa(q) {
  const u = milik_(q).u; let n = 0;
  const target = q.nisn ? [String(q.nisn)] : rows_('Hasil').filter(r => r.ujian_id === u.id && r.status === 'berjalan').map(r => String(r.nisn));
  target.forEach(nisn => { const x = ses_(u.id, nisn); if (x && hv_(x)[5] === 'berjalan') { kumpul_(u, x); n++; } });
  return { ok: true, jumlah: n };
}

function ulangSiswa(q) {
  const m = milik_(q), u = m.u, nisn = String(q.nisn), ss = SpreadsheetApp.getActive();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const jr = rows_('Jawaban').find(r => r.ujian_id === u.id && String(r.nisn) === nisn);
    const hr = rows_('Hasil').find(r => r.ujian_id === u.id && String(r.nisn) === nisn);
    if (jr) ss.getSheetByName('Jawaban').deleteRow(jr._row);
    if (hr) ss.getSheetByName('Hasil').deleteRow(hr._row);
    CacheService.getScriptCache().remove('R_' + u.id + '_' + nisn);
    log_(m.s.id, 'ulang_ujian', u.id + ':' + nisn);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function daftarEssay(q) {
  const u = milik_(q).u, bank = {}; rows_('BankSoal').forEach(r => bank[r.id] = r);
  const soal = parse_(u.soal || '[]').filter(id => bank[id] && bank[id].tipe === 'essay')
    .map(id => ({ id: id, teks: String(bank[id].teks).trim(), kunci: String(parse_(bank[id].kunci) || ''), bobot: Number(bank[id].bobot) || 1 }));
  if (!soal.length) return { ok: true, soal: [], jawab: [] };
  const sis = {}; rows_('Siswa').forEach(r => sis[String(r.nisn)] = r);
  const done = {}; rows_('Hasil').filter(r => r.ujian_id === u.id && r.status !== 'berjalan').forEach(r => done[String(r.nisn)] = 1);
  const jawab = [];
  rows_('Jawaban').filter(r => r.ujian_id === u.id && done[String(r.nisn)]).forEach(r => {
    const st = parse_(r.jawaban), n = String(r.nisn), s = sis[n] || {};
    jawab.push({ nisn: n, nama: s.nama || n, kelas: String(s.kelas || ''), a: st.a || {}, e: st.e || {} });
  });
  jawab.sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  return { ok: true, soal: soal, jawab: jawab };
}

// q.data = [{nisn, skor:{soal_id: poin}}]
function simpanKoreksi(q) {
  const m = milik_(q), u = m.u, bank = {}; rows_('BankSoal').forEach(r => bank[r.id] = r);
  let n = 0;
  (q.data || []).forEach(d => {
    const x = ses_(u.id, String(d.nisn)); if (!x || hv_(x)[5] === 'berjalan') return;
    const st = st_(x); st.e = st.e || {};
    Object.keys(d.skor || {}).forEach(sid => {
      const r = bank[sid], p = Number(d.skor[sid]);
      if (!r || r.tipe !== 'essay' || st.o.indexOf(sid) < 0 || isNaN(p)) return;
      st.e[sid] = Math.max(0, Math.min(Number(r.bobot) || 1, p));
    });
    tulis_(x, st);
    const h = hitung_(st, bank);
    x.Hs.getRange(x.m.h, 3, 1, 4).setValues([[h.nilai, h.b, h.sl, h.es ? 'menunggu koreksi' : 'selesai']]);
    n++;
  });
  log_(m.s.id, 'koreksi', u.id + ': ' + n + ' siswa');
  return { ok: true, jumlah: n };
}

function laporanUjian(q) {
  const u = milik_(q).u, bank = {}, sis = {}, J = {}, P = {};
  rows_('BankSoal').forEach(r => bank[r.id] = r); rows_('Siswa').forEach(r => sis[String(r.nisn)] = r);
  rows_('Jawaban').filter(r => r.ujian_id === u.id).forEach(r => J[String(r.nisn)] = parse_(r.jawaban));
  rows_('Pelanggaran').filter(r => r.ujian_id === u.id).forEach(r => { const n = String(r.nisn); P[n] = (P[n] || 0) + 1; });
  const peserta = rows_('Hasil').filter(r => r.ujian_id === u.id).map(r => {
    const n = String(r.nisn), s = sis[n] || {};
    return { nisn: n, nama: s.nama || n, kelas: String(s.kelas || ''), nilai: r.nilai === '' ? null : Number(r.nilai), benar: r.benar, salah: r.salah, status: r.status, pel: P[n] || 0 };
  });
  const done = peserta.filter(p => p.status !== 'berjalan' && p.nilai !== null).sort((a, b) => b.nilai - a.nilai);
  const k = Math.max(1, Math.round(done.length * 0.27)), avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const soal = parse_(u.soal || '[]').filter(id => bank[id]).map((id, i) => {
    const r = bank[id], w = Number(r.bobot) || 1;
    const fs = done.map(p => {
      const st = J[p.nisn]; if (!st) return null;
      let f = nilai_(r, (st.a || {})[id]);
      if (f === null) { const e = (st.e || {})[id]; f = e === undefined ? null : e / w; }
      return f;
    });
    const up = avg(fs.slice(0, k).filter(f => f !== null)), lo = avg(fs.slice(-k).filter(f => f !== null));
    let dist = null;
    if (r.tipe === 'pg' || r.tipe === 'pgk') {
      const o = parse_(r.opsi || '[]'); dist = o.map(() => 0).concat([0]);
      done.forEach(p => {
        const a = ((J[p.nisn] || {}).a || {})[id];
        if (a === undefined || a === '' || (Array.isArray(a) && !a.length)) dist[o.length]++;
        else [].concat(a).forEach(x => { if (dist[x] !== undefined) dist[x]++; });
      });
    }
    return { no: i + 1, tipe: r.tipe, teks: String(r.teks).trim().slice(0, 80), p: avg(fs.filter(f => f !== null)),
      d: (done.length >= 4 && up !== null && lo !== null) ? up - lo : null, dist: dist, kunci: dist ? parse_(r.kunci) : null };
  });
  return { ok: true, judul: u.judul, mapel: u.mapel, kelas: u.kelas, peserta: peserta, soal: soal };
}

function daftarSiswa(q) {
  auth_(q, 'admin');
  return { ok: true, data: rows_('Siswa').map(r => ({ nisn: String(r.nisn), nama: r.nama, kelas: String(r.kelas), aktif: aktif_(r.aktif) })) };
}
function resetPin(q) {
  const s = auth_(q, 'admin'), r = rows_('Siswa').find(r => String(r.nisn) === String(q.nisn));
  if (!r) throw new Error('Siswa tidak ditemukan.');
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  SpreadsheetApp.getActive().getSheetByName('Siswa').getRange(r._row, H.Siswa.indexOf('pin') + 1).setValue(hash_(pin));
  log_(s.id, 'reset_pin', r.nisn);
  return { ok: true, pin: pin };
}
function aktifSiswa(q) {
  const s = auth_(q, 'admin'), r = rows_('Siswa').find(r => String(r.nisn) === String(q.nisn));
  if (!r) throw new Error('Siswa tidak ditemukan.');
  SpreadsheetApp.getActive().getSheetByName('Siswa').getRange(r._row, H.Siswa.indexOf('aktif') + 1).setValue(q.aktif ? true : false);
  log_(s.id, q.aktif ? 'aktifkan_siswa' : 'nonaktifkan_siswa', r.nisn);
  return { ok: true };
}
function resetGuru(q) {
  const s = auth_(q, 'admin'), r = rows_('Guru').find(r => r.id === q.id);
  if (!r) throw new Error('Guru tidak ditemukan.');
  if (String(q.password || '').length < 6) throw new Error('Password minimal 6 karakter.');
  SpreadsheetApp.getActive().getSheetByName('Guru').getRange(r._row, H.Guru.indexOf('pass') + 1).setValue(hash_(q.password));
  log_(s.id, 'reset_guru', r.username);
  return { ok: true };
}
function aktifGuru(q) {
  const s = auth_(q, 'admin'), r = rows_('Guru').find(r => r.id === q.id);
  if (!r) throw new Error('Guru tidak ditemukan.');
  if (r.id === s.id) throw new Error('Anda tidak bisa menonaktifkan akun sendiri.');
  SpreadsheetApp.getActive().getSheetByName('Guru').getRange(r._row, H.Guru.indexOf('aktif') + 1).setValue(q.aktif ? true : false);
  log_(s.id, q.aktif ? 'aktifkan_guru' : 'nonaktifkan_guru', r.username);
  return { ok: true };
}
