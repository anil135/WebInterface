/**
 * CCTV Archive Viewer — Frontend Application
 * ============================================
 * Handles: location/camera selection, date/time picking,
 *          fetching video list from API, playback, download.
 *
 * DEMO MODE: When apiEndpoint contains "YOUR_API_ID", the app
 * generates realistic mock data so the UI can be evaluated
 * before AWS is deployed.
 */

/* ═══════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════ */
const S = {
  allItems:    [],
  viewItems:   [],
  selected:    new Set(),
  viewMode:    'grid',
  typeFilter:  'all',
  activeItem:  null,
  isDemoMode:  false,
};

/* ═══════════════════════════════════════════════════════════════
   BOOTSTRAP
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const cfg = window.CCTV_CONFIG;
  S.isDemoMode = !cfg.apiEndpoint || cfg.apiEndpoint.includes('YOUR_API_ID');

  if (S.isDemoMode) {
    toast('Demo mode active — using sample data', 'inf');
  }

  // Populate location dropdown
  const locSel = document.getElementById('sel-location');
  cfg.locations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc.id;
    opt.textContent = loc.name;
    locSel.appendChild(opt);
  });

  // Populate years
  const ySel = document.getElementById('sel-year');
  const now  = new Date().getFullYear();
  for (let y = now; y >= now - 4; y--) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    ySel.appendChild(o);
  }

  // Populate hour selects
  ['h-from', 'h-to'].forEach(id => {
    const sel = document.getElementById(id);
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      const o  = document.createElement('option');
      o.value = hh;
      o.textContent = `${hh}:00`;
      sel.appendChild(o);
    }
  });

  buildHourGrid();
  updateQueryPreview();
});

/* ═══════════════════════════════════════════════════════════════
   LOCATION / CAMERA
═══════════════════════════════════════════════════════════════ */
function onLocationChange() {
  const locId  = document.getElementById('sel-location').value;
  const camSel = document.getElementById('sel-camera');

  camSel.innerHTML = '<option value="">— Select Camera —</option>';
  camSel.disabled  = !locId;

  if (locId) {
    const loc = window.CCTV_CONFIG.locations.find(l => l.id === locId);
    if (loc) {
      loc.cameras.forEach(cam => {
        const o = document.createElement('option');
        o.value = cam.id; o.textContent = cam.name;
        camSel.appendChild(o);
      });
    }
  }

  updateQueryPreview();
  checkFetchReady();
}

/* ═══════════════════════════════════════════════════════════════
   DATE CONTROLS
═══════════════════════════════════════════════════════════════ */
function onDateChange() {
  const y = document.getElementById('sel-year').value;
  const m = document.getElementById('sel-month').value;

  // Rebuild day dropdown
  if (y && m) {
    const days   = new Date(parseInt(y), parseInt(m), 0).getDate();
    const daySel = document.getElementById('sel-day');
    const prev   = daySel.value;
    daySel.innerHTML = '<option value="">Select Day</option>';
    for (let d = 1; d <= days; d++) {
      const dd = String(d).padStart(2, '0');
      const o  = document.createElement('option');
      o.value = dd; o.textContent = dd;
      if (dd === prev) o.selected = true;
      daySel.appendChild(o);
    }
  }

  updateQueryPreview();
  checkFetchReady();
}

/* ═══════════════════════════════════════════════════════════════
   HOUR CONTROLS
═══════════════════════════════════════════════════════════════ */
function onHourChange() {
  highlightHourGrid();
  updateQueryPreview();
  checkFetchReady();
}

function buildHourGrid() {
  const grid = document.getElementById('hour-grid');
  for (let h = 0; h < 24; h++) {
    const hh  = String(h).padStart(2, '0');
    const div = document.createElement('div');
    div.className = 'hc';
    div.id        = `hc-${hh}`;
    div.textContent = hh;
    div.title     = `${hh}:00`;
    grid.appendChild(div);
  }
}

function highlightHourGrid() {
  const from = document.getElementById('h-from').value;
  const to   = document.getElementById('h-to').value;

  for (let h = 0; h < 24; h++) {
    const hh  = String(h).padStart(2, '0');
    const el  = document.getElementById(`hc-${hh}`);
    if (!el) continue;
    el.className = 'hc';

    if (from && to && from <= to) {
      if (hh === from || hh === to) el.classList.add('cap');
      else if (hh > from && hh < to) el.classList.add('in-range');
    } else if (from && hh === from) {
      el.classList.add('cap');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   QUERY PREVIEW
═══════════════════════════════════════════════════════════════ */
function updateQueryPreview() {
  const loc  = document.getElementById('sel-location').value  || '…';
  const cam  = document.getElementById('sel-camera').value    || '…';
  const y    = document.getElementById('sel-year').value      || 'YYYY';
  const m    = document.getElementById('sel-month').value     || 'MM';
  const d    = document.getElementById('sel-day').value       || 'DD';
  const hf   = document.getElementById('h-from').value        || 'HH';
  const ht   = document.getElementById('h-to').value          || 'HH';
  const box  = document.getElementById('q-preview');

  const hoursStr = (hf !== 'HH' && ht !== 'HH' && hf <= ht)
    ? `<span class="qt">${hf}00.mp4 → ${ht}00.mp4</span>`
    : `<span class="qt">HHMM.mp4</span>`;

  box.innerHTML =
    `s3://<span class="ql">{bucket}</span>/\n` +
    `  <span class="ql">${loc}</span>/\n` +
    `    <span class="qc">${cam}</span>/\n` +
    `      <span class="qd">${y}/${m}/${d}</span>/\n` +
    `        ${hoursStr}`;
}

/* ═══════════════════════════════════════════════════════════════
   FETCH READY CHECK
═══════════════════════════════════════════════════════════════ */
function checkFetchReady() {
  const loc = document.getElementById('sel-location').value;
  const cam = document.getElementById('sel-camera').value;
  const y   = document.getElementById('sel-year').value;
  const m   = document.getElementById('sel-month').value;
  const d   = document.getElementById('sel-day').value;
  const hf  = document.getElementById('h-from').value;
  const ht  = document.getElementById('h-to').value;

  const ready = loc && cam && y && m && d && hf && ht;
  document.getElementById('fetch-btn').disabled = !ready;
}

/* ═══════════════════════════════════════════════════════════════
   FETCH
═══════════════════════════════════════════════════════════════ */
async function doFetch() {
  const loc  = document.getElementById('sel-location').value;
  const cam  = document.getElementById('sel-camera').value;
  const y    = document.getElementById('sel-year').value;
  const m    = document.getElementById('sel-month').value;
  const d    = document.getElementById('sel-day').value;
  const hf   = document.getElementById('h-from').value;
  const ht   = document.getElementById('h-to').value;

  if (!loc || !cam || !y || !m || !d || !hf || !ht) {
    toast('Please fill in all fields', 'err'); return;
  }
  if (hf > ht) {
    toast('"From" hour must be ≤ "To" hour', 'err'); return;
  }

  // Show loading
  document.getElementById('empty-state').style.display   = 'none';
  document.getElementById('media-grid').innerHTML         = '';
  document.getElementById('list-hdr').style.display      = 'none';
  document.getElementById('loading-state').classList.add('show');
  document.getElementById('result-bar').classList.remove('show');
  document.getElementById('fetch-btn').disabled           = true;

  // Animate progress bar
  const pf     = document.getElementById('ls-pf');
  const steps  = ['Querying DynamoDB index…','Building S3 object list…','Generating signed URLs…','Loading metadata…'];
  let   step   = 0;
  const ticker = setInterval(() => {
    step++;
    document.getElementById('ls-txt').textContent = 'Fetching from S3…';
    document.getElementById('ls-sub').textContent = steps[Math.min(step, steps.length-1)];
    pf.style.width = Math.min(step * 25, 90) + '%';
  }, 400);

  try {
    let items;
    if (S.isDemoMode) {
      await new Promise(r => setTimeout(r, 1800));
      items = generateDemoData(loc, cam, y, m, d, hf, ht);
    } else {
      items = await fetchFromAPI(loc, cam, y, m, d, hf, ht);
    }

    clearInterval(ticker);
    pf.style.width = '100%';

    await new Promise(r => setTimeout(r, 200));

    S.allItems  = items;
    S.selected.clear();
    applyFilters();
    updateStats(items, hf, ht);

    // Show result bar
    document.getElementById('result-bar-txt').textContent =
      `${items.length} video${items.length !== 1 ? 's' : ''} found for ${y}-${m}-${d} ${hf}:00–${ht}:59`;
    document.getElementById('result-bar').classList.add('show');
    toast(`Found ${items.length} videos`, items.length > 0 ? 'ok' : 'inf');

  } catch(e) {
    clearInterval(ticker);
    console.error(e);
    toast('Fetch failed: ' + e.message, 'err');
    document.getElementById('empty-state').style.display = 'block';
  } finally {
    document.getElementById('loading-state').classList.remove('show');
    document.getElementById('fetch-btn').disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   API CALL (production)
═══════════════════════════════════════════════════════════════ */
async function fetchFromAPI(loc, cam, y, m, d, hf, ht) {
  const cfg = window.CCTV_CONFIG;
  const qs  = new URLSearchParams({ location:loc, camera:cam, year:y, month:m, day:d, fromHour:hf, toHour:ht });
  const res = await fetch(`${cfg.apiEndpoint}/videos?${qs}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

/* ═══════════════════════════════════════════════════════════════
   DEMO DATA GENERATOR
═══════════════════════════════════════════════════════════════ */
function generateDemoData(loc, cam, y, m, d, hf, ht) {
  const cfg    = window.CCTV_CONFIG;
  const locObj = cfg.locations.find(l => l.id === loc);
  const camObj = locObj?.cameras.find(c => c.id === cam);
  const items  = [];

  const fromH = parseInt(hf);
  const toH   = parseInt(ht);
  const sizes  = [512, 768, 1024, 1280, 1536, 2048]; // MB

  for (let h = fromH; h <= toH; h++) {
    const hh     = String(h).padStart(2, '00');
    const sizeMB = sizes[Math.floor(Math.random() * sizes.length)];
    items.push({
      key:          `${loc}/${cam}/${y}/${m}/${d}/${hh}00.mp4`,
      filename:     `${hh}00.mp4`,
      location:     locObj?.name || loc,
      locationId:   loc,
      camera:       camObj?.name || cam,
      cameraId:     cam,
      date:         `${y}-${m}-${d}`,
      hour:         hh,
      timestamp:    `${y}-${m}-${d}T${hh}:00:00Z`,
      durationSecs: 3600,
      sizeMB:       sizeMB,
      signedUrl:    '#demo',   // replaced by real CloudFront URL in production
      s3Path:       `s3://{bucket}/${loc}/${cam}/${y}/${m}/${d}/${hh}00.mp4`,
    });
  }
  return items;
}

/* ═══════════════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════════════ */
function updateStats(items, hf, ht) {
  document.getElementById('st-count').textContent = items.length;
  const totalMB  = items.reduce((s, i) => s + (i.sizeMB || 0), 0);
  const totalHrs = items.reduce((s, i) => s + (i.durationSecs || 3600) / 3600, 0);
  document.getElementById('st-dur').textContent  = totalHrs.toFixed(1) + 'h';
  document.getElementById('st-size').textContent = totalMB >= 1024
    ? (totalMB / 1024).toFixed(1) + ' GB'
    : totalMB.toFixed(0) + ' MB';
  document.getElementById('st-span').textContent =
    hf && ht ? `${parseInt(ht) - parseInt(hf) + 1}h` : '—';
}

/* ═══════════════════════════════════════════════════════════════
   FILTERS & RENDER
═══════════════════════════════════════════════════════════════ */
function setTypeFilter(t) {
  S.typeFilter = t;
  ['all','video'].forEach(x => {
    document.getElementById('tf-' + x)?.classList.toggle('on', x === t);
  });
  applyFilters();
}

function filterResults() { applyFilters(); }

function applyFilters() {
  const q = (document.getElementById('search-inp')?.value || '').toLowerCase();
  S.viewItems = S.allItems.filter(item => {
    if (S.typeFilter !== 'all' && item.type && item.type !== S.typeFilter) return false;
    if (q && !item.filename.toLowerCase().includes(q) && !item.camera.toLowerCase().includes(q)) return false;
    return true;
  });

  document.getElementById('result-count').textContent =
    S.viewItems.length + ' video' + (S.viewItems.length !== 1 ? 's' : '');

  renderVideos();
  updateSelBar();
}

function setView(v) {
  S.viewMode = v;
  document.getElementById('vt-grid').classList.toggle('on', v === 'grid');
  document.getElementById('vt-list').classList.toggle('on', v === 'list');
  renderVideos();
}

function renderVideos() {
  const grid  = document.getElementById('media-grid');
  const empty = document.getElementById('empty-state');
  const lhdr  = document.getElementById('list-hdr');

  if (!S.viewItems.length) {
    grid.innerHTML    = '';
    empty.style.display = 'block';
    lhdr.style.display  = 'none';
    return;
  }

  empty.style.display = 'none';

  if (S.viewMode === 'grid') {
    grid.className  = 'grid-view';
    lhdr.style.display = 'none';
    grid.innerHTML  = S.viewItems.map((item, i) => buildCard(item, i)).join('');
  } else {
    grid.className  = 'list-view';
    lhdr.style.display = 'grid';
    grid.innerHTML  = S.viewItems.map((item, i) => buildRow(item, i)).join('');
  }
}

/* ── Grid card ── */
function buildCard(item, idx) {
  const sel   = S.selected.has(item.key);
  const delay = Math.min(idx * 30, 500);
  const dur   = fmtDur(item.durationSecs);
  const size  = fmtSize(item.sizeMB);

  return `
  <div class="vcard${sel ? ' selected' : ''}" id="vc-${idx}" style="animation-delay:${delay}ms">
    <div class="vcard-thumb">
      <div class="vcard-thumb-bg">🎥</div>
      <div class="vcard-play" onclick="openPlayer(${idx})">
        <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
      <div class="vcard-hour-badge">${item.hour}:00</div>
      <div class="vcard-dur">${dur}</div>
      <input type="checkbox" class="vcard-sel" ${sel ? 'checked' : ''}
        onchange="toggleSelect(this,${idx})" onclick="event.stopPropagation()" />
    </div>
    <div class="vcard-body">
      <div class="vcard-name" title="${item.filename}">${item.filename}</div>
      <div class="vcard-meta">${item.camera} · ${item.date}</div>
      <div class="vcard-meta" style="margin-top:2px;font-size:9px">${size} · ${item.location}</div>
    </div>
    <div class="vcard-footer">
      <button class="vcf-btn primary" onclick="openPlayer(${idx})">▶ Play</button>
      <button class="vcf-btn" onclick="copyLink(${idx})">🔗 Link</button>
      <button class="vcf-btn" onclick="downloadItem(${idx})">⬇</button>
    </div>
  </div>`;
}

/* ── List row ── */
function buildRow(item, idx) {
  const sel   = S.selected.has(item.key);
  const delay = Math.min(idx * 18, 300);
  return `
  <div class="lrow${sel ? ' selected' : ''}" id="lr-${idx}" style="animation-delay:${delay}ms" onclick="openPlayer(${idx})">
    <div><input type="checkbox" ${sel ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--accent2)"
      onchange="toggleSelect(this,${idx})" onclick="event.stopPropagation()" /></div>
    <div class="lr-name" title="${item.s3Path}">${item.filename}</div>
    <div class="lr-loc">${item.location}</div>
    <div class="lr-cam">${item.camera}</div>
    <div class="lr-size">${fmtSize(item.sizeMB)}</div>
    <div class="lr-dur">${fmtDur(item.durationSecs)}</div>
    <div class="lr-acts" onclick="event.stopPropagation()">
      <button class="la" title="Play" onclick="openPlayer(${idx})">▶</button>
      <button class="la" title="Copy link" onclick="copyLink(${idx})">🔗</button>
      <button class="la" title="Download" onclick="downloadItem(${idx})">⬇</button>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   SELECTION
═══════════════════════════════════════════════════════════════ */
function toggleSelect(cb, idx) {
  const item = S.viewItems[idx];
  if (!item) return;

  if (cb.checked) S.selected.add(item.key);
  else            S.selected.delete(item.key);

  // Highlight card/row
  const card = document.getElementById('vc-' + idx);
  const row  = document.getElementById('lr-' + idx);
  if (card) card.classList.toggle('selected', cb.checked);
  if (row)  row.classList.toggle('selected', cb.checked);

  updateSelBar();
}

function updateSelBar() {
  const n   = S.selected.size;
  const bar = document.getElementById('sel-bar');
  bar.classList.toggle('show', n > 0);
  document.getElementById('sel-cnt').textContent = n;
}

function clearSelection() {
  S.selected.clear();
  updateSelBar();
  renderVideos();
}

/* ═══════════════════════════════════════════════════════════════
   PLAYER MODAL
═══════════════════════════════════════════════════════════════ */
function openPlayer(idx) {
  const item = S.viewItems[idx];
  if (!item) return;
  S.activeItem = item;

  document.getElementById('modal-title').textContent = item.filename;

  // Meta grid
  document.getElementById('modal-meta').innerHTML = `
    <div class="mm-item"><div class="mm-l">Location</div><div class="mm-v">${item.location}</div></div>
    <div class="mm-item"><div class="mm-l">Camera</div><div class="mm-v">${item.camera}</div></div>
    <div class="mm-item"><div class="mm-l">Timestamp</div><div class="mm-v">${item.timestamp || item.date + ' ' + item.hour + ':00'}</div></div>
    <div class="mm-item"><div class="mm-l">Duration / Size</div><div class="mm-v">${fmtDur(item.durationSecs)} · ${fmtSize(item.sizeMB)}</div></div>
  `;

  // Video source
  const vid = document.getElementById('modal-video');
  if (item.signedUrl && item.signedUrl !== '#demo') {
    vid.src = item.signedUrl;
    vid.load();
    vid.play().catch(() => {});
  } else {
    // Demo mode placeholder
    vid.src = '';
    vid.parentElement.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--tx3)">
        <div style="font-size:48px;margin-bottom:14px;opacity:.25">🎥</div>
        <div style="font-size:13px;color:var(--tx2);margin-bottom:8px">Demo Mode — Video Preview</div>
        <div style="font-size:11px;margin-bottom:12px">In production, the CloudFront signed URL streams here.</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--accent3);word-break:break-all;background:var(--panel2);padding:10px;border-radius:7px">
          ${item.s3Path}
        </div>
      </div>`;
  }

  // Footer actions
  document.getElementById('modal-ft').innerHTML = `
    <button class="mfb primary" onclick="downloadItem(${idx})">⬇ Download via CloudFront</button>
    <button class="mfb" onclick="copyLink(${idx})">🔗 Copy Signed URL</button>
    <button class="mfb" style="margin-left:auto" onclick="closeModal()">✕ Close</button>
  `;

  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  const vid = document.getElementById('modal-video');
  if (vid) { vid.pause(); vid.src = ''; }
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ═══════════════════════════════════════════════════════════════
   ACTIONS
═══════════════════════════════════════════════════════════════ */
function copyLink(idx) {
  const item = S.viewItems[idx];
  if (!item) return;
  const url  = item.signedUrl && item.signedUrl !== '#demo'
    ? item.signedUrl
    : `https://${window.CCTV_CONFIG.cloudfrontDomain}/${item.key}`;
  navigator.clipboard?.writeText(url).catch(() => {});
  toast('Signed URL copied to clipboard', 'ok');
}

function copySignedUrls() {
  const urls = [...S.selected].map(key => {
    const item = S.allItems.find(i => i.key === key);
    return item?.signedUrl && item.signedUrl !== '#demo'
      ? item.signedUrl
      : `https://${window.CCTV_CONFIG.cloudfrontDomain}/${key}`;
  });
  navigator.clipboard?.writeText(urls.join('\n')).catch(() => {});
  toast(`${urls.length} signed URLs copied`, 'ok');
}

function downloadItem(idx) {
  const item = S.viewItems[idx];
  if (!item) return;
  if (item.signedUrl && item.signedUrl !== '#demo') {
    const a = document.createElement('a');
    a.href = item.signedUrl;
    a.download = item.filename;
    a.click();
  }
  toast(`Download started: ${item.filename}`, 'inf');
}

function downloadSelected() {
  const selItems = S.allItems.filter(i => S.selected.has(i.key));
  selItems.forEach((item, i) => {
    setTimeout(() => {
      if (item.signedUrl && item.signedUrl !== '#demo') {
        const a = document.createElement('a');
        a.href = item.signedUrl;
        a.download = item.filename;
        a.click();
      }
    }, i * 400);
  });
  toast(`Downloading ${selItems.length} videos…`, 'inf');
}

function exportList() {
  if (!S.viewItems.length) { toast('No videos to export', 'err'); return; }
  const rows = ['Filename,Location,Camera,Date,Hour,Duration,Size MB,S3 Path'];
  S.viewItems.forEach(item => {
    rows.push([
      item.filename, item.location, item.camera,
      item.date, item.hour + ':00',
      fmtDur(item.durationSecs),
      item.sizeMB || '',
      item.s3Path || item.key,
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cctv-export-${Date.now()}.csv`;
  a.click();
  toast(`Exported ${S.viewItems.length} records`, 'ok');
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function fmtDur(secs) {
  if (!secs) return '1h 00m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${String(m).padStart(2,'0')}m`;
}

function fmtSize(mb) {
  if (!mb) return '—';
  return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB';
}

function toast(msg, type = 'inf') {
  const icons = { ok: '✓', err: '✕', inf: 'ℹ' };
  const box   = document.getElementById('toast-box');
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-ico">${icons[type]}</span><span>${msg}</span>`;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
