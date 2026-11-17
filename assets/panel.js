let PU = null, PT = null, LP = null, SIS = [];
const ST = { belum: 'Belum mulai', mengerjakan: 'Mengerjakan', selesai: 'Selesai', 'menunggu koreksi': 'Menunggu koreksi' };
const pp = (t, b) => { const e = $('perr'); e.textContent = t; e.style.color = b ? 'var(--hijau)' : 'var(--salah)'; };
const pa = async fn => { try { pp(''); await fn(); } catch (x) { pp(x.message); } };

function bukaPanel(id) { PU = UJ.find(u => u.id === id); LP = null; $('pj').textContent = PU.judul; pp(''); $('pdlg').showModal(); tabP('pantau'); }
function tabP(t) {
  ['pantau', 'koreksi', 'laporan'].forEach(x => { $(x).hidden = x !== t; document.querySelector(`[data-pt=${x}]`).setAttribute('aria-selected', x === t); });
  clearInterval(PT); pp('');
  if (t === 'pantau') { pa(muatPantau); PT = setInterval(() => { if ($('oto').checked) muatPantau().catch(x => pp(x.message)); }, 10000); }
  if (t === 'koreksi') pa(muatKoreksi);
  if (t === 'laporan') pa(muatLaporan);
}
$('pdlg').onclose = () => clearInterval(PT);

/* ---------- Pantau ---------- */
async function muatPantau() {
  const r = await api('monitorUjian', { id: PU.id }), c = {};
  r.siswa.forEach(s => c[s.status] = (c[s.status] || 0) + 1);
  $('ring').textContent = `Peserta ${r.siswa.length} | Belum mulai ${c.belum || 0} | Mengerjakan ${c.mengerjakan || 0} | Selesai ${c.selesai || 0} | Menunggu koreksi ${c['menunggu koreksi'] || 0} (${new Date().toLocaleTimeString('id-ID')})`;
  r.siswa.sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  $('tp').innerHTML = r.siswa.map(s => `<tr><td>${esc(s.nama)}</td><td>${esc(s.kelas)}</td><td><span class="lencana">${ST[s.status] || esc(s.status)}</span></td>
    <td>${s.status === 'belum' ? '-' : s.terjawab + '/' + r.total}</td><td>${s.pel || 0}</td>
    <td>${s.status === 'mengerjakan' ? `<button data-pk="${s.nisn}">Kumpulkan</button> ` : ''}${s.status !== 'belum' ? `<button data-pr="${s.nisn}">Izinkan ulang</button>` : ''}</td></tr>`).join('')
    || '<tr><td colspan="6">Tidak ada siswa untuk kelas ini. Pastikan siswa sudah diimpor dan kelasnya sama dengan kelas ujian.</td></tr>';
}

/* ---------- Koreksi essay ---------- */
async function muatKoreksi() {
  const r = await api('daftarEssay', { id: PU.id }), b = $('koreksi');
  if (!r.soal.length) { b.innerHTML = '<p>Ujian ini tidak memiliki soal essay.</p>'; return; }
  if (!r.jawab.length) { b.innerHTML = '<p>Belum ada siswa yang selesai mengerjakan.</p>'; return; }
  b.innerHTML = r.soal.map((s, i) => `<h3>Essay ${i + 1} (bobot ${s.bobot})</h3><p style="white-space:pre-wrap">${esc(s.teks)}</p>${s.kunci ? `<p class="ket">Pedoman: ${esc(s.kunci)}</p>` : ''}
    <div class="tab"><table><thead><tr><th>Siswa</th><th>Jawaban</th><th>Skor (0-${s.bobot})</th></tr></thead><tbody>${r.jawab.map(j => `<tr><td>${esc(j.nama)}<br><small>${esc(j.kelas)}</small></td>
    <td style="white-space:pre-wrap">${esc(j.a[s.id] || '(kosong)')}</td><td><input type="number" min="0" max="${s.bobot}" step="0.5" style="width:80px" aria-label="Skor ${esc(j.nama)}" data-ks="${s.id}" data-kn="${j.nisn}" value="${j.e[s.id] === undefined ? '' : j.e[s.id]}"></td></tr>`).join('')}</tbody></table></div>`).join('')
    + '<div class="aksi"><button class="utama" id="ksimpan">Simpan semua skor</button></div>';
}

/* ---------- Laporan ---------- */
async function muatLaporan() { LP = await api('laporanUjian', { id: PU.id }); gambarLaporan(); }
const lKs = p => p === null ? '-' : p >= .7 ? 'Mudah' : p >= .3 ? 'Sedang' : 'Sukar';
const lDp = d => d === null ? '-' : d >= .3 ? 'Baik' : d >= .2 ? 'Cukup' : 'Perlu revisi';
function sebaran(s) {
  if (!s.dist) return '-'; const k = [].concat(s.kunci);
  return s.dist.map((c, i) => (i < s.dist.length - 1 ? String.fromCharCode(65 + i) + (k.includes(i) ? '*' : '') : 'kosong') + ':' + c).join('  ');
}
function gambarLaporan() {
  if (!LP) return; const kkm = Number($('kkm').value) || 0;
  const ps = LP.peserta.filter(p => p.status !== 'berjalan' && p.nilai !== null), n = ps.length, box = $('lisi');
  if (!n) { box.innerHTML = '<p>Belum ada hasil ujian.</p>'; return; }
  const v = ps.map(p => p.nilai), rata = v.reduce((a, b) => a + b, 0) / n, tuntas = v.filter(x => x >= kkm).length;
  const bin = Array(10).fill(0); v.forEach(x => bin[Math.min(9, Math.floor(x / 10))]++); const mx = Math.max(...bin);
  const kls = {}; ps.forEach(p => (kls[p.kelas] = kls[p.kelas] || []).push(p.nilai));
  const tunggu = ps.filter(p => p.status === 'menunggu koreksi').length;
  const kt = (a, b) => `<div class="kt"><b>${b}</b><small>${a}</small></div>`;
  box.innerHTML = `<div class="kts">${kt('Peserta', n)}${kt('Rata-rata', rata.toFixed(1))}${kt('Tertinggi', Math.max(...v))}${kt('Terendah', Math.min(...v))}${kt('Tuntas (KKM ' + kkm + ')', tuntas + ' (' + Math.round(tuntas / n * 100) + '%)')}</div>
  ${tunggu ? `<p class="ket">${tunggu} siswa masih menunggu koreksi essay, nilainya belum final.</p>` : ''}
  <h3>Sebaran nilai</h3>${bin.map((c, i) => `<div style="display:flex;gap:8px;align-items:center;margin:3px 0"><span style="width:64px">${i * 10}-${i === 9 ? 100 : i * 10 + 9}</span><div class="bar-h" style="width:${mx ? c / mx * 100 : 0}%;min-width:${c ? 4 : 0}px"></div><span>${c}</span></div>`).join('')}
  <h3>Per kelas</h3><div class="tab"><table><thead><tr><th>Kelas</th><th>Peserta</th><th>Rata-rata</th></tr></thead><tbody>${Object.keys(kls).sort().map(k => `<tr><td>${esc(k)}</td><td>${kls[k].length}</td><td>${(kls[k].reduce((a, b) => a + b, 0) / kls[k].length).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
  <h3>Nilai siswa</h3><div class="tab"><table><thead><tr><th>Nama</th><th>Kelas</th><th>Nilai</th><th>Benar/Salah</th><th>Status</th><th>Pelanggaran</th><th>KKM</th></tr></thead><tbody>${ps.slice().sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama)).map(p => `<tr><td>${esc(p.nama)}</td><td>${esc(p.kelas)}</td><td><b>${p.nilai}</b></td><td>${p.benar}/${p.salah}</td><td>${ST[p.status] || esc(p.status)}</td><td>${p.pel}</td><td>${p.nilai >= kkm ? 'Tuntas' : 'Belum'}</td></tr>`).join('')}</tbody></table></div>
  <h3>Analisis butir soal</h3><p class="ket">Tingkat kesukaran = persen siswa yang menjawab benar. Daya pembeda = selisih kelompok atas dan bawah (27%). * = kunci.</p>
  <div class="tab"><table><thead><tr><th>No</th><th>Soal</th><th>Kesukaran</th><th>Daya pembeda</th><th>Sebaran jawaban</th></tr></thead><tbody>${LP.soal.map(s => `<tr><td>${s.no}</td><td>${esc(s.teks)}<br><small>${NAMA[s.tipe]}</small></td><td>${s.p === null ? '-' : Math.round(s.p * 100) + '% ' + lKs(s.p)}</td><td>${s.d === null ? '-' : s.d.toFixed(2) + ' ' + lDp(s.d)}</td><td><small>${sebaran(s)}</small></td></tr>`).join('')}</tbody></table></div>`;
}
function ekspLaporan() {
  if (!LP) return; const kkm = Number($('kkm').value) || 0, wb = XLSX.utils.book_new();
  const nilai = LP.peserta.filter(p => p.status !== 'berjalan').sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama))
    .map(p => ({ Kelas: p.kelas, NISN: p.nisn, Nama: p.nama, Nilai: p.nilai, Benar: p.benar, Salah: p.salah, Status: p.status, Pelanggaran: p.pel, Ketuntasan: p.nilai === null ? '' : p.nilai >= kkm ? 'Tuntas' : 'Belum tuntas' }));
  const soal = LP.soal.map(s => ({ No: s.no, Soal: s.teks, Tipe: NAMA[s.tipe], 'Tingkat kesukaran (%)': s.p === null ? '' : Math.round(s.p * 100), Kategori: lKs(s.p), 'Daya pembeda': s.d === null ? '' : +s.d.toFixed(2), Keterangan: lDp(s.d), Sebaran: sebaran(s) }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nilai), 'Nilai'); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(soal), 'Analisis soal');
  XLSX.writeFile(wb, 'laporan-' + (LP.judul.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'ujian') + '.xlsx');
}

/* ---------- Admin: guru & siswa ---------- */
const _mg = muatGuru; muatGuru = async function () { await _mg(); await muatSiswa(); };
async function muatSiswa() {
  SIS = (await api('daftarSiswa')).data;
  const k = [...new Set(SIS.map(s => s.kelas))].sort();
  $('sk').innerHTML = '<option value="">Semua kelas</option>' + k.map(x => `<option>${esc(x)}</option>`).join(''); renderSiswa();
}
function renderSiswa() {
  const f = $('sk').value, c = $('sc').value.toLowerCase();
  const d = SIS.filter(s => (!f || s.kelas === f) && (!c || s.nama.toLowerCase().includes(c) || s.nisn.includes(c)));
  $('ts').innerHTML = d.slice(0, 300).map(s => `<tr><td>${esc(s.nisn)}</td><td>${esc(s.nama)}</td><td>${esc(s.kelas)}</td><td>${s.aktif ? 'Aktif' : 'Nonaktif'}</td>
    <td><button data-rp="${s.nisn}">Reset PIN</button> <button data-as="${s.nisn}" data-v="${s.aktif ? 0 : 1}">${s.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td></tr>`).join('')
    + (d.length > 300 ? `<tr><td colspan="5">Menampilkan 300 dari ${d.length}. Persempit dengan filter.</td></tr>` : '') || '<tr><td colspan="5">Tidak ada siswa.</td></tr>';
}
$('sk').onchange = $('sc').oninput = renderSiswa;

/* ---------- Peristiwa ---------- */
document.addEventListener('click', e => {
  const t = e.target, d = t.dataset;
  if (d.up) bukaPanel(d.up);
  if (d.pt) tabP(d.pt);
  if (t.id === 'ptutup') $('pdlg').close();
  if (t.id === 'lxls') ekspLaporan();
  if (d.pk) pa(async () => { if (!confirm('Kumpulkan jawaban siswa ini sekarang?')) return; await api('tutupPaksa', { id: PU.id, nisn: d.pk }); await muatPantau(); });
  if (t.id === 'pall') pa(async () => { if (!confirm('Kumpulkan paksa semua siswa yang masih mengerjakan?')) return; const r = await api('tutupPaksa', { id: PU.id }); await muatPantau(); pp(r.jumlah + ' siswa dikumpulkan.', 1); });
  if (d.pr) pa(async () => { if (!confirm('Hapus jawaban dan nilai siswa ini untuk ujian ini, lalu izinkan mengerjakan ulang? Tidak bisa dibatalkan.')) return; await api('ulangSiswa', { id: PU.id, nisn: d.pr }); await muatPantau(); pp('Siswa bisa mengerjakan ulang.', 1); });
  if (t.id === 'ksimpan') pa(async () => {
    const m = {}; document.querySelectorAll('[data-ks]').forEach(i => { if (i.value !== '') (m[i.dataset.kn] = m[i.dataset.kn] || {})[i.dataset.ks] = i.value; });
    const r = await api('simpanKoreksi', { id: PU.id, data: Object.keys(m).map(n => ({ nisn: n, skor: m[n] })) }); pp(r.jumlah + ' siswa diperbarui, nilai dihitung ulang.', 1);
  });
  if (d.rg) aksi(async () => { const p = prompt('Password baru untuk guru ini (minimal 6 karakter):'); if (!p) return; await api('resetGuru', { id: d.rg, password: p }); pesan('Password guru diatur ulang.', 1); });
  if (d.ag) aksi(async () => { await api('aktifGuru', { id: d.ag, aktif: d.v === '1' }); await muatGuru(); });
  if (d.rp) aksi(async () => { const s = SIS.find(x => x.nisn === d.rp); if (!confirm('Reset PIN ' + s.nama + '?')) return; const r = await api('resetPin', { nisn: d.rp }); pesan('PIN baru ' + s.nama + ': ' + r.pin + '. Catat sekarang, PIN tidak ditampilkan lagi.', 1); });
  if (d.as) aksi(async () => { await api('aktifSiswa', { nisn: d.as, aktif: d.v === '1' }); await muatSiswa(); });
});
document.addEventListener('input', e => { if (e.target.id === 'kkm') gambarLaporan(); });
