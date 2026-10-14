const PDFDocument = require('pdfkit');
const path = require('path');
const { assessTest } = require('./fitnessAssessment');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansArabic.ttf');
const W = 595.28, H = 841.89;
const palettes = {
  dark: { bg:'#083c43', panel:'#285761', deep:'#1b2638', paper:'#f7faf8', ink:'#ffffff', muted:'#d5e6e3', orange:'#e9a027', line:'#b7d5d1', surface:'#153f48' },
  light: { bg:'#eaf5f3', panel:'#ffffff', deep:'#163a45', paper:'#ffffff', ink:'#183943', muted:'#4d6a70', orange:'#d99120', line:'#a4c5c3', surface:'#d9ece9' }
};
const toneColors = { low:'#6fa9d4', neutral:'#61bea9', moderate:'#efa43b', high:'#e36b56', above:'#77b4d3' };
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const short = (value, max = 90) => { const s = clean(value); return s.length > max ? `${s.slice(0, max - 3).trimEnd()}...` : s; };
function nameLines(value) {
  const lines = [''];
  for (const word of clean(value || 'Student').split(' ')) {
    const current = lines.length - 1;
    if (lines[current] && `${lines[current]} ${word}`.length > 25) lines.push(word);
    else lines[current] = lines[current] ? `${lines[current]} ${word}` : word;
  }
  return lines.slice(0,2).map((line,index) => index === 1 && lines.length > 2 ? short(line,23) : line);
}
const number = (value, digits = 1) => value == null || !Number.isFinite(Number(value)) ? '-' : Number(value).toFixed(digits);
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric' }) : 'Not recorded';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function txt(doc, value, x, y, width, size, color, options = {}) {
  doc.font('Report').fontSize(size).fillColor(color).text(String(value), x, y, { width, height:options.height || size * 1.55, ellipsis:true, lineBreak:false, align:options.align || 'left' });
}
function rect(doc, x, y, w, h, fill, stroke = fill, r = 0) { doc.roundedRect(x, y, w, h, r).fillAndStroke(fill, stroke); }
function motif(doc, p) {
  doc.save().opacity(.18).strokeColor(p.line).lineWidth(2);
  for (const [x,y] of [[54,24],[246,18],[509,35],[315,132],[52,690],[516,701]]) {
    doc.circle(x,y,13).stroke(); doc.circle(x,y,6).stroke();
  }
  for (const [x,y] of [[76,57],[297,47],[470,119],[475,672]]) {
    doc.moveTo(x,y).lineTo(x+39,y).stroke();
    for (const dx of [0,5,34,39]) doc.moveTo(x+dx,y-8).lineTo(x+dx,y+8).stroke();
  }
  doc.restore();
}
function section(doc, label, x, y, w, p) {
  txt(doc, label.toUpperCase(), x, y, w, 10, p.ink);
  doc.moveTo(x, y+18).lineTo(x+w,y+18).lineWidth(1).strokeColor(p.line).stroke();
}
function scale(doc, scale, x, y, w, p) {
  if (!scale || !(scale.max > scale.min)) return;
  const total = scale.max - scale.min;
  for (const segment of scale.segments) {
    const left = x + clamp((segment.from - scale.min) / total,0,1) * w;
    const right = x + clamp((segment.to - scale.min) / total,0,1) * w;
    if (right > left) rect(doc,left,y,right-left,6,toneColors[segment.tone] || p.line);
  }
  const pointer = x + clamp((scale.value - scale.min) / total,0,1) * w;
  doc.moveTo(pointer,y-5).lineTo(pointer-4,y-1).lineTo(pointer+4,y-1).closePath().fill(p.ink);
  txt(doc,scale.caption || '',x,y+10,w,6.8,p.muted);
}
function deltaText(metric) {
  if (metric.delta == null) return 'FIRST READING';
  const arrow = metric.delta > 0 ? 'UP' : metric.delta < 0 ? 'DOWN' : 'HOLDING STEADY';
  return metric.delta === 0 ? arrow : `${arrow} ${number(Math.abs(metric.delta))} vs previous`;
}
function vital(doc, key, title, metric, x, y, w, p) {
  rect(doc,x,y,w,82,p.panel,p.line,4);
  const tone = metric.band?.severity || 'neutral';
  const accent = toneColors[tone] || p.orange;
  rect(doc,x,y,4,82,accent,accent,1);
  txt(doc,title,x+12,y+7,84,10,p.ink);
  txt(doc,metric.estimated ? 'ESTIMATE' : 'CALCULATED',x+102,y+9,90,6.5,p.muted);
  txt(doc,number(metric.value),x+12,y+24,82,22,p.ink);
  txt(doc,metric.unit,x+91,y+34,72,7.5,p.muted);
  const status = metric.band?.label || (metric.value == null ? 'Not measured' : 'Personal baseline');
  const tagWidth = Math.min(157, Math.max(67, clean(status).length * 4.5 + 13));
  rect(doc,x+w-tagWidth-9,y+9,tagWidth,20,tone === 'high' || tone === 'moderate' ? accent : p.deep);
  txt(doc,status,x+w-tagWidth-4,y+14,tagWidth-10,7.2,'#ffffff');
  if (metric.band?.scale) scale(doc,metric.band.scale,x+12,y+55,w-24,p);
  if (metric.value != null) txt(doc,deltaText(metric),x+w-151,y+34,140,7.2,p.muted,{align:'right'});
}
function bodyFigure(doc, x, y, p) {
  doc.save().fillColor(p.deep).strokeColor(p.line).lineWidth(1.5);
  doc.circle(x+75,y+56,22).fillAndStroke(p.deep,p.line);
  doc.path(`M ${x+52} ${y+81} C ${x+41} ${y+92}, ${x+33} ${y+111}, ${x+31} ${y+139} L ${x+19} ${y+216} Q ${x+15} ${y+232}, ${x+24} ${y+237} Q ${x+31} ${y+238}, ${x+34} ${y+221} L ${x+48} ${y+160} L ${x+48} ${y+258} L ${x+55} ${y+310} Q ${x+57} ${y+321}, ${x+67} ${y+321} L ${x+74} ${y+320} L ${x+75} ${y+221} L ${x+76} ${y+320} L ${x+84} ${y+321} Q ${x+94} ${y+320}, ${x+95} ${y+310} L ${x+102} ${y+258} L ${x+102} ${y+160} L ${x+116} ${y+221} Q ${x+119} ${y+238}, ${x+126} ${y+237} Q ${x+135} ${y+232}, ${x+131} ${y+216} L ${x+119} ${y+139} C ${x+117} ${y+111}, ${x+109} ${y+92}, ${x+98} ${y+81} Z`).fillAndStroke(p.deep,p.line);
  doc.restore();
}
function measure(doc, label, value, unit, x, y, p, align = 'left') {
  txt(doc,label.toUpperCase(),x,y,78,6.5,'#bfd7d7',{align});
  txt(doc,`${number(value)} ${unit}`,x,y+10,78,9,'#ffffff',{align});
}
function performanceGlyph(doc, kind, x, y, p) {
  doc.save().strokeColor(p.orange).lineWidth(2.2).lineCap('round').lineJoin('round');
  doc.circle(x+11,y+5,3.5).stroke();
  if (kind === 0) { // squat
    doc.moveTo(x+11,y+9).lineTo(x+12,y+19).lineTo(x+20,y+23).lineTo(x+25,y+17).stroke();
    doc.moveTo(x+12,y+19).lineTo(x+5,y+23).lineTo(x+5,y+29).stroke();
    doc.moveTo(x+9,y+12).lineTo(x+2,y+17).stroke();
  } else if (kind === 1) { // sit up
    doc.moveTo(x+9,y+9).lineTo(x+17,y+20).lineTo(x+27,y+21).stroke();
    doc.moveTo(x+17,y+20).lineTo(x+21,y+29).lineTo(x+29,y+29).stroke();
    doc.moveTo(x+4,y+28).lineTo(x+29,y+28).stroke();
  } else if (kind === 2) { // push up
    doc.moveTo(x+8,y+11).lineTo(x+26,y+19).lineTo(x+30,y+22).stroke();
    doc.moveTo(x+14,y+14).lineTo(x+10,y+26).stroke();
    doc.moveTo(x+25,y+19).lineTo(x+23,y+27).stroke();
    doc.moveTo(x+2,y+28).lineTo(x+31,y+28).stroke();
  } else { // reach
    doc.moveTo(x+11,y+10).lineTo(x+15,y+23).lineTo(x+28,y+24).stroke();
    doc.moveTo(x+15,y+23).lineTo(x+7,y+28).stroke();
    doc.moveTo(x+8,y+14).lineTo(x+24,y+12).stroke();
    doc.moveTo(x+25,y+29).lineTo(x+31,y+29).stroke();
  }
  doc.restore();
}

function renderFitnessReportPage(doc, { student, test, previous = null, assessment = null, template = 'dark' }) {
  const p = palettes[template] || palettes.dark;
  const a = assessment || assessTest(student,test,previous);
  doc.addPage({ size:'A4', margin:0 });
  doc.font('Report');
  doc.rect(0,0,W,H).fill(p.bg);
  motif(doc,p);
  doc.rect(0,0,W,6).fill(p.orange);
  rect(doc,30,24,253,116,p.deep,p.deep,3);
  txt(doc,'FITNESS REPORT',43,38,235,24,'#ffffff');
  txt(doc,'KHAIMAH AL RIYADAH (MAROL)',44,74,225,10,'#ffffff');
  doc.moveTo(44,98).lineTo(260,98).lineWidth(2).strokeColor(p.orange).stroke();
  txt(doc,`TEST ${date(test.CreatedAt)}`,44,107,225,9,'#ffffff');
  // The outlined identity blocks and photo placeholder follow the supplied SVG's composition.
  rect(doc,298,24,72,116,p.paper,p.orange,3);
  txt(doc,'PHOTO',305,73,59,10,p.muted,{align:'center'});
  rect(doc,382,24,183,44,p.deep,p.orange,2);
  nameLines(student.Name).forEach((line,index) => txt(doc,line,393,28+index*17,161,10.5,'#ffffff'));
  rect(doc,382,75,183,28,p.deep,p.line,2);
  txt(doc,`AGE ${a.ageYears ?? '-'}  |  ${short(student.Gender || '-',11)}`,392,82,160,10,'#ffffff');
  rect(doc,382,110,87,30,p.deep,p.line,2);
  rect(doc,477,110,88,30,p.deep,p.line,2);
  txt(doc,`TR ${student.TR ?? '-'}`,389,118,73,9,'#ffffff');
  txt(doc,short(student.Darajah || 'CLASS -',14),485,118,73,9,'#ffffff');
  doc.rect(0,151,W,41).fill(p.orange);
  txt(doc,`SCORE ${number(test.Total,0)}    GRADE ${short(test.Grade || '-',4)}`,30,162,244,13,p.deep);
  txt(doc,`${short(test.BatchName || 'Unbatched',27)}  |  ${test.SubmittedBy === 'Trainer' ? 'Trainer test' : test.SubmittedBy === 'Student' ? 'Self test' : 'Legacy source'}`,279,165,284,9,p.deep,{align:'right'});

  section(doc,'Fitness test',30,205,535,p);
  const performance = [['SQUATS',test.Squats,'reps'],['SIT UPS',test.SitUps,'reps'],['PUSH UPS',test.PushUps,'reps'],['FLEXIBILITY',test.SitAndReach,'cm']];
  performance.forEach(([title,value,unit],i) => {
    const x = 30+i*136;
    rect(doc,x,232,127,76,p.panel,p.line,2);
    rect(doc,x+10,239,107,21,p.deep);
    txt(doc,title,x+14,244,99,9,'#ffffff',{align:'center'});
    performanceGlyph(doc,i,x+17,267,p);
    txt(doc,number(value,title === 'FLEXIBILITY' ? 1 : 0),x+49,263,65,22,p.ink,{align:'right'});
    txt(doc,unit,x+49,292,65,7,p.muted,{align:'right'});
  });
  txt(doc,`STEP UP PULSE  ${number(test.StepUpPulseRate,0)} bpm`,30,314,535,8,p.muted);

  section(doc,'Four key vitals',30,336,330,p);
  const vitals = [['VO2Max','VO2 MAX'],['BMI','BMI'],['BodyFat','BODY FAT'],['BMR','BMR']];
  vitals.forEach(([key,label],i) => vital(doc,key,label,a.metrics[key],30,363+i*87,330,p));
  section(doc,'Body composition',373,336,192,p);
  rect(doc,373,363,192,343,p.deep,p.line,2);
  bodyFigure(doc,394,374,p);
  measure(doc,'Height',test.Height,'cm',381,408,p);
  measure(doc,'Neck',test.Neck,'cm',478,408,p,'right');
  measure(doc,'Waist',test.Waist,'cm',381,493,p);
  measure(doc,'Hips',test.Hips,'cm',478,493,p,'right');
  measure(doc,'Weight',test.Weight,'kg',381,665,p);

  rect(doc,0,721,W,121,p.orange);
  txt(doc,'EVALUATOR FEEDBACK',30,733,280,10,p.deep);
  const latest = test.comments?.[0];
  if (latest) {
    txt(doc,`${short(latest.CategoryName || 'General',20)}  |  ${short(latest.EvaluatorName || 'Evaluator',30)}  |  ${date(latest.DateEvaluated)}`,30,751,535,8,p.deep);
    txt(doc,short(latest.CommentText,165),30,765,535,9,p.deep);
  } else txt(doc,'Evaluator feedback will appear here after review.',30,753,535,9,p.deep);
}

function createReportDocument() {
  const doc = new PDFDocument({ autoFirstPage:false, compress:true, info:{ Title:'Fitness profile report' } });
  doc.registerFont('Report',FONT);
  return doc;
}

module.exports = { createReportDocument, renderFitnessReportPage };
