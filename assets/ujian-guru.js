let UJ = [], UE = null, USEL = new Set();
const fmt = ms => ms ? new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const lokal = ms => ms ? new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
async function muatUjian() {
  UJ = (await api('daftarUjian')).data;
  $('tu').innerHTML = UJ.length ? UJ.map(u => `<tr><td>${esc(u.judul)}<br><small>${esc(u.mapel)} | ${u.durasi} menit</small></td><td>${esc(u.kelas)}</td>
    <td><code>${esc(u.token)}</code></td><td><small>${fmt(u.mulai)}<br>s/d ${fmt(u.selesai)}</small></td><td>${u.soal.length}</td><td>${u.selesaiN}/${u.mulaiN} selesai</td>
    <td>${u.status === 'buka' ? 'Dibuka' : 'Ditutup'}</td><td><button data-up="${u.id}">Panel</button> <button data-ue="${u.id}">Ubah</button> <button data-us="${u.id}" data-v="${u.status === 'buka' ? 'tutup' : 'buka'}">${u.status === 'buka' ? 'Tutup' : 'Buka'}</button></td></tr>`).join('')
    : '<tr><td colspan="8">Belum ada ujian. Klik "Buat ujian". Pastikan bank soal sudah terisi.</td></tr>';
}
function daftarSoalPilih() {
  const m = $('umapel').value.trim().toLowerCase(), d = SOAL.filter(s => !m || s.mapel.toLowerCase() === m);
  $('usoal').innerHTML = d.length ? d.map(s => `<label class="pil" style="margin:4px 0;padding:8px"><input type="checkbox" data-uq="${s.id}" ${USEL.has(s.id) ? 'checked' : ''}> <span>[${NAMA[s.tipe]}] ${esc(s.teks.slice(0, 80))}</span></label>`).join('') : 'Tidak ada soal untuk mapel ini.';
  $('un').textContent = USEL.size;
}
function bukaU(id) {
  UE = UJ.find(u => u.id === id) || null; const u = UE || { durasi: 60, maks: 3, acak: true, soal: [] };
  USEL = new Set(u.soal); $('ujd').textContent = UE ? 'Ubah ujian' : 'Buat ujian'; $('uerr').textContent = '';
  $('ujudul').value = u.judul || ''; $('umapel').value = u.mapel || ''; $('ukelas').value = u.kelas || ''; $('udurasi').value = u.durasi;
  $('umulai').value = lokal(u.mulai); $('uselesai').value = lokal(u.selesai); $('utoken').value = u.token || ''; $('umaks').value = u.maks; $('uacak').checked = u.acak;
  daftarSoalPilih(); $('udlg').showModal();
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.ue) bukaU(t.dataset.ue);
  if (t.dataset.us) aksi(async () => { await api('statusUjian', { id: t.dataset.us, status: t.dataset.v }); await muatUjian(); });
  if (t.dataset.uq) { t.checked ? USEL.add(t.dataset.uq) : USEL.delete(t.dataset.uq); $('un').textContent = USEL.size; }
});
$('ubaru').onclick = () => bukaU(null);
$('ubatal').onclick = () => $('udlg').close();
$('umapel').oninput = daftarSoalPilih;
$('usimpan').onclick = async () => {
  $('usimpan').disabled = true;
  try {
    const v = id => $(id).value;
    await api('simpanUjian', { u: { id: UE && UE.id, judul: v('ujudul'), mapel: v('umapel'), kelas: v('ukelas'), durasi: v('udurasi'), token: v('utoken'),
      mulai: v('umulai') ? new Date(v('umulai')).getTime() : 0, selesai: v('uselesai') ? new Date(v('uselesai')).getTime() : 0,
      maks: v('umaks'), acak: $('uacak').checked, soal: [...USEL] } });
    $('udlg').close(); await muatUjian(); pesan('Ujian tersimpan.', 1);
  } catch (x) { $('uerr').textContent = x.message; }
  $('usimpan').disabled = false;
};
