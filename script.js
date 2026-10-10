/* =========================================================
   GALERI MOMEN — MUSIK AUTOPLAY + LOOP + SURAT TEREVEAL
   Satu lagu latar diputar otomatis saat web dibuka, muter terus.
   Kartu foto = kenangan murni (tanpa tombol play).
========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* =========================================================
     KONFIGURASI LAGU — ganti sesuai selera
  ========================================================= */
  const SONG = {
    src:    'lagu.mp3',
    title:  'My Fav Person 2025',
    artist: 'Randi',
    cover:  '1.jpg'
  };

  /* =========================================================
     0. INJECT CSS — sembunyikan tombol play di kartu + lencana
  ========================================================= */
  const style = document.createElement('style');
  style.textContent = `
    /* Hilangkan tombol play di tiap kartu */
    .card .card-play { display: none !important; }
    /* Hilangkan lencana "Now Playing" di kartu */
    .card .now-badge { display: none !important; }
    /* Hilangkan highlight kartu sedang diputar */
    .card.is-current {
      border-color: rgba(255, 255, 255, 0.11) !important;
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28) !important;
    }
  `;
  document.head.appendChild(style);

  /* ---------- Elemen ---------- */
  const audio = $('#audio');
  const np    = $('#np');
  const mini  = $('#mini');

  const el = {
    miniCover: $('#miniCover'), miniTitle: $('#miniTitle'), miniArtist: $('#miniArtist'),
    miniLike: $('#miniLike'), miniPlay: $('#miniPlay'), miniFill: $('#miniFill'),
    npBg: $('#npBg'), npCover: $('#npCover'), npTitle: $('#npTitle'), npArtist: $('#npArtist'),
    npLike: $('#npLike'), npBar: $('#npBar'), npFill: $('#npFill'), npThumb: $('#npThumb'),
    cur: $('#currentTime'), dur: $('#duration'),
    play: $('#playBtn'), prev: $('#prevBtn'), next: $('#nextBtn'),
    shuffle: $('#shuffleBtn'), loop: $('#loopBtn'),
    close: $('#npClose'), more: $('#npMore'),
    queueBtn: $('#queueBtn'), queueClose: $('#queueClose'), queueList: $('#queueList'),
    share: $('#shareBtn'), device: $('#deviceBtn'),
    vol: $('#volumeSlider'), miniVolume: $('#miniVolume'),
    toast: $('#toast')
  };

  /* =========================================================
     1. SETUP AUDIO — 1 lagu, loop terus
  ========================================================= */
  audio.src     = SONG.src;
  audio.loop    = true;
  audio.volume  = 0.7;
  audio.preload = 'auto';

  /* =========================================================
     2. PAINT UI — isi mini & now playing dengan info lagu
  ========================================================= */
  function paintSongInfo() {
    el.miniCover.src = el.npCover.src = el.npBg.src = SONG.cover;
    el.miniTitle.textContent = el.npTitle.textContent = SONG.title;
    el.miniArtist.textContent = el.npArtist.textContent = SONG.artist;
    el.npCover.alt = 'Cover: ' + SONG.title;

    document.documentElement.style.setProperty('--np-rgb', '255, 126, 182');
    sampleColor(SONG.cover).then(rgb => {
      if (rgb) {
        document.documentElement.style.setProperty('--np-rgb', rgb.join(', '));
      }
    });

    if ('mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  SONG.title,
        artist: SONG.artist,
        album:  'My Fav Person 2025',
        artwork: [{ src: SONG.cover }]
      });
    }
  }

  const fmt = s => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  };

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  function sampleColor(src) {
    return new Promise(resolve => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = 16;
          const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(im, 0, 0, 16, 16);
          const d = x.getImageData(0, 0, 16, 16).data;
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const mx = Math.max(d[i], d[i + 1], d[i + 2]);
            const mn = Math.min(d[i], d[i + 1], d[i + 2]);
            const w = 0.25 + (mx ? (mx - mn) / mx : 0);
            r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w;
          }
          r /= n; g /= n; b /= n;
          const m = Math.max(r, g, b) || 1;
          const k = m > 150 ? 150 / m : m < 60 ? 60 / m : 1;
          resolve([r, g, b].map(v => Math.round(clamp(v * k, 0, 255))));
        } catch (e) { resolve(null); }
      };
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  /* =========================================================
     3. KONTROL AUDIO
  ========================================================= */
  let rafId = 0;

  function play() {
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  }
  function toggle() {
    if (audio.paused) play(); else audio.pause();
  }

  function update() {
    const d = audio.duration;
    const c = audio.currentTime || 0;
    const p = d && isFinite(d) ? clamp((c / d) * 100, 0, 100) : 0;

    el.npFill.style.width = p + '%';
    el.npThumb.style.left = p + '%';
    el.miniFill.style.width = p + '%';
    el.cur.textContent = fmt(c);
    el.dur.textContent = d && isFinite(d) ? '-' + fmt(d - c) : '-0:00';
    el.npBar.setAttribute('aria-valuenow', String(Math.round(p)));
  }

  function loopRaf() {
    update();
    if (!audio.paused) rafId = requestAnimationFrame(loopRaf);
  }

  function bindSeek(bar) {
    let dragging = false;
    const seek = e => {
      const r = bar.getBoundingClientRect();
      const p = clamp((e.clientX - r.left) / r.width, 0, 1);
      if (audio.duration && isFinite(audio.duration)) {
        audio.currentTime = p * audio.duration;
      }
      update();
    };
    bar.addEventListener('pointerdown', e => {
      dragging = true;
      bar.setPointerCapture(e.pointerId);
      bar.classList.add('dragging');
      seek(e);
    });
    bar.addEventListener('pointermove', e => { if (dragging) seek(e); });
    const end = () => { dragging = false; bar.classList.remove('dragging'); };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { audio.currentTime += 5; e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { audio.currentTime -= 5; e.preventDefault(); }
      update();
    });
  }

  /* =========================================================
     4. AUTOPLAY — coba putar langsung + fallback gesture
  ========================================================= */
  let autoplayDone = false;                       // true = sudah bunyi (tidak muted)
  const UNLOCK_EVENTS = ['pointerup', 'click', 'touchend', 'keydown'];

  function onStarted() {
    autoplayDone = true;
    UNLOCK_EVENTS.forEach(ev => document.removeEventListener(ev, unlockOnGesture, true));
  }

  // Dipanggil saat user pertama kali menyentuh / klik / tekan tombol
  function unlockOnGesture() {
    if (autoplayDone) return;
    audio.muted = false;
    if (audio.paused) {
      audio.play().then(onStarted).catch(() => {});
    } else {
      onStarted();                                // sudah jalan (muted) -> tinggal nyalakan suara
    }
  }

  function tryAutoplay() {
    if (autoplayDone || !audio.paused) return;
    audio.muted = false;
    const p = audio.play();
    if (!p || !p.catch) return;
    p.then(onStarted).catch(() => {
      // Browser menolak autoplay berbunyi -> putar dulu dalam keadaan senyap
      audio.muted = true;
      audio.play().then(() => {
        showToast('Sentuh layar untuk menyalakan suara 🎵');
      }).catch(() => {});
    });
  }

  // Listener gesture dipasang dari awal & baru dilepas setelah musik benar-benar bunyi
  UNLOCK_EVENTS.forEach(ev => {
    document.addEventListener(ev, unlockOnGesture, { capture: true, passive: true });
  });

  /* ---------- Event audio ---------- */
  audio.addEventListener('play', () => {
    document.body.classList.add('has-played', 'is-playing');
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loopRaf);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });
  audio.addEventListener('pause', () => {
    document.body.classList.remove('is-playing');
    cancelAnimationFrame(rafId);
    update();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  });
  ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked'].forEach(ev => {
    audio.addEventListener(ev, update);
  });
  // Jaga-jaga: kalau loop native gagal, lagu diulang manual
  audio.addEventListener('ended', () => {
    if (audio.loop) { audio.currentTime = 0; play(); }
  });
  audio.addEventListener('error', () => {
    document.body.classList.remove('is-playing');
    showToast('File ' + SONG.src + ' tidak ditemukan');
  });

  /* =========================================================
     5. NOW PLAYING — buka / tutup
  ========================================================= */
  function openNP() {
    document.body.classList.add('np-open');
    np.setAttribute('aria-hidden', 'false');
    mini.setAttribute('aria-hidden', 'true');
    setTimeout(() => el.close.focus({ preventScroll: true }), 350);
  }
  function closeNP() {
    np.classList.remove('queue-open');
    document.body.classList.remove('np-open');
    np.setAttribute('aria-hidden', 'true');
    mini.removeAttribute('aria-hidden');
  }

  /* =========================================================
     6. LIKE — untuk album (bukan per-kartu)
  ========================================================= */
  let likedSong = false;
  try { likedSong = localStorage.getItem('galeri-song-liked') === '1'; } catch (e) {}

  function paintLike() {
    [el.miniLike, el.npLike].forEach(b => {
      b.setAttribute('aria-pressed', String(likedSong));
      b.setAttribute('aria-label', likedSong ? 'Hapus dari Disukai' : 'Simpan ke Disukai');
    });
  }
  function toggleLike() {
    likedSong = !likedSong;
    try { localStorage.setItem('galeri-song-liked', likedSong ? '1' : '0'); } catch (e) {}
    paintLike();
    el.npLike.classList.remove('pop');
    void el.npLike.offsetWidth;
    el.npLike.classList.add('pop');
    showToast(likedSong ? 'Ditambahkan ke Disukai' : 'Dihapus dari Disukai');
  }

  /* =========================================================
     7. QUEUE — isi 1 lagu
  ========================================================= */
  function buildQueue() {
    el.queueList.innerHTML = `
      <li style="--i:0">
        <button class="q-item active" type="button">
          <img src="${SONG.cover}" alt="" loading="lazy">
          <span class="q-text">
            <span class="q-title">${SONG.title}</span>
            <span class="q-artist">${SONG.artist}</span>
          </span>
          <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
      </li>
    `;
  }

  /* =========================================================
     8. EVENT player
  ========================================================= */
  mini.addEventListener('click', e => {
    if (e.target.closest('.mini-btn, .mini-volume')) return;
    openNP();
  });
  mini.addEventListener('keydown', e => {
    if (e.target !== mini) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNP(); }
  });

  el.miniPlay.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  el.miniLike.addEventListener('click', e => { e.stopPropagation(); toggleLike(); });
  el.npLike.addEventListener('click', toggleLike);
  el.play.addEventListener('click', toggle);
  el.close.addEventListener('click', closeNP);
  el.more.addEventListener('click', () => showToast(SONG.title));
  el.device.addEventListener('click', () => showToast('Perangkat ini'));

  el.share.addEventListener('click', async () => {
    const data = { title: SONG.title, text: SONG.title + ' — ' + SONG.artist, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(location.href);
        showToast('Tautan disalin');
      }
    } catch (e) {}
  });

  el.prev.addEventListener('click', () => {
    audio.currentTime = 0;
    update();
    showToast('Kembali ke awal');
  });
  el.next.addEventListener('click', () => {
    audio.currentTime = 0;
    update();
    showToast('Kembali ke awal');
  });

  el.shuffle?.addEventListener('click', () => showToast('Hanya ada 1 lagu — acak nonaktif'));

  el.loop.addEventListener('click', () => {
    audio.loop = !audio.loop;
    el.loop.classList.toggle('on', audio.loop);
    el.loop.setAttribute('aria-pressed', String(audio.loop));
    showToast(audio.loop ? 'Ulangi lagu aktif' : 'Ulangi lagu nonaktif');
  });
  el.loop.classList.add('on');
  el.loop.setAttribute('aria-pressed', 'true');

  el.queueBtn.addEventListener('click', () => np.classList.add('queue-open'));
  el.queueClose.addEventListener('click', () => np.classList.remove('queue-open'));

  const paintVol = () => el.vol.style.setProperty('--v', (el.vol.value * 100) + '%');
  el.vol.addEventListener('input', () => {
    audio.volume = parseFloat(el.vol.value);
    paintVol();
  });
  paintVol();

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (np.classList.contains('queue-open')) np.classList.remove('queue-open');
      else if (document.body.classList.contains('np-open')) closeNP();
      return;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.code === 'Space' && !['button', 'input', 'textarea'].includes(tag)
        && !e.target.closest('[role="button"], [role="slider"]')) {
      e.preventDefault();
      toggle();
    }
  });

  bindSeek(el.npBar);

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) {} };
    set('play', play);
    set('pause', () => audio.pause());
  }

  /* Gesture turun untuk close */
  let touchY = null;
  np.addEventListener('touchstart', e => {
    if (e.target.closest('.queue, .np-bar')) { touchY = null; return; }
    touchY = e.touches[0].clientY;
  }, { passive: true });
  np.addEventListener('touchend', e => {
    if (touchY === null) return;
    const dy = e.changedTouches[0].clientY - touchY;
    touchY = null;
    if (dy > 110) closeNP();
  }, { passive: true });

  let qY = null;
  const queue = $('#queue');
  queue.addEventListener('touchstart', e => {
    if (e.target.closest('.queue-list') && el.queueList.scrollTop > 0) { qY = null; return; }
    qY = e.touches[0].clientY;
  }, { passive: true });
  queue.addEventListener('touchend', e => {
    if (qY === null) return;
    const dy = e.changedTouches[0].clientY - qY;
    qY = null;
    if (dy > 90) np.classList.remove('queue-open');
    e.stopPropagation();
  }, { passive: true });

  /* =========================================================
     9. SCROLL REVEAL — kartu muncul bertahap
  ========================================================= */
  function initScrollReveal() {
    const allCards = document.querySelectorAll('.card');

    // Semua surat di bagian bawah (surat 1 + surat "My First Love...")
    const letters = [...document.querySelectorAll('#letter, #loveLetter, .letter, .love-letter')]
      .filter((el, i, arr) => arr.indexOf(el) === i);

    const revealLetter = el => el.classList.add('reveal');

    // Browser lama: tampilkan semuanya langsung
    if (!('IntersectionObserver' in window)) {
      allCards.forEach(c => c.classList.add('in-view'));
      letters.forEach(revealLetter);
      return;
    }

    /* ---------- Kartu foto ---------- */
    if (allCards.length) {
      let batchIndex = 0;
      let batchTimer = null;
      const BATCH_RESET_MS = 200;
      const STEP_MS        = 90;
      const cardArr        = [...allCards];

      const ioCards = new IntersectionObserver(entries => {
        const visible = entries
          .filter(en => en.isIntersecting)
          .sort((a, b) => cardArr.indexOf(a.target) - cardArr.indexOf(b.target));

        visible.forEach(entry => {
          const node = entry.target;
          node.style.transitionDelay = (batchIndex * STEP_MS) + 'ms';
          node.classList.add('in-view');
          batchIndex++;

          clearTimeout(batchTimer);
          batchTimer = setTimeout(() => {
            batchIndex = 0;
            allCards.forEach(c => { c.style.transitionDelay = ''; });
          }, BATCH_RESET_MS);

          ioCards.unobserve(node);
        });
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -50px 0px'
      });

      allCards.forEach(c => ioCards.observe(c));
    }

    /* ---------- Surat-surat ----------
       Surat itu tinggi; threshold kecil + tanpa rootMargin negatif
       supaya pasti muncul begitu mulai terlihat di layar. */
    if (letters.length) {
      const ioLetter = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          revealLetter(en.target);
          ioLetter.unobserve(en.target);
        });
      }, { threshold: 0.01, rootMargin: '0px 0px 0px 0px' });

      letters.forEach(l => ioLetter.observe(l));

      // Jaring pengaman: kalau user sudah scroll sampai dekat bawah / tombol
      // "Baca surat" ditekan, surat yang belum muncul dipaksa tampil.
      const forceRevealLetters = () => letters.forEach(revealLetter);

      const checkBottom = () => {
        const nearBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
        if (nearBottom) {
          forceRevealLetters();
          window.removeEventListener('scroll', checkBottom);
        }
      };
      window.addEventListener('scroll', checkBottom, { passive: true });

      document.querySelector('#letterJump')?.addEventListener('click', () => {
        setTimeout(forceRevealLetters, 500);
      });
    }
  }

  /* =========================================================
     10. TEKS KENANGAN — 36 caption untuk tiap kartu
  ========================================================= */
  const kenangan = [
    ["27 April 2025", "pap paling imut kamu"],
    ["30 April 2025", "pap kamu pas mau pulang sekolah"],
    ["3 Mei 2025", "pas udah di rumah ngepap lagi"],
    ["6 Mei 2025", "pap lucu kamu lagi"],
    ["9 Mei 2025", "kamu cantik banget pas habis mandi"],
    ["12 Mei 2025", "pake makeup, cocok buat kamu jadi makin cantik"],
    ["15 Mei 2025", "pap pas lagi jajan"],
    ["18 Mei 2025", "pap mau pergi sama keluarga"],
    ["21 Mei 2025", "pap selesai berenang"],
    ["24 Mei 2025", "pap nyoba style rambut baru"],

    ["27 Mei 2025", "pap miror nyoba sweater baru"],
    ["30 Mei 2025", "pap nawarin donat ke aku"],
    ["2 Juni 2025", "pap nyoba sok cool"],
    ["5 Juni 2025", "pap pas berantakan, tapi tetep cantik"],
    ["8 Juni 2025", "pap pas pulang ambil rapot"],
    ["11 Juni 2025", "pap pas ngambil rapot"],
    ["14 Juni 2025", "ngeledek pas mau berangkat sekolah"],
    ["17 Juni 2025", "pas mau berangkat sekolah"],
    ["20 Juni 2025", "pap selesai pake seragam"],
    ["23 Juni 2025", "pap beli jajan malem-malem"],

    ["26 Juni 2025", "pap pas lagi di ruang OSIS"],
    ["29 Juni 2025", "pap mau olahraga"],
    ["2 Juli 2025", "pap pas hari batik"],
    ["5 Juli 2025", "mantep, pap pas lagi nanya keadaannya"],
    ["8 Juli 2025", "pap lucu, mungil, cakep banget"],
    ["11 Juli 2025", "pap pas hari batik"],
    ["14 Juli 2025", "“kamu kaya buto ijo” lucu banget kamu waktu itu"],
    ["17 Juli 2025", "“apasih kok buto ijo” kamu marah pas aku katain gitu"],
    ["20 Juli 2025", "lucu banget imut gitu, kaya marah tapi tetep imut"],
    ["23 Juli 2025", "“liat ran aku kumisan” kamu lucu pas pap ke aku"],

    ["26 Juli 2025", "pap mau merasa keren, emang keren sih"],
    ["29 Juli 2025", "pap pas lagi OSIS"],
    ["1 Agustus 2025", "pap pas selesai mandi"],
    ["4 Agustus 2025", "pap lagi liburan sama keluarga"],
    ["7 Agustus 2025", "pap pas diajak ke mall sama mamah"],
    ["10 Agustus 2025", "pap pas mau pulang renang"]
  ];

  document.querySelectorAll('#galeri .card').forEach((card, i) => {
    const tanggal = card.querySelector('.pesan h3');
    const pesan   = card.querySelector('.pesan p');
    if (!tanggal || !pesan || !kenangan[i]) return;
    tanggal.textContent = kenangan[i][0];
    pesan.textContent   = kenangan[i][1];
  });

  /* =========================================================
     11. SEARCH + LIGHTBOX + QUICK ACTIONS
  ========================================================= */
  const cards = [...document.querySelectorAll('.card')];

  let searchPanel, searchInput, emptySearch;
  function setupSearch() {
    const searchButton = document.querySelector('.top-bar .icon-btn');
    const header       = document.querySelector('.galeri-header');
    const galeri       = document.querySelector('#galeri');
    if (!searchButton || !header || !galeri) return;

    searchPanel = document.createElement('form');
    searchPanel.className = 'search-panel';
    searchPanel.hidden = true;
    searchPanel.innerHTML =
      '<span aria-hidden="true">⌕</span>' +
      '<input type="search" placeholder="Cari tanggal atau kenangan…" aria-label="Cari foto">' +
      '<button type="button" aria-label="Tutup pencarian">×</button>';
    header.insertAdjacentElement('afterend', searchPanel);
    searchInput = searchPanel.querySelector('input');

    emptySearch = document.createElement('p');
    emptySearch.className = 'empty-search';
    emptySearch.textContent = 'Kenangan tidak ditemukan. Coba kata kunci lain.';
    galeri.insertAdjacentElement('afterend', emptySearch);

    searchButton.addEventListener('click', () => {
      searchPanel.hidden = !searchPanel.hidden;
      if (!searchPanel.hidden) {
        searchInput.focus();
        searchPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        searchInput.value = '';
        filterCards('');
      }
    });
    searchPanel.addEventListener('submit', e => e.preventDefault());
    searchPanel.querySelector('button').addEventListener('click', () => {
      searchInput.value = '';
      filterCards('');
      searchPanel.hidden = true;
      searchButton.focus();
    });
    searchInput.addEventListener('input', () => filterCards(searchInput.value));
  }

  function filterCards(query) {
    const q = query.trim().toLocaleLowerCase('id');
    let shown = 0;
    cards.forEach(card => {
      const match = !q || card.textContent.toLocaleLowerCase('id').includes(q);
      card.classList.toggle('search-hidden', !match);
      if (match) shown++;
    });
    const count = document.querySelector('.section-count');
    if (count) count.textContent = q
      ? shown + ' dari ' + cards.length + ' foto'
      : cards.length + ' kenangan';
    if (emptySearch) emptySearch.classList.toggle('show', shown === 0);
  }

  function setupLightbox() {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Pratinjau foto');
    box.innerHTML =
      '<button class="lightbox-close" type="button" aria-label="Tutup foto">×</button>' +
      '<div><img alt=""><p class="lightbox-caption"></p></div>';
    document.body.appendChild(box);

    const image   = box.querySelector('img');
    const caption = box.querySelector('.lightbox-caption');
    const close = () => {
      box.classList.remove('open');
      document.body.classList.remove('lightbox-open');
    };

    cards.forEach(card => {
      const photo = card.querySelector('.foto-wrap img');
      if (!photo) return;
      photo.tabIndex = 0;
      photo.setAttribute('role', 'button');
      photo.setAttribute('aria-label', 'Perbesar ' + (photo.alt || 'foto'));
      const open = () => {
        image.src = photo.currentSrc || photo.src;
        image.alt = photo.alt || 'Foto kenangan';
        caption.textContent = card.querySelector('.pesan p')?.textContent || '';
        box.classList.add('open');
        document.body.classList.add('lightbox-open');
        box.querySelector('button').focus();
      };
      photo.addEventListener('click', open);
      photo.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); open(); }
      });
    });

    box.querySelector('button').addEventListener('click', close);
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && box.classList.contains('open')) close();
    });
  }

  function setupQuickActions() {
    document.querySelector('#randomMemory')?.addEventListener('click', () => {
      const visible = cards.filter(c => !c.classList.contains('search-hidden'));
      if (!visible.length) return;
      const pick = visible[Math.floor(Math.random() * visible.length)];
      pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    document.querySelector('#letterJump')?.addEventListener('click', () => {
      document.querySelector('#letter')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const backBtn = document.querySelector('#backToTop');
    backBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', () => {
      backBtn?.classList.toggle('show', window.scrollY > 500);
    }, { passive: true });
  }

  /* =========================================================
     12. MULAI
  ========================================================= */
  paintSongInfo();
  buildQueue();
  setupSearch();
  setupLightbox();
  setupQuickActions();
  initScrollReveal();
  paintLike();
  update();

  // Autoplay — coba langsung + ulang saat window load
  tryAutoplay();
  setTimeout(tryAutoplay, 200);
  window.addEventListener('load', tryAutoplay);

})();