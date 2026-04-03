/**
 * Memorial 앱 아이콘 생성 스크립트
 *
 * 사용법:
 *   npm install canvas   (한 번만 설치)
 *   node scripts/generate-icons.js
 *
 * 생성되는 파일:
 *   assets/icon.png          1024x1024  (앱 아이콘)
 *   assets/adaptive-icon.png 1024x1024  (Android 어댑티브)
 *   assets/splash-icon.png   1242x2436  (스플래시 화면)
 *   assets/favicon.png        64x64     (웹 파비콘)
 *
 * canvas 설치가 어려울 경우 온라인 도구 사용:
 *   https://www.canva.com  또는  https://www.figma.com
 *   아이콘 색상: #5c4a3a (main), #c4956a (point), #f7f3ee (bg)
 */

const path = require('path');
const fs = require('fs');

let createCanvas;
try {
  ({ createCanvas } = require('canvas'));
} catch {
  console.error('canvas 패키지가 없어. 설치 후 다시 실행해줘:');
  console.error('  npm install canvas');
  process.exit(1);
}

const COLORS = {
  bg: '#f7f3ee',
  main: '#5c4a3a',
  point: '#c4956a',
  darkBg: '#1a1a2e',
};

// 별 모양 그리기 헬퍼
function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerR);
  ctx.closePath();
}

// 메인 아이콘 그리기 (1024x1024)
function drawIcon(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  // 배경 그라디언트
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2a1f3d');
  grad.addColorStop(1, COLORS.darkBg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 둥근 모서리 마스크 (iOS 스타일)
  const r = w * 0.22;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // 배경 재 적용 (마스크 후)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.clip();

  const grad2 = ctx.createLinearGradient(0, 0, 0, h);
  grad2.addColorStop(0, '#2a1f3d');
  grad2.addColorStop(1, COLORS.darkBg);
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, w, h);

  // 작은 별들 (배경 장식)
  const stars = [
    [0.2, 0.15, 6], [0.8, 0.12, 5], [0.15, 0.75, 5],
    [0.85, 0.7, 6], [0.5, 0.08, 4], [0.92, 0.45, 5],
  ];
  stars.forEach(([rx, ry, size]) => {
    ctx.fillStyle = 'rgba(196, 149, 106, 0.4)';
    drawStar(ctx, rx * w, ry * h, 5, size * (w / 200), size * (w / 500));
    ctx.fill();
  });

  // 중앙 큰 별 (포인트 컬러)
  ctx.fillStyle = COLORS.point;
  ctx.shadowColor = COLORS.point;
  ctx.shadowBlur = w * 0.08;
  drawStar(ctx, cx, cy - h * 0.05, 5, w * 0.22, w * 0.09);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 텍스트 "M" (Memorial)
  ctx.fillStyle = COLORS.bg;
  ctx.font = `bold ${w * 0.18}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', cx, cy + h * 0.28);

  ctx.restore();
}

// 스플래시 그리기 (1242x2436)
function drawSplash(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2a1f3d');
  grad.addColorStop(1, COLORS.darkBg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 중앙 별
  ctx.fillStyle = COLORS.point;
  ctx.shadowColor = COLORS.point;
  ctx.shadowBlur = w * 0.1;
  drawStar(ctx, cx, cy - h * 0.04, 5, w * 0.15, w * 0.06);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 앱 이름
  ctx.fillStyle = COLORS.bg;
  ctx.font = `bold ${w * 0.14}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Memorial', cx, cy + h * 0.12);
}

function save(canvas, filename) {
  const out = fs.createWriteStream(path.join(__dirname, '..', 'assets', filename));
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', () => console.log(`✓ assets/${filename}`));
}

// 생성
const icon = createCanvas(1024, 1024);
drawIcon(icon);
save(icon, 'icon.png');

const adaptive = createCanvas(1024, 1024);
drawIcon(adaptive);
save(adaptive, 'adaptive-icon.png');

const splash = createCanvas(1242, 2436);
drawSplash(splash);
save(splash, 'splash-icon.png');

const favicon = createCanvas(64, 64);
drawIcon(favicon);
save(favicon, 'favicon.png');

console.log('\n아이콘 생성 완료! assets/ 폴더를 확인해줘.');
