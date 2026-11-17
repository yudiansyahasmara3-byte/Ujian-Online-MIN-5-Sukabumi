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
  Ujian: ['id','guru_id','judul','mapel','kelas','token','durasi','mulai','selesai','acak','maks_langgar','status'],
  Jawaban: ['ujian_id','nisn','soal_id','jawaban','waktu'],
  Hasil: ['ujian_id','nisn','nilai','benar','salah','status','mulai','selesai'],
  Pelanggaran: ['ujian_id','nisn','jenis','waktu','poin'],
  Log: ['waktu','pengguna','aksi','detail']
};

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(H).forEach(n => {
    const s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) {
      s.appendRow(H[n]); s.setFrozenRows(1);
      s.getRange(1, 1, 1, H[n].length).setFontWeight('bold');
    }
  });
  ss.getSheetByName('Siswa').getRange('A:A').setNumberFormat('@'); // NISN teks
  const d = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1') || ss.getSheetByName('Lembar1');
  if (d && d.getLastRow() === 0) ss.deleteSheet(d);
  const g = ss.getSheetByName('Guru');
  if (g.getLastRow() < 2) g.appendRow(['G001','Administrator','admin',hash_('admin123'),'admin','','',true]);
  Logger.log('Selesai. Login awal: admin / admin123 (segera ganti password!)');
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
    const A = { loginGuru, loginSiswa, me, logout, gantiPassword, tambahGuru, imporSiswa, daftarGuru, daftarSoal, simpanSoal, hapusSoal, imporSoal, unggahGambar };
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
