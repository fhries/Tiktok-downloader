// Lewat proxy serverless (/api/tiktok) supaya tidak kena blokir CORS
// dari browser saat memanggil vibetik.net langsung.
const API_BASE = '';

const form         = document.getElementById('downloadForm');
const urlInput     = document.getElementById('urlInput');
const pasteBtn     = document.getElementById('pasteBtn');
const submitBtn    = document.getElementById('submitBtn');
const errorMsg     = document.getElementById('errorMsg');
const scrubline    = document.getElementById('scrubline');
const howSection   = document.getElementById('howSection');

const resultSec    = document.getElementById('result');
const coverImg     = document.getElementById('coverImg');
const videoTitle   = document.getElementById('videoTitle');
const videoAuthor  = document.getElementById('videoAuthor');
const statPlay     = document.getElementById('statPlay');
const statLike     = document.getElementById('statLike');
const statDuration = document.getElementById('statDuration');
const downloadList = document.getElementById('downloadList');
const resetBtn     = document.getElementById('resetBtn');

// ---------- helpers ----------
function fmtNumber(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'jt';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'rb';
  return String(n);
}

function fmtDuration(sec) {
  sec = Number(sec) || 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('is-visible');
  urlInput.style.borderColor = '';
}

function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.remove('is-visible');
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('is-loading', isLoading);
  if (isLoading) {
    scrubline.classList.remove('is-active');
    // force reflow so the transition can retrigger
    void scrubline.offsetWidth;
    scrubline.classList.add('is-active');
  }
}

// ---------- normalisasi data (sama seperti scraper.js) ----------
function normalizeVideoData(raw) {
  return {
    id: raw.id || null,
    title: raw.title || raw.desc || 'TikTok Video',
    cover: raw.cover || null,
    hdVideoUrl: raw.hdplay || raw.play || null,
    videoUrl: raw.play || null,
    musicUrl: raw.music || null,
    author: {
      uniqueId: raw.author?.unique_id || null,
      nickname: raw.author?.nickname || null,
    },
    stats: {
      playCount: raw.play_count || 0,
      diggCount: raw.digg_count || 0,
      shareCount: raw.share_count || 0,
      commentCount: raw.comment_count || 0,
    },
    duration: raw.duration || 0,
    images: Array.isArray(raw.images) ? raw.images : [],
    isSlide: Array.isArray(raw.images) && raw.images.length > 0,
  };
}

async function getVideoInfo(tiktokUrl) {
  const params = new URLSearchParams({ url: tiktokUrl.trim() });
  const res = await fetch(`/api/tiktok?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}). Coba lagi sebentar.`);
  }

  if (!res.ok) {
    throw new Error(data?.message || `Server error (${res.status}).`);
  }
  if (!data || data.status !== 'success') {
    throw new Error(data?.message || 'Gagal mengambil informasi video.');
  }
  if (!data.data || !data.data.id) {
    throw new Error('Data video tidak lengkap atau tidak valid.');
  }

  return normalizeVideoData(data.data);
}

// ---------- render hasil ----------
function buildDownloadRow({ icon, iconClass, name, sub, href, filename }) {
  const row = document.createElement('div');
  row.className = 'dl-row';

  row.innerHTML = `
    <div class="dl-row__icon${iconClass ? ' ' + iconClass : ''}">${icon}</div>
    <div class="dl-row__body">
      <p class="dl-row__name">${name}</p>
      <p class="dl-row__sub">${sub}</p>
    </div>
    <a class="dl-row__btn" href="${href}" download="${filename}" target="_blank" rel="noopener">Unduh</a>
  `;
  return row;
}

function renderResult(info) {
  coverImg.src = info.cover || '';
  coverImg.alt = info.title;
  videoTitle.textContent = info.title;
  videoAuthor.textContent = info.author.uniqueId ? `@${info.author.uniqueId}` : 'unknown';

  statPlay.textContent = fmtNumber(info.stats.playCount);
  statLike.textContent = fmtNumber(info.stats.diggCount);
  statDuration.textContent = info.isSlide ? `${info.images.length} foto` : fmtDuration(info.duration);

  downloadList.innerHTML = '';
  const authorId = info.author.uniqueId || 'tiktok';
  let delay = 0;
  const pushRow = (rowConfig) => {
    const row = buildDownloadRow(rowConfig);
    row.style.animationDelay = `${delay}s`;
    delay += 0.06;
    downloadList.appendChild(row);
  };

  if (info.isSlide) {
    // Postingan slide/foto tidak punya file video sama sekali dari TikTok,
    // jadi tampilkan pemberitahuan biar jelas ini bukan error.
    const note = document.createElement('p');
    note.style.cssText = 'color:var(--muted);font-family:var(--f-mono);font-size:12px;margin:0 0 4px;';
    note.textContent = 'Postingan ini berupa foto slide — TikTok tidak menyediakan versi video untuk tipe ini.';
    downloadList.appendChild(note);
  } else {
    // Video post: selalu coba tampilkan minimal satu opsi video,
    // pakai fallback bertingkat kalau kualitas HD tidak tersedia dari server.
    const hasHD = Boolean(info.hdVideoUrl);
    const hasStandard = Boolean(info.videoUrl) && info.videoUrl !== info.hdVideoUrl;

    if (hasHD) {
      pushRow({
        icon: '▶', name: 'Video HD', sub: 'Tanpa watermark · kualitas tinggi',
        href: info.hdVideoUrl, filename: `${authorId}-${info.id}-hd.mp4`,
      });
    }
    if (hasStandard) {
      pushRow({
        icon: '▶', iconClass: 'cyan', name: 'Video Standar', sub: 'Tanpa watermark',
        href: info.videoUrl, filename: `${authorId}-${info.id}.mp4`,
      });
    }
    if (!hasHD && !hasStandard) {
      const note = document.createElement('p');
      note.style.cssText = 'color:var(--muted);font-family:var(--f-mono);font-size:12px;margin:0 0 4px;';
      note.textContent = 'Server sumber tidak mengembalikan link video untuk postingan ini. Coba lagi beberapa saat lagi.';
      downloadList.appendChild(note);
    }
  }

  if (info.musicUrl) {
    pushRow({
      icon: '♫', iconClass: 'cyan', name: 'Audio / Musik', sub: 'Format MP3',
      href: info.musicUrl, filename: `${authorId}-${info.id}-music.mp3`,
    });
  }
  info.images.forEach((url, i) => {
    pushRow({
      icon: '🖼', name: `Slide ${i + 1}`, sub: `Gambar ${i + 1} dari ${info.images.length}`,
      href: url, filename: `${authorId}-${info.id}-slide-${i + 1}.jpg`,
    });
  });

  if (!downloadList.children.length) {
    downloadList.innerHTML = `<p style="color:var(--muted);font-family:var(--f-mono);font-size:13px;">Tidak ada file yang bisa diunduh dari video ini.</p>`;
  }

  resultSec.hidden = false;
  howSection.hidden = true;
  resultSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- events ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const url = urlInput.value.trim();
  if (!url) {
    showError('Tempel link TikTok dulu, ya.');
    return;
  }
  if (!/tiktok\.com/i.test(url)) {
    showError('Sepertinya itu bukan link TikTok yang valid.');
    return;
  }

  setLoading(true);
  try {
    const info = await getVideoInfo(url);
    renderResult(info);
  } catch (err) {
    showError(err.message || 'Terjadi kesalahan. Coba lagi.');
    scrubline.classList.remove('is-active');
  } finally {
    setLoading(false);
  }
});

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      urlInput.focus();
      clearError();
    }
  } catch {
    urlInput.focus();
    showError('Browser tidak mengizinkan akses clipboard. Tempel manual saja (Ctrl/Cmd+V).');
  }
});

resetBtn.addEventListener('click', () => {
  resultSec.hidden = true;
  howSection.hidden = false;
  urlInput.value = '';
  clearError();
  scrubline.classList.remove('is-active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => urlInput.focus(), 400);
});

urlInput.addEventListener('input', clearError);
