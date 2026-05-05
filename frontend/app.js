/* ── Physics Sandbox — app.js ── */
'use strict';

const API = '';   // same-origin; Flask serves /experiments

/* ══════════════ UTILITIES ══════════════ */
function fmt(n, dec = 2) { return Number(n).toFixed(dec); }
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '') + ' show';
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

/* ══════════════ TAB SWITCHING ══════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    document.querySelectorAll('.experiment-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected','true');
    document.getElementById(btn.dataset.tab + '-panel').classList.add('active');
  });
});

/* ══════════════ HELPER: slider bind ══════════════ */
function bindSlider(id, displayId, suffix, onchange) {
  const el = document.getElementById(id);
  const dv = document.getElementById(displayId);
  function update() { dv.textContent = el.value + suffix; onchange(); }
  el.addEventListener('input', update);
  return () => parseFloat(el.value);
}

/* ════════════════════════════════════════════════════════
   1.  PROJECTILE MOTION
════════════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('canvas-projectile');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  let angle, vel, grav;
  let running = false, rafId = null, t = 0, trail = [];

  const getAngle = bindSlider('proj-angle','proj-angle-val','°', recalc);
  const getVel   = bindSlider('proj-vel',  'proj-vel-val',  ' m/s', recalc);
  const getGrav  = bindSlider('proj-grav', 'proj-grav-val', ' m/s²', recalc);

  function recalc() {
    angle = getAngle() * Math.PI / 180;
    vel   = getVel();
    grav  = getGrav();
    const vy = vel * Math.sin(angle);
    const vx = vel * Math.cos(angle);
    const T  = 2 * vy / grav;
    const Hm = (vy * vy) / (2 * grav);
    const R  = vx * T;
    document.getElementById('proj-r-height').textContent = fmt(Hm) + ' m';
    document.getElementById('proj-r-range').textContent  = fmt(R)  + ' m';
    document.getElementById('proj-r-time').textContent   = fmt(T)  + ' s';
    if (!running) draw(0);
  }

  function physPos(time) {
    const vx = vel * Math.cos(angle);
    const vy = vel * Math.sin(angle);
    return { x: vx * time, y: vy * time - 0.5 * grav * time * time };
  }

  function toCanvas(px, py) {
    // Use FIXED world-space scales so the arc shape changes with angle.
    // Max range occurs at 45°: R_max = v²/g
    // Max height occurs at 90°: H_max = v²/(2g)
    const worldW = (vel * vel) / grav;          // fixed horizontal scale
    const worldH = (vel * vel) / (2 * grav);    // fixed vertical scale
    const pad = 40;
    const sx = pad + (px / (worldW || 1)) * (W - 2 * pad);
    const sy = H - pad - (py / (worldH * 1.1 || 1)) * (H - 2 * pad);
    return { sx, sy };
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
    for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }
    // ground
    ctx.strokeStyle = 'rgba(0,255,136,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, H-30); ctx.lineTo(W-30, H-30); ctx.stroke();
    // arc path
    const T = 2 * vel * Math.sin(angle) / grav;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,255,136,0.2)';
    ctx.lineWidth = 1.5;
    for (let s = 0; s <= 80; s++) {
      const pt = toCanvas(...Object.values(physPos(s / 80 * T)));
      s === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy);
    }
    ctx.stroke();
    // trail
    trail.forEach((p, i) => {
      const alpha = i / trail.length;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 3 * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,136,${alpha * 0.6})`;
      ctx.fill();
    });
    // ball
    const pp = physPos(time);
    const cp = toCanvas(pp.x, pp.y);
    ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(cp.sx, cp.sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff88'; ctx.fill();
    ctx.shadowBlur = 0;
  }

  function animate() {
    const T = 2 * vel * Math.sin(angle) / grav;
    t += 0.016;
    if (t > T) { t = 0; trail = []; }
    const pp = physPos(t);
    const cp = toCanvas(pp.x, pp.y);
    trail.push(cp); if (trail.length > 40) trail.shift();
    draw(t);
    rafId = requestAnimationFrame(animate);
  }

  document.getElementById('proj-play').onclick  = () => { if (!running) { running = true; animate(); } };
  document.getElementById('proj-pause').onclick = () => { running = false; cancelAnimationFrame(rafId); };
  document.getElementById('proj-reset').onclick = () => { running = false; cancelAnimationFrame(rafId); t = 0; trail = []; recalc(); };

  document.getElementById('proj-save').onclick = async () => {
    const vy = vel * Math.sin(angle); const vx = vel * Math.cos(angle);
    const T  = 2*vy/grav; const Hm = vy*vy/(2*grav); const R = vx*T;
    await saveExperiment('Projectile Motion',
      { angle: fmt(angle*180/Math.PI), velocity: fmt(vel), gravity: fmt(grav) },
      { maxHeight: fmt(Hm), range: fmt(R), timeOfFlight: fmt(T) });
  };

  recalc();
})();

/* ════════════════════════════════════════════════════════
   2.  PENDULUM
════════════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('canvas-pendulum');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  let L, startAngle, grav;
  let running = false, rafId = null;
  let theta, omega = 0, prevTheta = [];

  const getL     = bindSlider('pend-len',  'pend-len-val',   ' m',   recalc);
  const getAng   = bindSlider('pend-angle','pend-angle-val', '°',    recalc);
  const getGrav  = bindSlider('pend-grav', 'pend-grav-val',  ' m/s²',recalc);

  function recalc() {
    L = getL(); startAngle = getAng() * Math.PI / 180; grav = getGrav();
    const T = 2 * Math.PI * Math.sqrt(L / grav);
    const F = 1 / T;
    document.getElementById('pend-r-period').textContent = fmt(T) + ' s';
    document.getElementById('pend-r-freq').textContent   = fmt(F) + ' Hz';
    if (!running) { theta = startAngle; omega = 0; prevTheta = []; draw(); }
  }

  const pivot = { x: W / 2, y: 60 };
  const SCALE = 90; // px per meter of rope

  function bobPos(th) {
    return { x: pivot.x + Math.sin(th) * L * SCALE, y: pivot.y + Math.cos(th) * L * SCALE };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
    for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }
    // pivot
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(pivot.x, pivot.y, 5, 0, Math.PI*2); ctx.fill();
    // trail blur
    prevTheta.forEach((th, i) => {
      const b = bobPos(th);
      const alpha = (i / prevTheta.length) * 0.4;
      ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI*2);
      ctx.fillStyle = `rgba(0,170,255,${alpha})`; ctx.fill();
    });
    // rope
    const bob = bobPos(theta);
    ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(bob.x, bob.y);
    ctx.strokeStyle = 'rgba(0,170,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    // bob
    ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(bob.x, bob.y, 14, 0, Math.PI*2);
    ctx.fillStyle = '#00aaff'; ctx.fill();
    ctx.shadowBlur = 0;
  }

  const DT = 0.016;
  function animate() {
    const alpha = -(grav / L) * Math.sin(theta);
    omega += alpha * DT;
    omega *= 0.9995; // tiny damping
    theta += omega * DT;
    prevTheta.push(theta); if (prevTheta.length > 18) prevTheta.shift();
    draw();
    rafId = requestAnimationFrame(animate);
  }

  document.getElementById('pend-play').onclick  = () => { if (!running) { running = true; animate(); } };
  document.getElementById('pend-pause').onclick = () => { running = false; cancelAnimationFrame(rafId); };
  document.getElementById('pend-reset').onclick = () => {
    running = false; cancelAnimationFrame(rafId);
    theta = startAngle; omega = 0; prevTheta = []; recalc();
  };

  document.getElementById('pend-save').onclick = async () => {
    const T = 2 * Math.PI * Math.sqrt(L / grav);
    await saveExperiment('Pendulum',
      { length: fmt(L), gravity: fmt(grav) },
      { period: fmt(T), frequency: fmt(1/T) });
  };

  recalc();
})();

/* ════════════════════════════════════════════════════════
   3.  FREE FALL
════════════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('canvas-freefall');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  let height, grav;
  let running = false, rafId = null, t = 0;

  const getH    = bindSlider('ff-height','ff-height-val',' m',   recalc);
  const getGrav = bindSlider('ff-grav',  'ff-grav-val',  ' m/s²',recalc);

  function recalc() {
    height = getH(); grav = getGrav();
    const T = Math.sqrt(2 * height / grav);
    const Vf = grav * T;
    document.getElementById('ff-r-time').textContent = fmt(T) + ' s';
    document.getElementById('ff-r-vel').textContent  = fmt(Vf) + ' m/s';
    if (!running) { t = 0; draw(0); }
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
    for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }

    const T    = Math.sqrt(2 * height / grav);
    const prog = Math.min(time / T, 1);
    const y    = 0.5 * grav * (time * time);
    const curV = grav * Math.min(time, T);

    const pad = 40;
    const topY  = pad;
    const botY  = H - pad;
    const ballY = topY + prog * (botY - topY - 16);
    const ballX = W / 2;

    // height ruler
    ctx.strokeStyle = 'rgba(255,102,0,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(ballX, topY); ctx.lineTo(ballX, botY); ctx.stroke();
    ctx.setLineDash([]);

    // ground
    ctx.strokeStyle = 'rgba(255,102,0,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad, botY); ctx.lineTo(W-pad, botY); ctx.stroke();

    // velocity bar
    const barH = prog * (H - 2*pad) * 0.6;
    const barX = W - 60;
    ctx.fillStyle = 'rgba(255,102,0,0.15)';
    ctx.fillRect(barX, botY - barH, 16, barH);
    ctx.strokeStyle = 'rgba(255,102,0,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(barX, botY - (H-2*pad)*0.6, 16, (H-2*pad)*0.6);
    ctx.fillStyle = 'rgba(255,102,0,0.8)'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
    ctx.fillText(fmt(curV,1)+' m/s', barX+8, botY - barH - 6);

    // ball
    ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(ballX, ballY, 12, 0, Math.PI*2);
    ctx.fillStyle = '#ff6600'; ctx.fill();
    ctx.shadowBlur = 0;
  }

  function animate() {
    const T = Math.sqrt(2 * height / grav);
    t += 0.016;
    if (t > T + 0.5) t = 0;
    draw(t);
    rafId = requestAnimationFrame(animate);
  }

  document.getElementById('ff-play').onclick  = () => { if (!running) { running = true; animate(); } };
  document.getElementById('ff-pause').onclick = () => { running = false; cancelAnimationFrame(rafId); };
  document.getElementById('ff-reset').onclick = () => { running = false; cancelAnimationFrame(rafId); t = 0; recalc(); };

  document.getElementById('ff-save').onclick = async () => {
    const T = Math.sqrt(2 * height / grav);
    await saveExperiment('Free Fall',
      { height: fmt(height), gravity: fmt(grav) },
      { timeToFall: fmt(T), finalVelocity: fmt(grav*T) });
  };

  recalc();
})();

/* ════════════════════════════════════════════════════════
   4.  SPRING / HOOKE'S LAW
════════════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('canvas-spring');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  let k, disp;
  let running = false, rafId = null, animT = 0;

  const getK    = bindSlider('sp-k',   'sp-k-val',    ' N/m',recalc);
  const getDisp = bindSlider('sp-disp','sp-disp-val', ' m',  recalc);

  function recalc() {
    k = getK(); disp = getDisp();
    const F  = k * disp;
    const PE = 0.5 * k * disp * disp;
    document.getElementById('sp-r-force').textContent  = fmt(F)  + ' N';
    document.getElementById('sp-r-energy').textContent = fmt(PE) + ' J';
    if (!running) draw(disp);
  }

  function drawSpring(ctx, x1, y, x2, coils, color) {
    const len    = x2 - x1;
    const cStep  = len / coils;
    const amp    = 18;
    ctx.beginPath(); ctx.moveTo(x1, y);
    for (let c = 0; c < coils; c++) {
      const bx = x1 + c * cStep;
      ctx.bezierCurveTo(bx + cStep*0.25, y - amp, bx + cStep*0.5, y - amp, bx + cStep*0.5, y);
      ctx.bezierCurveTo(bx + cStep*0.5, y + amp, bx + cStep*0.75, y + amp, bx + cStep, y);
    }
    ctx.lineTo(x2, y);
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
  }

  function draw(currentDisp) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
    for (let j = 0; j < H; j += 40) { ctx.beginPath(); ctx.moveTo(0,j); ctx.lineTo(W,j); ctx.stroke(); }

    const wallX   = 40;
    const restX   = W * 0.55;
    const dispPx  = currentDisp * 140;
    const bobX    = restX + dispPx;
    const cy      = H / 2;

    // wall
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(wallX - 12, cy - 60, 12, 120);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(wallX-12, cy-60 + i*15);
      ctx.lineTo(wallX, cy-60 + i*15 + 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth=1; ctx.stroke();
    }

    // equilibrium dashed line
    ctx.setLineDash([5,5]);
    ctx.strokeStyle = 'rgba(255,0,255,0.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(restX, cy-50); ctx.lineTo(restX, cy+50); ctx.stroke();
    ctx.setLineDash([]);

    // spring
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 8;
    drawSpring(ctx, wallX, cy, bobX, 8, 'rgba(255,0,255,0.85)');
    ctx.shadowBlur = 0;

    // bob
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(bobX, cy, 18, 0, Math.PI*2);
    ctx.fillStyle = '#ff00ff'; ctx.fill();
    ctx.shadowBlur = 0;

    // displacement arrow
    if (Math.abs(dispPx) > 5) {
      ctx.strokeStyle = 'rgba(255,0,255,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(restX, cy + 40);
      ctx.lineTo(bobX, cy + 40);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,0,255,0.8)';
      ctx.font = '11px Inter'; ctx.textAlign = 'center';
      ctx.fillText('x = ' + fmt(currentDisp) + ' m', (restX+bobX)/2, cy+56);
    }

    // force label
    const F = k * disp;
    ctx.fillStyle = 'rgba(255,0,255,0.7)'; ctx.font = '12px Inter'; ctx.textAlign = 'left';
    ctx.fillText('F = ' + fmt(F) + ' N', wallX+8, cy - 70);
  }

  function animate() {
    const omega0 = Math.sqrt(k / 1);        // assume mass=1 kg
    const d = disp * Math.cos(omega0 * animT);
    animT += 0.016;
    draw(d);
    rafId = requestAnimationFrame(animate);
  }

  document.getElementById('sp-play').onclick  = () => { if (!running) { running = true; animT = 0; animate(); } };
  document.getElementById('sp-pause').onclick = () => { running = false; cancelAnimationFrame(rafId); };
  document.getElementById('sp-reset').onclick = () => { running = false; cancelAnimationFrame(rafId); animT = 0; recalc(); };

  document.getElementById('sp-save').onclick = async () => {
    await saveExperiment("Spring / Hooke's Law",
      { springConstant: fmt(k), displacement: fmt(disp) },
      { force: fmt(k*disp), potentialEnergy: fmt(0.5*k*disp*disp) });
  };

  recalc();
})();

/* ══════════════ API HELPERS ══════════════ */
async function saveExperiment(name, parameters, result) {
  try {
    const res = await fetch(API + '/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment: name, parameters, result })
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    showToast('✅ Experiment saved!');
    loadResults();
  } catch (e) {
    showToast('❌ Failed to save: ' + e.message, true);
  }
}

async function loadResults() {
  try {
    const res = await fetch(API + '/experiments');
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    renderTable(data);
  } catch (e) {
    console.error('Load error:', e);
  }
}

async function deleteExperiment(id) {
  try {
    const res = await fetch(API + '/experiments/' + id, { method: 'DELETE' });
    if (!res.ok) throw new Error('Server error');
    showToast('🗑️ Deleted');
    loadResults();
  } catch (e) {
    showToast('❌ Delete failed: ' + e.message, true);
  }
}

/* ══════════════ TABLE RENDER ══════════════ */
const BADGE_CLASS = {
  'Projectile Motion': 'projectile',
  'Pendulum': 'pendulum',
  'Free Fall': 'freefall',
  "Spring / Hooke's Law": 'spring'
};

function renderTable(data) {
  const tbody = document.getElementById('results-tbody');
  document.getElementById('result-count').textContent = data.length;
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="icon">🔭</span>No experiments saved yet. Run a simulation and click <strong>Save Result</strong>.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((row, i) => {
    const cls = BADGE_CLASS[row.experiment] || 'projectile';
    const params = Object.entries(row.parameters).map(([k,v]) => `<span><strong>${k}:</strong> ${v}</span>`).join('');
    const results = Object.entries(row.result).map(([k,v]) => `<span><strong>${k}:</strong> ${v}</span>`).join('');
    const ts = new Date(row.timestamp).toLocaleString();
    return `<tr>
      <td>${i + 1}</td>
      <td><span class="exp-badge ${cls}">${row.experiment}</span></td>
      <td><div class="param-list">${params}</div></td>
      <td><div class="result-list">${results}</div></td>
      <td class="ts-cell">${ts}</td>
      <td><button class="delete-btn" onclick="deleteExperiment('${row.id}')">🗑 Delete</button></td>
    </tr>`;
  }).join('');
}

document.getElementById('refresh-btn').addEventListener('click', loadResults);

// Initial load
loadResults();
