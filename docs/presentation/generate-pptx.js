const pptxgen = require('pptxgenjs');
const path = require('path');

const ICON = (name) => path.join(__dirname, 'icons', `${name}.png`);

// ---------- PALETTE ----------
const BG      = '060B16';
const PANEL   = '0E1A2E';
const PANEL2  = '132542';
const LINE    = '22334F';
const CYAN    = '2DE0FF';
const CYAN_D  = '0FA8C7';
const BLUE    = '4C7CF0';
const RED     = 'FF4D5E';
const GREEN   = '35D0A0';
const WHITE   = 'F3F7FC';
const MUTED   = '90A3C0';
const MUTED2  = '5F7392';

const FONT_H = 'Arial';
const FONT_B = 'Calibri';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
const PW = 13.333, PH = 7.5;

function bgDark(slide, opts = {}) {
  slide.background = { color: BG };
  slide.addShape('ellipse', { x: PW - 4.2, y: -2.5, w: 7, h: 7, fill: { color: CYAN, transparency: 94 }, line: { type: 'none' } });
  slide.addShape('ellipse', { x: -3, y: PH - 3.2, w: 6, h: 6, fill: { color: BLUE, transparency: 95 }, line: { type: 'none' } });
}

function kicker(slide, text, x = 0.6, y = 0.38, color = CYAN) {
  slide.addText(text.toUpperCase(), {
    x, y, w: 8, h: 0.32, fontFace: FONT_B, fontSize: 12, bold: true,
    color, charSpacing: 3, align: 'left', isTextBox: true, margin: 0,
  });
}

function title(slide, text, opts = {}) {
  slide.addText(text, Object.assign({
    x: 0.6, y: opts.ky !== undefined ? opts.ky : 0.66, w: opts.w || 10.5, h: opts.h || 0.7,
    fontFace: FONT_H, fontSize: opts.size || 30, bold: true, color: WHITE,
    align: 'left', isTextBox: true, margin: 0,
  }, opts));
}

function footer(slide, pageNum) {
  slide.addText('GICVMAP  •  Gujarat Police Innovation Hackathon 2026', {
    x: 0.6, y: PH - 0.42, w: 8, h: 0.3, fontFace: FONT_B, fontSize: 9,
    color: MUTED2, isTextBox: true, margin: 0,
  });
  slide.addText(String(pageNum).padStart(2, '0') + ' / 12', {
    x: PW - 1.3, y: PH - 0.42, w: 0.9, h: 0.3, fontFace: FONT_B, fontSize: 9,
    color: MUTED2, align: 'right', isTextBox: true, margin: 0,
  });
}

function panelCard(slide, x, y, w, h, opts = {}) {
  slide.addShape('roundRect', {
    x, y, w, h, rectRadius: opts.radius || 0.1,
    fill: { color: opts.fill || PANEL, transparency: opts.transparency !== undefined ? opts.transparency : 0 },
    line: { color: opts.line || LINE, width: 1 },
    shadow: opts.noShadow ? undefined : { type: 'outer', color: '000000', opacity: 0.35, blur: 10, offset: 3, angle: 90 },
  });
}

function iconCircle(slide, x, y, d, iconName, opts = {}) {
  const ring = opts.ring || CYAN;
  slide.addShape('ellipse', {
    x, y, w: d, h: d, fill: { color: opts.fill || PANEL2 }, line: { color: ring, width: 1.5 },
  });
  try {
    const pad = d * 0.24;
    slide.addImage({ path: ICON(iconName), x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2 });
  } catch(e) {}
}

function chip(slide, x, y, w, text, opts = {}) {
  slide.addShape('roundRect', {
    x, y, w, h: opts.h || 0.32, rectRadius: 0.16,
    fill: { color: opts.fill || PANEL2 }, line: { color: opts.line || CYAN, width: 0.75 },
  });
  slide.addText(text, {
    x, y, w, h: opts.h || 0.32, align: 'center', valign: 'middle',
    fontFace: FONT_B, fontSize: opts.size || 10.5, bold: true, color: opts.color || CYAN,
    isTextBox: true, margin: 0,
  });
}

function flowArrow(slide, x, y, w, opts = {}) {
  slide.addShape('rightArrow', {
    x, y, w, h: opts.h || 0.16,
    fill: { color: opts.color || CYAN }, line: { type: 'none' },
  });
}

function badge(slide, x, y, text, opts = {}) {
  const w = opts.w || (0.14 * text.length + 0.5);
  slide.addShape('roundRect', {
    x, y, w, h: 0.34, rectRadius: 0.17,
    fill: { color: opts.fill || 'transparent', transparency: opts.fill ? 0 : 100 },
    line: { color: opts.line || CYAN, width: 1 },
  });
  slide.addText(text, {
    x, y, w, h: 0.34, align: 'center', valign: 'middle',
    fontFace: FONT_B, fontSize: 10, bold: true, color: opts.color || CYAN, charSpacing: 1,
    isTextBox: true, margin: 0,
  });
}

// =========================================================
// PAGE 01 — TITLE / HERO
// =========================================================
function buildSlide01() {
  const s = pres.addSlide();
  bgDark(s);
  s.addShape('ellipse', { x: 8.6, y: 1.0, w: 5.6, h: 5.6, fill: { color: CYAN, transparency: 96 }, line: { color: LINE, width: 1 } });
  const nodePts = [
    [9.3, 1.7], [11.6, 1.4], [10.6, 2.9], [12.3, 3.3], [9.6, 4.1],
    [11.3, 4.8], [10.1, 5.9], [12.1, 5.6], [8.9, 3.0],
  ];
  nodePts.forEach(([nx, ny], i) => {
    s.addShape('line', {
      x: nx, y: ny, w: (nodePts[(i + 1) % nodePts.length][0] - nx), h: (nodePts[(i + 1) % nodePts.length][1] - ny),
      line: { color: CYAN, width: 0.75, transparency: 55, dashType: 'sysDot' },
    });
  });
  nodePts.forEach(([nx, ny], i) => {
    const d = i % 3 === 0 ? 0.42 : 0.3;
    s.addShape('ellipse', { x: nx - d / 2, y: ny - d / 2, w: d, h: d, fill: { color: PANEL2 }, line: { color: CYAN, width: 1.25 } });
    s.addImage({ path: ICON('camera'), x: nx - d / 2 + d * 0.22, y: ny - d / 2 + d * 0.22, w: d * 0.56, h: d * 0.56 });
  });
  s.addShape('rect', { x: 10.9, y: 2.55, w: 0.95, h: 0.6, fill: { color: 'transparent', transparency: 100 }, line: { color: GREEN, width: 1.25 } });
  s.addText('VEHICLE 0.94', { x: 10.9, y: 2.32, w: 1.4, h: 0.2, fontFace: FONT_B, fontSize: 7, color: GREEN, isTextBox: true, margin: 0 });
  s.addShape('rect', { x: 9.2, y: 4.35, w: 0.7, h: 0.85, fill: { color: 'transparent', transparency: 100 }, line: { color: CYAN, width: 1.25 } });
  s.addText('PERSON 0.88', { x: 9.2, y: 4.14, w: 1.3, h: 0.2, fontFace: FONT_B, fontSize: 7, color: CYAN, isTextBox: true, margin: 0 });
  badge(s, 0.62, 0.55, 'GUJARAT POLICE INNOVATION HACKATHON 2026', { w: 4.9 });
  s.addText('GICVMAP', {
    x: 0.6, y: 2.55, w: 8.2, h: 1.5, fontFace: FONT_H, fontSize: 64, bold: true, color: WHITE,
    isTextBox: true, margin: 0, charSpacing: 1,
  });
  s.addText('Gujarat Integrated CCTV Video Management\n& Analytics Platform', {
    x: 0.62, y: 3.95, w: 7.6, h: 0.9, fontFace: FONT_B, fontSize: 17, color: MUTED,
    isTextBox: true, margin: 0, lineSpacingMultiple: 1.15,
  });
  s.addShape('line', { x: 0.63, y: 4.98, w: 1.6, h: 0, line: { color: CYAN, width: 2 } });
  s.addText('"See. Think. Act."', {
    x: 0.6, y: 5.12, w: 6, h: 0.5, fontFace: FONT_H, fontSize: 22, italic: true, bold: true, color: CYAN,
    isTextBox: true, margin: 0,
  });
  s.addText('Real-time AI-powered CCTV intelligence for Gujarat Police', {
    x: 0.62, y: 5.66, w: 6.6, h: 0.4, fontFace: FONT_B, fontSize: 13, color: MUTED,
    isTextBox: true, margin: 0,
  });
  footer(s, 1);
}

// =========================================================
// PAGE 02 — THE PROBLEM
// =========================================================
function buildSlide02() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'The Challenge');
  title(s, 'CCTV Sees Everything. But Who Has Time to Watch?', { size: 27, w: 12.1 });
  const cards = [
    { icon: 'grid', h: 'Fragmented Surveillance', d: '30+ cameras operating without a\nunified intelligence layer' },
    { icon: 'clock', h: 'Manual Investigation', d: 'Manual CCTV review\ncan take hours' },
    { icon: 'silo', h: 'Department Silos', d: 'Police and government departments\noperate with isolated information' },
  ];
  const cardW = 3.85, gap = 0.35, startX = 0.6, y = 1.9, cardH = 3.0;
  cards.forEach((c, i) => {
    const x = startX + i * (cardW + gap);
    panelCard(s, x, y, cardW, cardH);
    badge(s, x + 0.3, y + 0.3, '0' + (i + 1), { w: 0.55, color: RED, line: RED });
    iconCircle(s, x + cardW - 1.05, y + 0.28, 0.62, c.icon, { ring: RED });
    s.addText(c.h, { x: x + 0.3, y: y + 1.15, w: cardW - 0.6, h: 0.6, fontFace: FONT_H, fontSize: 16.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addText(c.d, { x: x + 0.3, y: y + 1.75, w: cardW - 0.6, h: 1.0, fontFace: FONT_B, fontSize: 12.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.25 });
  });
  const stripY = 5.25;
  panelCard(s, 0.6, stripY, 12.13, 1.35, { fill: PANEL, transparency: 30 });
  const icons2 = ['camera', 'camera', 'camera', 'person', 'search', 'building', 'building'];
  const labels2 = ['CAM 04', 'CAM 11', 'CAM 22', 'Operator', 'Manual\nSearch', 'RTO Dept', 'Municipal\nDept'];
  const n = icons2.length, iw = 12.13 / n;
  icons2.forEach((ic, i) => {
    const cx = 0.6 + iw * i + iw / 2;
    iconCircle(s, cx - 0.28, stripY + 0.18, 0.56, ic, { ring: i < 3 ? MUTED2 : RED });
    s.addText(labels2[i], { x: cx - 0.65, y: stripY + 0.8, w: 1.3, h: 0.45, align: 'center', fontFace: FONT_B, fontSize: 9, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1 });
    if (i < n - 1) {
      s.addShape('line', { x: cx + 0.35, y: stripY + 0.46, w: iw - 0.7, h: 0, line: { color: LINE, width: 1, dashType: 'sysDash' } });
    }
  });
  s.addText('Raw Video ≠ Actionable Intelligence', {
    x: 0.6, y: 6.85, w: 12.13, h: 0.5, align: 'center', fontFace: FONT_H, fontSize: 19, bold: true, italic: true, color: RED,
    isTextBox: true, margin: 0,
  });
  footer(s, 2);
}

// =========================================================
// PAGE 03 — THE SOLUTION
// =========================================================
function buildSlide03() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'The Solution');
  title(s, 'One Platform. Three Actions.', { size: 30 });
  s.addText('SEE → THINK → ACT', { x: 0.6, y: 1.28, w: 8, h: 0.35, fontFace: FONT_B, fontSize: 13, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 2 });
  const stages = [
    { name: 'SEE', tag: 'Unified Video Intelligence', icon: 'eye', color: BLUE,
      items: ['30-camera VideoWall', 'Live HLS streams', 'Camera GIS map', 'Real-time camera health'] },
    { name: 'THINK', tag: 'AI-Powered Analysis', icon: 'brain', color: CYAN,
      items: ['YOLOv8 object detection', 'EasyOCR license plate recognition', 'Redis event streaming', 'Watchlist matching'] },
    { name: 'ACT', tag: 'Real-Time Response', icon: 'bolt', color: RED,
      items: ['Automated alerts', 'CRITICAL / HIGH severity', 'WebSocket notifications', 'Vehicle search & investigation'] },
  ];
  const cardW = 3.78, gap = 0.28, startX = 0.6, y = 1.95, cardH = 4.05;
  stages.forEach((st, i) => {
    const x = startX + i * (cardW + gap);
    panelCard(s, x, y, cardW, cardH, { fill: PANEL2 });
    iconCircle(s, x + cardW / 2 - 0.4, y + 0.32, 0.8, st.icon, { ring: st.color });
    s.addText(st.name, { x, y: y + 1.28, w: cardW, h: 0.5, align: 'center', fontFace: FONT_H, fontSize: 24, bold: true, color: st.color, isTextBox: true, margin: 0, charSpacing: 2 });
    s.addText(st.tag, { x, y: y + 1.78, w: cardW, h: 0.4, align: 'center', fontFace: FONT_B, fontSize: 12, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addShape('line', { x: x + 0.5, y: y + 2.22, w: cardW - 1, h: 0, line: { color: LINE, width: 1 } });
    st.items.forEach((it, j) => {
      s.addShape('ellipse', { x: x + 0.32, y: y + 2.42 + j * 0.42 + 0.06, w: 0.07, h: 0.07, fill: { color: st.color }, line: { type: 'none' } });
      s.addText(it, { x: x + 0.5, y: y + 2.42 + j * 0.42 - 0.06, w: cardW - 0.8, h: 0.4, fontFace: FONT_B, fontSize: 11, color: MUTED, isTextBox: true, margin: 0, valign: 'middle' });
    });
    if (i < 2) flowArrow(s, x + cardW + 0.02, y + cardH / 2 - 0.08, gap - 0.04, { color: st.color });
  });
  s.addText('GICVMAP transforms CCTV from passive video into actionable intelligence.', {
    x: 0.6, y: 6.35, w: 12.13, h: 0.5, align: 'center', fontFace: FONT_H, fontSize: 15, italic: true, bold: true, color: CYAN,
    isTextBox: true, margin: 0,
  });
  footer(s, 3);
}

// =========================================================
// PAGE 04 — SYSTEM ARCHITECTURE
// =========================================================
function buildSlide04() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'System Architecture');
  title(s, 'Hybrid Architecture — Built for Real-Time Intelligence', { size: 24, w: 11.5 });
  badge(s, 10.7, 0.5, '13 DOCKER CONTAINERS', { w: 2.05, color: CYAN });
  const stages = [
    { t: 'SENTINEL\nCAMERAS', icon: 'camera', color: MUTED },
    { t: 'MediaMTX', icon: 'stream', color: BLUE },
    { t: 'AI\nINFERENCE', icon: 'brain', color: CYAN },
    { t: 'Redis\nStream', icon: 'redis', color: CYAN },
    { t: 'Alert\nWorker', icon: 'alert', color: RED },
    { t: 'WebSocket', icon: 'websocket', color: RED },
    { t: 'React\nDashboard', icon: 'grid', color: GREEN },
  ];
  const y = 1.85, boxW = 1.5, boxH = 1.35, gap = (12.13 - stages.length * boxW) / (stages.length - 1);
  stages.forEach((st, i) => {
    const x = 0.6 + i * (boxW + gap);
    panelCard(s, x, y, boxW, boxH, { fill: PANEL2 });
    iconCircle(s, x + boxW / 2 - 0.28, y + 0.16, 0.56, st.icon, { ring: st.color });
    s.addText(st.t, { x: x - 0.1, y: y + 0.82, w: boxW + 0.2, h: 0.5, align: 'center', fontFace: FONT_B, fontSize: 9.5, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacingMultiple: 1 });
    if (i < stages.length - 1) {
      s.addShape('rightArrow', { x: x + boxW + gap * 0.12, y: y + boxH / 2 - 0.06, w: gap * 0.76, h: 0.12, fill: { color: LINE }, line: { type: 'none' } });
    }
  });
  s.addText('RTSP · HLS · WebRTC', { x: 0.6 + 1 * (boxW + gap) - 0.3, y: y + boxH + 0.08, w: boxW + 0.6, h: 0.5, align: 'center', fontFace: FONT_B, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
  s.addText('YOLOv8 nano\nEasyOCR · OpenCV', { x: 0.6 + 2 * (boxW + gap) - 0.3, y: y + boxH + 0.08, w: boxW + 0.6, h: 0.5, align: 'center', fontFace: FONT_B, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
  s.addText('detection_events', { x: 0.6 + 3 * (boxW + gap) - 0.3, y: y + boxH + 0.08, w: boxW + 0.6, h: 0.5, align: 'center', fontFace: FONT_B, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
  s.addText('Watchlist Match →\nCRITICAL / HIGH', { x: 0.6 + 4 * (boxW + gap) - 0.3, y: y + boxH + 0.08, w: boxW + 0.6, h: 0.5, align: 'center', fontFace: FONT_B, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
  s.addText('React + TypeScript\nLeaflet · HLS.js', { x: 0.6 + 6 * (boxW + gap) - 0.3, y: y + boxH + 0.08, w: boxW + 0.6, h: 0.5, align: 'center', fontFace: FONT_B, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
  const infraY = 4.55;
  s.addText('SUPPORTING INFRASTRUCTURE', { x: 0.6, y: infraY, w: 6, h: 0.3, fontFace: FONT_B, fontSize: 11, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1.5 });
  panelCard(s, 0.6, infraY + 0.42, 12.13, 1.95, { fill: PANEL, transparency: 20 });
  const infra = [
    { icon: 'database', t: 'PostgreSQL + PostGIS\n+ pgvector' },
    { icon: 'cloud', t: 'MinIO Object\nStorage' },
    { icon: 'server', t: 'FastAPI\nMicroservices' },
    { icon: 'network', t: 'NGINX Reverse\nProxy' },
    { icon: 'docker', t: 'Docker\nCompose' },
  ];
  const iw2 = 12.13 / infra.length;
  infra.forEach((it, i) => {
    const cx = 0.6 + iw2 * i + iw2 / 2;
    iconCircle(s, cx - 0.34, infraY + 0.68, 0.68, it.icon, { ring: BLUE });
    s.addText(it.t, { x: cx - 1.0, y: infraY + 1.42, w: 2.0, h: 0.75, align: 'center', fontFace: FONT_B, fontSize: 10.5, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05 });
  });
  footer(s, 4);
}

// =========================================================
// PAGE 05 — TECHNOLOGY STACK
// =========================================================
function buildSlide05() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'Under the Hood');
  title(s, 'Technology Stack', { size: 30 });
  const categories = [
    { name: 'BACKEND', color: BLUE, items: ['Python 3.11', 'FastAPI', 'SQLAlchemy', 'asyncpg', 'Pydantic v2'] },
    { name: 'FRONTEND', color: CYAN, items: ['React 18', 'TypeScript', 'Tailwind CSS', 'Zustand', 'hls.js', 'Leaflet.js'] },
    { name: 'AI / ML', color: GREEN, items: ['YOLOv8 nano', 'EasyOCR', 'OpenCV'] },
    { name: 'DATA & STREAMING', color: RED, items: ['PostgreSQL 15', 'PostGIS', 'pgvector', 'Redis 7', 'MinIO'] },
    { name: 'INFRASTRUCTURE', color: MUTED, items: ['MediaMTX', 'NGINX', 'Docker Compose', 'NVIDIA CUDA'] },
  ];
  const colW = 2.33, colGap = 0.185, startX = 0.6, y = 1.75, colH = 4.5;
  categories.forEach((cat, i) => {
    const x = startX + i * (colW + colGap);
    panelCard(s, x, y, colW, colH, { fill: PANEL2 });
    s.addShape('roundRect', { x, y, w: colW, h: 0.5, rectRadius: 0.1, fill: { color: cat.color, transparency: 85 }, line: { type: 'none' } });
    s.addText(cat.name, { x: x + 0.15, y, w: colW - 0.3, h: 0.5, valign: 'middle', fontFace: FONT_B, fontSize: 11, bold: true, color: cat.color, isTextBox: true, margin: 0 });
    cat.items.forEach((it, j) => {
      const iy = y + 0.72 + j * 0.62;
      s.addShape('roundRect', { x: x + 0.15, y: iy, w: colW - 0.3, h: 0.5, rectRadius: 0.07, fill: { color: PANEL }, line: { color: LINE, width: 0.75 } });
      s.addText(it, { x: x + 0.28, y: iy, w: colW - 0.5, h: 0.5, valign: 'middle', fontFace: FONT_B, fontSize: 10.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    });
  });
  s.addShape('line', { x: 0.6, y: 6.55, w: 12.13, h: 0, line: { color: LINE, width: 1 } });
  s.addText('Async microservices   •   Real-time streaming   •   Spatial intelligence   •   AI inference', {
    x: 0.6, y: 6.68, w: 12.13, h: 0.4, align: 'center', fontFace: FONT_B, fontSize: 12, bold: true, color: MUTED,
    isTextBox: true, margin: 0,
  });
  footer(s, 5);
}

// =========================================================
// PAGE 06 — AI PIPELINE
// =========================================================
function buildSlide06() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'AI Pipeline');
  title(s, 'From Video Frame to Critical Alert', { size: 28 });
  const steps = [
    { n: '01', t: 'CAPTURE', d: 'Sentinel RTSP Feed', icon: 'camera' },
    { n: '02', t: 'DETECT', d: 'YOLOv8 nano', icon: 'detect' },
    { n: '03', t: 'READ', d: 'EasyOCR plates', icon: 'ocr' },
    { n: '04', t: 'STREAM', d: 'Redis detection_events', icon: 'redis' },
    { n: '05', t: 'MATCH', d: 'Watchlist Engine', icon: 'watchlist' },
    { n: '06', t: 'ALERT', d: 'CRITICAL / HIGH', icon: 'alert' },
    { n: '07', t: 'PUSH', d: 'WebSocket → Dashboard', icon: 'websocket' },
  ];
  const y = 1.7, boxW = 1.55, boxH = 1.55, gap = (12.13 - steps.length * boxW) / (steps.length - 1);
  steps.forEach((st, i) => {
    const x = 0.6 + i * (boxW + gap);
    const isAlert = st.t === 'ALERT';
    panelCard(s, x, y, boxW, boxH, { fill: isAlert ? '3A0F16' : PANEL2, line: isAlert ? RED : LINE });
    s.addText(st.n, { x: x + 0.1, y: y + 0.08, w: 0.6, h: 0.28, fontFace: FONT_B, fontSize: 9, bold: true, color: isAlert ? RED : MUTED2, isTextBox: true, margin: 0 });
    iconCircle(s, x + boxW / 2 - 0.26, y + 0.32, 0.52, st.icon, { ring: isAlert ? RED : CYAN });
    s.addText(st.t, { x: x - 0.1, y: y + 0.92, w: boxW + 0.2, h: 0.28, align: 'center', fontFace: FONT_H, fontSize: 11, bold: true, color: isAlert ? RED : WHITE, isTextBox: true, margin: 0, charSpacing: 1 });
    s.addText(st.d, { x: x + 0.05, y: y + 1.2, w: boxW - 0.1, h: 0.32, align: 'center', fontFace: FONT_B, fontSize: 8, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1 });
    if (i < steps.length - 1) {
      s.addShape('rightArrow', { x: x + boxW + gap * 0.15, y: y + boxH / 2 - 0.05, w: gap * 0.7, h: 0.1, fill: { color: LINE }, line: { type: 'none' } });
    }
  });
  const demoY = 3.65;
  panelCard(s, 0.6, demoY, 5.85, 1.55, { fill: PANEL2 });
  s.addText('DETECTED PLATE', { x: 0.85, y: demoY + 0.18, w: 3, h: 0.25, fontFace: FONT_B, fontSize: 9.5, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1.5 });
  s.addShape('roundRect', { x: 0.85, y: demoY + 0.48, w: 2.55, h: 0.55, rectRadius: 0.06, fill: { color: 'F4C430' }, line: { color: '2C2C2C', width: 1.5 } });
  s.addText('GJ 27 EF 9012', { x: 0.85, y: demoY + 0.48, w: 2.55, h: 0.55, align: 'center', valign: 'middle', fontFace: FONT_H, fontSize: 17, bold: true, color: '1A1A1A', isTextBox: true, margin: 0 });
  s.addText('OCR Confidence: 0.82', { x: 0.85, y: demoY + 1.1, w: 3, h: 0.3, fontFace: FONT_B, fontSize: 10.5, color: GREEN, bold: true, isTextBox: true, margin: 0 });
  chip(s, 3.7, demoY + 0.5, 2.5, 'WATCHLIST MATCH', { fill: '3A0F16', line: RED, color: RED, h: 0.42 });
  chip(s, 3.7, demoY + 1.0, 2.5, 'CRITICAL ALERT', { fill: RED, line: RED, color: '1A0508', h: 0.42 });
  panelCard(s, 6.75, demoY, 5.98, 1.55, { fill: PANEL2 });
  s.addText('VERIFIED PERFORMANCE', { x: 7.0, y: demoY + 0.16, w: 5, h: 0.28, fontFace: FONT_B, fontSize: 9.5, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1.5 });
  const perf = [['10,340+', 'detection events'], ['1,758+', 'alerts auto-generated'], ['26/30', 'cameras connected to AI']];
  const pw = 5.98 / 3;
  perf.forEach((p, i) => {
    const px = 6.75 + i * pw;
    s.addText(p[0], { x: px, y: demoY + 0.5, w: pw, h: 0.5, align: 'center', fontFace: FONT_H, fontSize: 22, bold: true, color: CYAN, isTextBox: true, margin: 0 });
    s.addText(p[1], { x: px + 0.1, y: demoY + 1.02, w: pw - 0.2, h: 0.42, align: 'center', fontFace: FONT_B, fontSize: 9, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05 });
  });
  const objY = 5.55;
  s.addText('DETECTS', { x: 0.6, y: objY, w: 2, h: 0.28, fontFace: FONT_B, fontSize: 10, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1.5 });
  const objs = [['person', 'Person'], ['car', 'Car'], ['motorcycle', 'Motorcycle'], ['bus', 'Bus'], ['truck', 'Truck']];
  objs.forEach((o, i) => {
    const ox = 0.6 + i * 2.45;
    iconCircle(s, ox, objY + 0.35, 0.5, o[0], { ring: BLUE });
    s.addText(o[1], { x: ox + 0.6, y: objY + 0.45, w: 1.7, h: 0.35, valign: 'middle', fontFace: FONT_B, fontSize: 11.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  });
  footer(s, 6);
}

// =========================================================
// PAGE 07 — KEY FEATURES
// =========================================================
function buildSlide07() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'Command Center');
  title(s, 'Everything the Operator Needs — One Command Center', { size: 24, w: 12 });
  const feats = [
    { n: '01', t: 'VideoWall', d: '30-camera HLS grid with auto-reconnect', icon: 'grid' },
    { n: '02', t: 'Vehicle Search', d: 'Plate search, trajectory, timeline & CSV export', icon: 'search' },
    { n: '03', t: 'Real-Time Alerts', d: 'Live watchlist alerts with severity workflow', icon: 'alert' },
    { n: '04', t: 'CameraMap', d: 'GIS visualization of camera locations', icon: 'map' },
    { n: '05', t: 'RBAC', d: 'Role and camera-level access control', icon: 'shield' },
    { n: '06', t: 'Reports', d: 'Detection statistics, alert trends & filtering', icon: 'report' },
  ];
  const cols = 3, rows = 2, cardW = 3.95, cardH = 2.05, gapX = 0.15, gapY = 0.22, startX = 0.6, startY = 1.85;
  feats.forEach((f, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX), y = startY + row * (cardH + gapY);
    panelCard(s, x, y, cardW, cardH, { fill: PANEL2 });
    iconCircle(s, x + 0.28, y + 0.28, 0.62, f.icon, { ring: CYAN });
    s.addText(f.n, { x: x + cardW - 0.65, y: y + 0.2, w: 0.5, h: 0.3, align: 'right', fontFace: FONT_B, fontSize: 11, bold: true, color: MUTED2, isTextBox: true, margin: 0 });
    s.addText(f.t, { x: x + 0.28, y: y + 1.05, w: cardW - 0.56, h: 0.35, fontFace: FONT_H, fontSize: 15.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addText(f.d, { x: x + 0.28, y: y + 1.42, w: cardW - 0.56, h: 0.55, fontFace: FONT_B, fontSize: 11, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.15 });
  });
  footer(s, 7);
}

// =========================================================
// PAGE 08 — ACCESS CONTROL
// =========================================================
function buildSlide08() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'Security by Design');
  title(s, 'Granular Access Control', { size: 28 });
  const levels = [
    { t: 'SUPERADMIN', l: 'Level 4', icon: 'admin', color: RED },
    { t: 'DEPT ADMIN', l: 'Level 3', icon: 'users', color: BLUE },
    { t: 'OPERATOR / ANALYST', l: 'Level 2', icon: 'analyst', color: CYAN },
    { t: 'VIEWER / AUDITOR', l: 'Level 1', icon: 'viewer', color: GREEN },
  ];
  const lx = 0.6, ly = 1.85, lw = 4.0, lh = 0.98, lgap = 0.14;
  levels.forEach((lv, i) => {
    const y = ly + i * (lh + lgap);
    panelCard(s, lx, y, lw, lh, { fill: PANEL2, line: lv.color });
    iconCircle(s, lx + 0.2, y + 0.19, 0.6, lv.icon, { ring: lv.color });
    s.addText(lv.t, { x: lx + 0.95, y: y + 0.16, w: lw - 1.15, h: 0.38, fontFace: FONT_H, fontSize: 14.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addText(lv.l, { x: lx + 0.95, y: y + 0.54, w: lw - 1.15, h: 0.3, fontFace: FONT_B, fontSize: 11, color: lv.color, bold: true, isTextBox: true, margin: 0 });
    if (i < levels.length - 1) {
      s.addShape('downArrow', { x: lx + lw / 2 - 0.06, y: y + lh + 0.01, w: 0.12, h: lgap - 0.02, fill: { color: LINE }, line: { type: 'none' } });
    }
  });
  const rx = 4.95;
  panelCard(s, rx, 1.85, 7.78, 2.15, { fill: PANEL2 });
  s.addText('13 FEATURE PERMISSIONS', { x: rx + 0.25, y: 2.0, w: 5, h: 0.32, fontFace: FONT_B, fontSize: 12, bold: true, color: CYAN, isTextBox: true, margin: 0, charSpacing: 1 });
  const perms = ['View Live Feeds', 'Playback Recording', 'Search Vehicles', 'View Analytics', 'Manage Alerts', 'Export Data', 'Manage Cameras', 'Manage Watchlist', 'Manage Users', 'View Audit Logs', 'System Config'];
  const pcols = 3, pw2 = (7.78 - 0.5) / pcols;
  perms.forEach((p, i) => {
    const col = i % pcols, row = Math.floor(i / pcols);
    const px = rx + 0.25 + col * pw2, py = 2.4 + row * 0.44;
    s.addImage({ path: ICON('check'), x: px, y: py + 0.03, w: 0.18, h: 0.18 });
    s.addText(p, { x: px + 0.26, y: py - 0.05, w: pw2 - 0.3, h: 0.34, valign: 'middle', fontFace: FONT_B, fontSize: 10, color: MUTED, isTextBox: true, margin: 0 });
  });
  const govY = 4.18;
  const govs = [['lock', 'Department-level isolation'], ['camera', 'Camera-level access'], ['key', 'Feature-level permissions'], ['auditor', 'Full audit trail']];
  const gw = 7.78 / 4;
  govs.forEach((g, i) => {
    const gx = rx + i * gw;
    panelCard(s, gx + 0.05, govY, gw - 0.1, 1.02, { fill: PANEL });
    iconCircle(s, gx + gw / 2 - 0.24, govY + 0.13, 0.48, g[0], { ring: BLUE });
    s.addText(g[1], { x: gx + 0.15, y: govY + 0.63, w: gw - 0.3, h: 0.35, align: 'center', fontFace: FONT_B, fontSize: 9, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacingMultiple: 1 });
  });
  const duY = 5.4;
  s.addText('DEMO USER EXAMPLES', { x: rx, y: duY, w: 5, h: 0.3, fontFace: FONT_B, fontSize: 11, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1.5 });
  const users = [['admin', 'Superadmin'], ['muni_operator', 'Municipal cameras'], ['rto_analyst', 'RTO + Police'], ['police_viewer', 'Police cameras'], ['state_auditor', 'All departments']];
  const uw = 7.78 / 5;
  users.forEach((u, i) => {
    const ux = rx + i * uw;
    panelCard(s, ux + 0.04, duY + 0.35, uw - 0.08, 0.85, { fill: PANEL2 });
    s.addText(u[0], { x: ux + 0.1, y: duY + 0.44, w: uw - 0.2, h: 0.28, align: 'center', fontFace: 'Courier New', fontSize: 9.5, bold: true, color: CYAN, isTextBox: true, margin: 0 });
    s.addText(u[1], { x: ux + 0.08, y: duY + 0.74, w: uw - 0.16, h: 0.42, align: 'center', fontFace: FONT_B, fontSize: 8.3, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1 });
  });
  s.addText('Right data  →  Right person  →  Right permission', {
    x: rx, y: 6.75, w: 7.78, h: 0.35, align: 'center', fontFace: FONT_H, fontSize: 13, bold: true, italic: true, color: CYAN, isTextBox: true, margin: 0,
  });
  footer(s, 8);
}

// =========================================================
// PAGE 09 — SENTINEL CAMERA INTEGRATION
// =========================================================
function buildSlide09() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'Integration');
  title(s, "Built Around Gujarat's Existing Camera Infrastructure", { size: 22, w: 12 });
  const mx = 0.6, my = 1.85, mw = 4.6, mh = 3.55;
  panelCard(s, mx, my, mw, mh, { fill: PANEL2 });
  s.addText('AHMEDABAD CAMERA GRID', { x: mx + 0.2, y: my + 0.15, w: mw - 0.4, h: 0.28, fontFace: FONT_B, fontSize: 10, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1 });
  s.addShape('ellipse', { x: mx + 0.6, y: my + 0.65, w: mw - 1.2, h: mh - 1.1, fill: { color: PANEL, transparency: 10 }, line: { color: LINE, width: 1, dashType: 'sysDash' } });
  const zones = [
    { l: 'Central', x: mx + mw / 2, y: my + mh / 2 - 0.15 },
    { l: 'Western', x: mx + 1.15, y: my + mh / 2 - 0.15 },
    { l: 'Eastern', x: mx + mw - 1.15, y: my + mh / 2 - 0.15 },
    { l: 'North', x: mx + mw / 2, y: my + 1.1 },
    { l: 'Municipal', x: mx + mw / 2, y: my + mh - 0.75 },
  ];
  zones.forEach((z) => {
    s.addShape('ellipse', { x: z.x - 0.16, y: z.y - 0.16, w: 0.32, h: 0.32, fill: { color: PANEL2 }, line: { color: CYAN, width: 1.5 } });
    s.addImage({ path: ICON('camera'), x: z.x - 0.09, y: z.y - 0.09, w: 0.18, h: 0.18 });
    s.addText(z.l, { x: z.x - 0.55, y: z.y + 0.18, w: 1.1, h: 0.22, align: 'center', fontFace: FONT_B, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0 });
  });
  badge(s, mx + mw / 2 - 0.95, my + mh - 0.42, '30 CAMERAS CONNECTED', { w: 1.9, color: GREEN, line: GREEN });
  const px0 = 5.45, py0 = 1.85, pw = 7.28;
  const protos = [
    { t: 'RTSP', d: 'AI ingestion', icon: 'stream' },
    { t: 'HLS', d: 'Browser streaming / CDN', icon: 'wifi' },
    { t: 'WebRTC', d: 'Low-latency viewing', icon: 'signal' },
  ];
  const protW = (pw - 0.3) / 3;
  protos.forEach((pr, i) => {
    const x = px0 + i * (protW + 0.15);
    panelCard(s, x, py0, protW, 1.3, { fill: PANEL2 });
    iconCircle(s, x + protW / 2 - 0.26, py0 + 0.16, 0.52, pr.icon, { ring: BLUE });
    s.addText(pr.t, { x, y: py0 + 0.75, w: protW, h: 0.3, align: 'center', fontFace: FONT_H, fontSize: 13, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addText(pr.d, { x: x + 0.1, y: py0 + 1.03, w: protW - 0.2, h: 0.24, align: 'center', fontFace: FONT_B, fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0 });
  });
  const ry = 3.35;
  panelCard(s, px0, ry, pw, 2.05, { fill: PANEL2 });
  s.addText('BUILT FOR UNRELIABLE NETWORKS', { x: px0 + 0.25, y: ry + 0.16, w: 5, h: 0.3, fontFace: FONT_B, fontSize: 11, bold: true, color: RED, isTextBox: true, margin: 0, charSpacing: 1 });
  const resil = ['Exponential backoff: 2s → 30s cap', 'Per-camera stream isolation', 'H.264 / H.265 handling', 'PTS-based timing', 'Inter-frame gap tolerance', 'Forced RTSP over TCP'];
  const rcols = 2, rw = (pw - 0.5) / rcols;
  resil.forEach((r, i) => {
    const col = i % rcols, row = Math.floor(i / rcols);
    const rx2 = px0 + 0.25 + col * rw, ry2 = ry + 0.58 + row * 0.44;
    s.addShape('ellipse', { x: rx2, y: ry2 + 0.06, w: 0.08, h: 0.08, fill: { color: CYAN }, line: { type: 'none' } });
    s.addText(r, { x: rx2 + 0.22, y: ry2 - 0.04, w: rw - 0.3, h: 0.36, valign: 'middle', fontFace: FONT_B, fontSize: 10.5, color: MUTED, isTextBox: true, margin: 0 });
  });
  s.addText('30 Cameras Connected', {
    x: px0, y: 5.6, w: pw, h: 0.55, align: 'center', fontFace: FONT_H, fontSize: 22, bold: true, color: CYAN, isTextBox: true, margin: 0,
  });
  s.addText('A practical deployment advantage — not a theoretical architecture', {
    x: px0, y: 6.15, w: pw, h: 0.32, align: 'center', fontFace: FONT_B, fontSize: 11, italic: true, color: MUTED, isTextBox: true, margin: 0,
  });
  footer(s, 9);
}

// =========================================================
// PAGE 10 — IMPACT
// =========================================================
function buildSlide10() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'Impact');
  title(s, 'Turning Minutes into Action', { size: 30 });
  const big = [
    { v: '<5 MIN', l: 'Alert response time', sub: 'vs. 30+ minutes previously', color: CYAN },
    { v: '70%', l: 'Reduction in manual CCTV\nmonitoring workload', sub: '', color: BLUE },
    { v: '90%', l: 'Faster suspect / vehicle\nidentification', sub: '', color: GREEN },
  ];
  const bw = 3.95, bh = 1.95, bgap = 0.14, by = 1.75;
  big.forEach((b, i) => {
    const x = 0.6 + i * (bw + bgap);
    panelCard(s, x, by, bw, bh, { fill: PANEL2, line: b.color });
    s.addText(b.v, { x, y: by + 0.18, w: bw, h: 0.75, align: 'center', fontFace: FONT_H, fontSize: 38, bold: true, color: b.color, isTextBox: true, margin: 0 });
    s.addText(b.l, { x: x + 0.2, y: by + 0.98, w: bw - 0.4, h: 0.55, align: 'center', fontFace: FONT_B, fontSize: 12, bold: true, color: WHITE, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
    if (b.sub) s.addText(b.sub, { x: x + 0.2, y: by + 1.55, w: bw - 0.4, h: 0.3, align: 'center', fontFace: FONT_B, fontSize: 9.5, italic: true, color: MUTED, isTextBox: true, margin: 0 });
  });
  const smY = 4.05;
  s.addText('SYSTEM PERFORMANCE (LIVE-RUN METRICS)', { x: 0.6, y: smY, w: 8, h: 0.3, fontFace: FONT_B, fontSize: 11, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1.5 });
  const metrics = [
    ['30', 'Cameras connected &\nprocessing in real-time'],
    ['62', 'API endpoints across\n6 routers'],
    ['13', 'Docker containers\norchestrated'],
    ['10,340+', 'Detection events\nprocessed'],
    ['1,758+', 'Alerts\nauto-generated'],
  ];
  const mw2 = 12.13 / 5;
  metrics.forEach((m, i) => {
    const x = 0.6 + i * mw2;
    panelCard(s, x + 0.06, smY + 0.38, mw2 - 0.12, 1.5, { fill: PANEL });
    s.addText(m[0], { x: x + 0.06, y: smY + 0.52, w: mw2 - 0.12, h: 0.6, align: 'center', fontFace: FONT_H, fontSize: 25, bold: true, color: CYAN, isTextBox: true, margin: 0 });
    s.addText(m[1], { x: x + 0.16, y: smY + 1.12, w: mw2 - 0.32, h: 0.65, align: 'center', fontFace: FONT_B, fontSize: 9.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.1 });
  });
  const trY = 6.15;
  const steps = ['RAW VIDEO', 'AI INTELLIGENCE', 'ACTIONABLE ALERT'];
  const stw = 3.0, stgap = (12.13 - stw * 3) / 2;
  steps.forEach((t, i) => {
    const x = 0.6 + i * (stw + stgap);
    chip(s, x, trY, stw, t, { fill: i === 2 ? RED : PANEL2, line: i === 2 ? RED : CYAN, color: i === 2 ? WHITE : CYAN, h: 0.5 });
    if (i < 2) flowArrow(s, x + stw + 0.06, trY + 0.19, stgap - 0.12, { color: MUTED2 });
  });
  footer(s, 10);
}

// =========================================================
// PAGE 11 — SCALABILITY & FUTURE
// =========================================================
function buildSlide11() {
  const s = pres.addSlide();
  bgDark(s);
  kicker(s, 'Scalability & Future');
  title(s, 'From 30 Cameras to a State-Wide Intelligence Layer', { size: 22, w: 12 });
  const stages = [
    { t: 'TODAY', tag: 'Ahmedabad Pilot', color: BLUE, icon: 'flag',
      items: ['30 cameras', 'Real-time AI processing', 'Unified dashboard', 'Department-aware access'] },
    { t: 'NEXT', tag: 'District Scale', color: CYAN, icon: 'trend',
      items: ['500+ cameras per district', 'Horizontal scaling of AI workers', 'Camera-level isolation', 'Centralized alert intelligence'] },
    { t: 'FUTURE', tag: 'Gujarat-Wide Rollout', color: GREEN, icon: 'rocket',
      items: ['Multiple districts', 'Cross-department intelligence', 'State-level command visibility'] },
  ];
  const cw = 2.7, cgap = 0.35, cx0 = 0.6, cy = 1.85, ch = 3.55;
  stages.forEach((st, i) => {
    const x = cx0 + i * (cw + cgap);
    panelCard(s, x, cy, cw, ch, { fill: PANEL2, line: st.color });
    iconCircle(s, x + cw / 2 - 0.32, cy + 0.25, 0.64, st.icon, { ring: st.color });
    s.addText(st.t, { x, y: cy + 1.05, w: cw, h: 0.35, align: 'center', fontFace: FONT_H, fontSize: 15, bold: true, color: st.color, isTextBox: true, margin: 0, charSpacing: 1.5 });
    s.addText(st.tag, { x, y: cy + 1.4, w: cw, h: 0.3, align: 'center', fontFace: FONT_B, fontSize: 10.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
    s.addShape('line', { x: x + 0.35, y: cy + 1.78, w: cw - 0.7, h: 0, line: { color: LINE, width: 1 } });
    st.items.forEach((it, j) => {
      s.addShape('ellipse', { x: x + 0.22, y: cy + 1.98 + j * 0.4 + 0.06, w: 0.06, h: 0.06, fill: { color: st.color }, line: { type: 'none' } });
      s.addText(it, { x: x + 0.36, y: cy + 1.98 + j * 0.4 - 0.07, w: cw - 0.55, h: 0.4, fontFace: FONT_B, fontSize: 9.3, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05, valign: 'middle' });
    });
    if (i < 2) flowArrow(s, x + cw + 0.03, cy + ch / 2 - 0.07, cgap - 0.06, { color: st.color });
  });
  const sx = cx0 + 3 * cw + 2 * cgap + 0.1;
  const sw = 12.13 - (sx - cx0);
  panelCard(s, sx, cy, sw, ch, { fill: PANEL, line: CYAN });
  s.addText('PROJECTED OPERATIONAL VALUE', { x: sx + 0.2, y: cy + 0.18, w: sw - 0.4, h: 0.5, fontFace: FONT_B, fontSize: 10.5, bold: true, color: CYAN, isTextBox: true, margin: 0, lineSpacingMultiple: 1.05, charSpacing: 0.5 });
  iconCircle(s, sx + sw / 2 - 0.32, cy + 0.85, 0.64, 'rupee', { ring: GREEN });
  s.addText('₹15-20L / year', { x: sx, y: cy + 1.62, w: sw, h: 0.4, align: 'center', fontFace: FONT_H, fontSize: 17, bold: true, color: GREEN, isTextBox: true, margin: 0 });
  s.addText('potential savings', { x: sx, y: cy + 2.0, w: sw, h: 0.3, align: 'center', fontFace: FONT_B, fontSize: 9.5, italic: true, color: MUTED, isTextBox: true, margin: 0 });
  s.addShape('line', { x: sx + 0.25, y: cy + 2.42, w: sw - 0.5, h: 0, line: { color: LINE, width: 1 } });
  const vals = ['Less manual monitoring', 'Faster investigation', 'Shared infrastructure', 'Automated detection'];
  vals.forEach((v, i) => {
    const vy = cy + 2.6 + i * 0.32;
    s.addImage({ path: ICON('check'), x: sx + 0.2, y: vy, w: 0.16, h: 0.16 });
    s.addText(v, { x: sx + 0.44, y: vy - 0.06, w: sw - 0.6, h: 0.28, valign: 'middle', fontFace: FONT_B, fontSize: 9, color: WHITE, isTextBox: true, margin: 0 });
  });
  const fy = 5.75;
  s.addText('TECHNICAL SCALABILITY FOUNDATION', { x: 0.6, y: fy, w: 6, h: 0.28, fontFace: FONT_B, fontSize: 10.5, bold: true, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1.5 });
  const found = ['Docker Compose', 'Service Replication', 'District-Level Deployment', 'State-Wide Architecture'];
  const fw = (12.13 - 0.3 * 3) / 4;
  found.forEach((f, i) => {
    const x = 0.6 + i * (fw + 0.3);
    chip(s, x, fy + 0.35, fw, f, { fill: PANEL2, line: BLUE, color: WHITE, h: 0.55 });
    if (i < 3) flowArrow(s, x + fw + 0.03, fy + 0.55, 0.24, { color: BLUE });
  });
  s.addText('Projected / planned scalability — not already-deployed capability', {
    x: 0.6, y: fy + 1.05, w: 12.13, h: 0.3, align: 'center', fontFace: FONT_B, fontSize: 9, italic: true, color: MUTED2, isTextBox: true, margin: 0,
  });
  footer(s, 11);
}

// =========================================================
// PAGE 12 — THANK YOU / LIVE DEMO
// =========================================================
function buildSlide12() {
  const s = pres.addSlide();
  bgDark(s);
  const nodePts = [
    [2.1, 1.3], [11.1, 1.3], [1.4, 5.7], [11.8, 5.7], [6.6, 0.9], [6.6, 6.5], [3.6, 3.3], [9.6, 3.3],
  ];
  nodePts.forEach(([nx, ny]) => {
    s.addShape('ellipse', { x: nx - 0.09, y: ny - 0.09, w: 0.18, h: 0.18, fill: { color: PANEL2 }, line: { color: CYAN, width: 1, transparency: 20 } });
  });
  s.addShape('line', { x: 2.1, y: 1.3, w: 4.5, h: -0.4, line: { color: CYAN, width: 0.75, transparency: 70, dashType: 'sysDot' } });
  s.addShape('line', { x: 6.6, y: 0.9, w: 4.5, h: 0.4, line: { color: CYAN, width: 0.75, transparency: 70, dashType: 'sysDot' } });
  s.addShape('line', { x: 1.4, y: 5.7, w: 5.2, h: 0.8, line: { color: CYAN, width: 0.75, transparency: 70, dashType: 'sysDot' } });
  s.addShape('line', { x: 6.6, y: 6.5, w: 5.2, h: -0.8, line: { color: CYAN, width: 0.75, transparency: 70, dashType: 'sysDot' } });
  badge(s, PW / 2 - 2.55, 1.05, 'GUJARAT POLICE INNOVATION HACKATHON 2026', { w: 5.1, color: CYAN });
  s.addText('GICVMAP', {
    x: 0, y: 2.15, w: PW, h: 1.1, align: 'center', fontFace: FONT_H, fontSize: 54, bold: true, color: WHITE, isTextBox: true, margin: 0, charSpacing: 1,
  });
  s.addText('Gujarat Integrated CCTV Video Management & Analytics Platform', {
    x: 0, y: 3.2, w: PW, h: 0.4, align: 'center', fontFace: FONT_B, fontSize: 14, color: MUTED, isTextBox: true, margin: 0,
  });
  s.addText('"See. Think. Act."', {
    x: 0, y: 3.68, w: PW, h: 0.5, align: 'center', fontFace: FONT_H, fontSize: 22, italic: true, bold: true, color: CYAN, isTextBox: true, margin: 0,
  });
  const dw = 6.2, dx = PW / 2 - dw / 2, dy = 4.55;
  panelCard(s, dx, dy, dw, 1.35, { fill: PANEL2, line: RED });
  s.addShape('ellipse', { x: dx + 0.35, y: dy + 0.35, w: 0.18, h: 0.18, fill: { color: RED }, line: { type: 'none' } });
  s.addText('LIVE SYSTEM DEMO', { x: dx + 0.65, y: dy + 0.22, w: dw - 1, h: 0.45, fontFace: FONT_H, fontSize: 18, bold: true, color: WHITE, isTextBox: true, margin: 0 });
  s.addText('System running at: https://localhost', { x: dx, y: dy + 0.8, w: dw, h: 0.4, align: 'center', fontFace: 'Courier New', fontSize: 13, color: CYAN, isTextBox: true, margin: 0 });
  s.addText('Real-time AI-powered CCTV intelligence for Gujarat Police', {
    x: 0, y: PH - 0.65, w: PW, h: 0.35, align: 'center', fontFace: FONT_B, fontSize: 11, color: MUTED2, isTextBox: true, margin: 0,
  });
}

// ---------- BUILD ALL ----------
buildSlide01();
buildSlide02();
buildSlide03();
buildSlide04();
buildSlide05();
buildSlide06();
buildSlide07();
buildSlide08();
buildSlide09();
buildSlide10();
buildSlide11();
buildSlide12();

pres.writeFile({ fileName: path.join(__dirname, 'GICVMAP_Hackathon2026.pptx') }).then(() => {
  console.log('done');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
