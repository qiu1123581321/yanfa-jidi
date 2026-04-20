// 转盘抽奖器 - popup.js
'use strict';

const DEFAULT_PRIZES = [
  { name: '一等奖：iPhone 15 Pro', weight: 1, color: '#ffd700' },
  { name: '二等奖：AirPods Pro', weight: 3, color: '#c0c0c0' },
  { name: '三等奖：购物券 200 元', weight: 10, color: '#cd7f32' },
  { name: '四等奖：20 元红包', weight: 20, color: '#4a90e2' },
  { name: '五等奖：5 元红包', weight: 50, color: '#50c850' },
  { name: '参与奖：积分 100', weight: 100, color: '#9999bb' },
];

const WHEEL_COLORS = [
  '#1a1a2e', '#16213e', '#0f3460', '#1e3a5f',
  '#2d4a6f', '#3d5a7f', '#4d6a8f', '#1a2a3f',
];

let prizes = [];
let isSpinning = false;
let currentRotation = 0;

// --- 初始化 ---
async function init() {
  const stored = await chrome.storage.local.get('prizes');
  prizes = stored.prizes && stored.prizes.length > 0
    ? stored.prizes
    : DEFAULT_PRIZES.map(p => ({ name: p.name, weight: p.weight }));

  const canvas = document.getElementById('wheelCanvas');
  if (!canvas) return;
  drawWheel(prizes, canvas, 0);

  document.getElementById('spinBtn').addEventListener('click', startSpin);
  document.getElementById('editBtn').addEventListener('click', openEditor);
}

// --- 绘制转盘 ---
function drawWheel(prizeList, canvas, rotation) {
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx - 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  const totalWeight = prizeList.reduce((s, p) => s + (p.weight || 1), 0);
  const sliceCount = prizeList.length;

  prizeList.forEach((prize, i) => {
    const startAngle = (i / sliceCount) * Math.PI * 2 - Math.PI / 2;
    const endAngle = ((i + 1) / sliceCount) * Math.PI * 2 - Math.PI / 2;
    const probability = (prize.weight || 1) / totalWeight;

    // 扇形
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, startAngle, endAngle);
    ctx.closePath();
    const colorIdx = i % WHEEL_COLORS.length;
    ctx.fillStyle = WHEEL_COLORS[colorIdx];
    ctx.fill();

    // 边框
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 文字（带概率）
    const midAngle = (startAngle + endAngle) / 2;
    const probPct = (probability * 100).toFixed(1);
    const labelLines = [`${prize.name}`, `(${probPct}%)`];

    ctx.save();
    ctx.rotate(midAngle);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    labelLines.forEach((line, li) => {
      const offset = li === 0 ? -16 : 0;
      ctx.fillStyle = li === 0 ? '#ffffff' : '#ffd700';
      ctx.font = `bold ${li === 0 ? 12 : 10}px "Microsoft YaHei", sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(line, radius - 12, offset);
    });
    ctx.restore();
  });

  // 中心圆
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  grad.addColorStop(0, '#ffd700');
  grad.addColorStop(1, '#b8860b');
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#fff8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 中心文字
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('抽奖', 0, 0);

  ctx.restore();
}

// --- 抽奖逻辑 ---
async function startSpin() {
  if (isSpinning) return;
  isSpinning = true;

  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  document.getElementById('resultBox').classList.add('hidden');

  const canvas = document.getElementById('wheelCanvas');
  const totalWeight = prizes.reduce((s, p) => s + (p.weight || 1), 0);

  // 加权随机抽取
  let rand = Math.random() * totalWeight;
  let selectedIdx = 0;
  for (let i = 0; i < prizes.length; i++) {
    rand -= (prizes[i].weight || 1);
    if (rand <= 0) { selectedIdx = i; break; }
  }

  const sliceAngle = (Math.PI * 2) / prizes.length;
  const targetAngle = -(
    selectedIdx * sliceAngle +
    sliceAngle / 2 +
    Math.PI / 2
  );

  // 多转几圈 + 精确落点
  const extraSpins = (4 + Math.floor(Math.random() * 3)) * Math.PI * 2;
  const targetRotation = currentRotation + extraSpins + targetAngle - (currentRotation % (Math.PI * 2));

  const duration = 4000 + Math.floor(Math.random() * 1000);
  const startTime = performance.now();
  const startRotation = currentRotation;

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuint(progress);
    currentRotation = startRotation + (targetRotation - startRotation) * eased;
    drawWheel(prizes, canvas, currentRotation);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      currentRotation = targetRotation;
      drawWheel(prizes, canvas, currentRotation);
      showResult(prizes[selectedIdx].name);
    }
  }

  requestAnimationFrame(animate);
}

function showResult(prizeName) {
  isSpinning = false;
  document.getElementById('spinBtn').disabled = false;
  document.getElementById('resultPrize').textContent = prizeName;
  document.getElementById('resultBox').classList.remove('hidden');
}

// --- 编辑面板 ---
function openEditor() {
  const panel = document.getElementById('editorPanel');
  const list = document.getElementById('prizeList');
  panel.classList.remove('hidden');
  document.getElementById('resultBox').classList.add('hidden');

  renderPrizeList(prizes, list);
}

function renderPrizeList(list, container) {
  container.innerHTML = '';
  list.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'prize-item';
    div.innerHTML = `
      <input type="text" class="prize-name" value="${escHtml(p.name)}" placeholder="奖品名称">
      <input type="number" class="prize-weight" value="${p.weight || 1}" min="1" max="9999" title="权重（越大概率越高）">
      <button class="btn-del" data-idx="${i}">×</button>
    `;
    div.querySelector('.btn-del').addEventListener('click', () => {
      list.splice(i, 1);
      renderPrizeList(list, container);
    });
    container.appendChild(div);
  });
}

document.addEventListener('click', e => {
  if (e.target.id === 'addPrizeBtn') {
    prizes.push({ name: '新奖品', weight: 10 });
    renderPrizeList(prizes, document.getElementById('prizeList'));
  }
  if (e.target.id === 'saveBtn') {
    const items = document.querySelectorAll('.prize-item');
    prizes = Array.from(items).map(item => ({
      name: item.querySelector('.prize-name').value.trim() || '未命名',
      weight: Math.max(1, parseInt(item.querySelector('.prize-weight').value) || 1),
    }));
    chrome.storage.local.set({ prizes });
    drawWheel(prizes, document.getElementById('wheelCanvas'), currentRotation);
    document.getElementById('editorPanel').classList.add('hidden');
  }
  if (e.target.id === 'cancelBtn') {
    document.getElementById('editorPanel').classList.add('hidden');
  }
  if (e.target.id === 'closeResult') {
    document.getElementById('resultBox').classList.add('hidden');
  }
});

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 启动
init();
