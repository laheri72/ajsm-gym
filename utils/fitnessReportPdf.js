const PDFDocument = require('pdfkit');
const path = require('path');
const { assessTest } = require('./fitnessAssessment');

const FONT = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansArabic.ttf');
const LOGO = path.join(__dirname, '..', 'assets', 'reports', 'logo.png');
const W = 595.28, H = 841.89;
const palettes = {
  dark: { bg:'#083c43', panel:'#285761', deep:'#1b2638', paper:'#f7faf8', ink:'#ffffff', muted:'#d5e6e3', orange:'#e9a027', line:'#b7d5d1', surface:'#153f48' },
  light: { bg:'#eaf5f3', panel:'#ffffff', deep:'#163a45', paper:'#ffffff', ink:'#183943', muted:'#4d6a70', orange:'#d99120', line:'#a4c5c3', surface:'#d9ece9' }
};
const toneColors = { low:'#6fa9d4', neutral:'#61bea9', moderate:'#efa43b', high:'#e36b56', above:'#77b4d3' };
const toneTags = { low:'#285d7e', moderate:'#93600a', high:'#963b31', above:'#2b6682' };
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const short = (value, max = 90) => { const s = clean(value); return s.length > max ? `${s.slice(0, max - 3).trimEnd()}...` : s; };
function nameLines(value) {
  const lines = [''];
  for (const word of clean(value || 'Student').split(' ')) {
    const current = lines.length - 1;
    if (lines[current] && `${lines[current]} ${word}`.length > 21) lines.push(word);
    else lines[current] = lines[current] ? `${lines[current]} ${word}` : word;
  }
  return lines.slice(0,3).map((line,index) => index === 2 && lines.length > 3 ? short(line,19) : line);
}
const number = (value, digits = 1) => value == null || !Number.isFinite(Number(value)) ? '-' : Number(value).toFixed(digits);
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric' }) : 'Not recorded';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function txt(doc, value, x, y, width, size, color, options = {}) {
  doc.font(options.bold ? 'Helvetica-Bold' : 'Report').fontSize(size).fillColor(color).text(String(value), x, y, { width, height:options.height || size * 1.55, ellipsis:true, lineBreak:false, align:options.align || 'left' });
}
function rect(doc, x, y, w, h, fill, stroke = fill, r = 0) { doc.roundedRect(x, y, w, h, r).fillAndStroke(fill, stroke); }
function wrappedLines(doc, value, width, size, maxLines) {
  const words = clean(value).split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  doc.font('Report').fontSize(size);
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && doc.widthOfString(next) > width) { lines.push(current); current = word; }
    else current = next;
  }
  if (current) lines.push(current);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    let final = visible[visible.length - 1];
    while (final && doc.widthOfString(`${final}...`) > width) final = final.slice(0,-1);
    visible[visible.length - 1] = `${final.trimEnd()}...`;
  }
  return visible;
}
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
    if (right > left) rect(doc,left,y,right-left,5,toneColors[segment.tone] || p.line);
  }
  const pointer = x + clamp((scale.value - scale.min) / total,0,1) * w;
  doc.moveTo(pointer,y-5).lineTo(pointer-4,y-1).lineTo(pointer+4,y-1).closePath().fill(p.ink);
  txt(doc,scale.caption || '',x,y+8,w,6.8,p.muted);
}
function deltaText(metric) {
  if (metric.delta == null) return 'FIRST READING';
  const arrow = metric.delta > 0 ? 'UP' : metric.delta < 0 ? 'DOWN' : 'HOLDING STEADY';
  return metric.delta === 0 ? arrow : `${arrow} ${number(Math.abs(metric.delta))} vs previous`;
}
function vital(doc, key, title, metric, x, y, w, p) {
  rect(doc,x,y,w,72,p.panel,p.line,4);
  const tone = metric.band?.severity || 'neutral';
  const accent = toneColors[tone] || p.orange;
  rect(doc,x,y,4,72,accent,accent,1);
  txt(doc,title,x+12,y+5,84,9.3,p.ink,{bold:true});
  txt(doc,metric.estimated ? 'ESTIMATE' : 'CALCULATED',x+99,y+8,73,6.7,p.muted);
  txt(doc,number(metric.value),x+12,y+19,82,21,p.ink,{bold:true});
  txt(doc,metric.unit,x+93,y+30,70,7,p.muted);
  const status = metric.band?.label || (metric.value == null ? 'Not measured' : 'Personal baseline');
  const tagWidth = Math.min(149, Math.max(69, clean(status).length * 4.3 + 12));
  rect(doc,x+w-tagWidth-8,y+7,tagWidth,18,toneTags[tone] || p.deep);
  txt(doc,status,x+w-tagWidth-4,y+11,tagWidth-9,7,'#ffffff');
  if (metric.band?.scale) scale(doc,metric.band.scale,x+12,y+50,w-24,p);
  else if (metric.value != null) {
    doc.moveTo(x+12,y+51).lineTo(x+w-12,y+51).lineWidth(1).strokeColor(p.line).stroke();
    txt(doc,metric.band?.detail || 'Personal energy baseline',x+12,y+58,w-24,6.8,p.muted);
  }
  if (metric.value != null) txt(doc,deltaText(metric),x+w-143,y+30,133,7,p.muted,{align:'right'});
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
  // Filled, rounded exercise pictograms remain sharp at any print resolution.
  const ink = p.ink;
  doc.save().strokeColor(ink).fillColor(ink).lineCap('round').lineJoin('round').lineWidth(5.5);
  const limb = points => {
    doc.moveTo(x+points[0][0],y+points[0][1]);
    for (const [px,py] of points.slice(1)) doc.lineTo(x+px,y+py);
    doc.stroke();
  };
  if (kind === 0) { // squat
    doc.circle(x+20,y+6,4.2).fill();
    limb([[20,12],[19,21],[28,24],[30,18]]);
    limb([[19,21],[10,24],[9,34],[4,34]]);
    limb([[24,14],[33,15]]);
  } else if (kind === 1) { // sit-up
    doc.circle(x+9,y+14,4.2).fill();
    limb([[13,18],[19,24],[25,29]]);
    limb([[25,29],[31,17],[36,29]]);
    limb([[17,22],[25,19]]);
  } else if (kind === 2) { // push-up
    doc.circle(x+36,y+13,4).fill();
    limb([[32,17],[20,19],[9,19],[4,23]]);
    limb([[29,18],[28,30],[35,31]]);
    limb([[23,19],[22,30],[28,31]]);
  } else { // seated reach
    doc.circle(x+10,y+14,4.2).fill();
    limb([[11,20],[17,28],[34,29]]);
    limb([[14,22],[29,20],[36,22]]);
    limb([[18,28],[7,33]]);
  }
  doc.strokeColor(p.orange).lineWidth(1.5).moveTo(x+2,y+37).lineTo(x+39,y+37).stroke();
  doc.restore();
}

function evaluatorFeedback(doc, comments, p) {
  rect(doc,30,673,535,134,p.panel,p.line,3);
  rect(doc,30,673,4,134,p.orange,p.orange,1);
  txt(doc,'EVALUATOR FEEDBACK',42,681,290,10,p.ink,{bold:true});
  txt(doc,`${comments.length} ${comments.length === 1 ? 'NOTE' : 'NOTES'}`,452,683,100,7,p.muted,{align:'right'});
  doc.moveTo(42,699).lineTo(553,699).lineWidth(.8).strokeColor(p.line).stroke();
  if (!comments.length) {
    txt(doc,'Evaluator feedback will appear after review.',42,715,510,9,p.muted);
    return;
  }
  const hasMore = comments.length > 4;
  const shown = comments.slice(0,hasMore ? 3 : 4);
  const rowHeight = (101 - (hasMore ? 13 : 0)) / shown.length;
  shown.forEach((comment,index) => {
    const top = 702 + index * rowHeight;
    const meta = `${short(comment.CategoryName || 'General',22)}  |  ${short(comment.EvaluatorName || 'Evaluator',27)}  |  ${date(comment.DateEvaluated)}`;
    txt(doc,meta,42,top+1,510,7.2,p.muted);
    const lineCount = Math.min(4,Math.max(1,Math.floor((rowHeight-23)/8.6)+1));
    wrappedLines(doc,comment.CommentText || 'No written note.',507,7.8,lineCount)
      .forEach((line,lineIndex) => txt(doc,line,42,top+12+lineIndex*8.6,507,7.8,p.ink));
    if (index < shown.length - 1) doc.moveTo(42,top+rowHeight-1).lineTo(553,top+rowHeight-1).lineWidth(.5).strokeColor(p.line).stroke();
  });
  if (hasMore) txt(doc,`+ ${comments.length - shown.length} more ${comments.length - shown.length === 1 ? 'note' : 'notes'} in the student profile`,42,792,510,7.2,p.muted);
}

function renderFitnessReportPage(doc, { student, test, previous = null, assessment = null, template = 'dark' }) {
  const p = palettes[template] || palettes.dark;
  const a = assessment || assessTest(student,test,previous);
  doc.addPage({ size:'A4', margin:0 });
  doc.font('Report');
  doc.rect(0,0,W,H).fill(p.bg);
  motif(doc,p);
  doc.rect(0,0,W,6).fill(p.orange);

  // Identity follows the established report hierarchy: mark, photo, student.
  rect(doc,30,21,239,123,p.deep,p.deep,3);
  doc.image(LOGO,42,34,{fit:[63,75],align:'center',valign:'center'});
  txt(doc,'FITNESS',111,37,150,20,'#ffffff',{bold:true});
  txt(doc,'REPORT',111,62,150,20,'#ffffff',{bold:true});
  doc.moveTo(111,92).lineTo(256,92).lineWidth(1.8).strokeColor(p.orange).stroke();
  txt(doc,'KHAIMAH AL RIYADAH (MAROL)',111,99,151,7.8,'#ffffff');
  txt(doc,`TEST ${date(test.CreatedAt)}`,111,119,151,8.2,'#ffffff');

  rect(doc,278,21,104,123,p.paper,p.orange,3);
  doc.save().fillColor('#e4edec').strokeColor(p.line).lineWidth(1);
  doc.circle(330,61,13).fillAndStroke('#e4edec',p.line);
  doc.path('M 297 112 C 299 91, 310 82, 330 82 C 350 82, 361 91, 363 112 Z').fillAndStroke('#e4edec',p.line);
  doc.restore();
  txt(doc,'PHOTO',289,124,82,7.8,'#4d6a70',{align:'center'});

  rect(doc,391,21,174,49,p.deep,p.orange,2);
  nameLines(student.Name).forEach((line,index) => txt(doc,line,401,26+index*13,154,9.5,'#ffffff'));
  rect(doc,391,76,174,29,p.deep,p.line,2);
  txt(doc,`AGE ${a.ageYears ?? '-'}  |  ${short(student.Gender || '-',11)}`,401,83,154,9,'#ffffff');
  rect(doc,391,111,82,33,p.deep,p.line,2);
  rect(doc,480,111,85,33,p.deep,p.line,2);
  txt(doc,`TR ${student.TR ?? '-'}`,399,121,68,9,'#ffffff');
  txt(doc,short(student.Darajah || 'CLASS -',14),488,121,69,9,'#ffffff');

  doc.rect(0,154,W,38).fill(p.orange);
  txt(doc,`SCORE ${number(test.Total,0)}    GRADE ${short(test.Grade || '-',4)}`,30,164,245,13,p.deep,{bold:true});
  txt(doc,`${short(test.BatchName || 'Unbatched',27)}  |  ${test.SubmittedBy === 'Trainer' ? 'Trainer test' : test.SubmittedBy === 'Student' ? 'Self test' : 'Legacy source'}`,279,166,284,8.5,p.deep,{align:'right'});

  section(doc,'Fitness test',30,201,535,p);
  const performance = [['SQUATS',test.Squats,'reps'],['SIT UPS',test.SitUps,'reps'],['PUSH UPS',test.PushUps,'reps'],['FLEXIBILITY',test.SitAndReach,'cm']];
  performance.forEach(([title,value,unit],i) => {
    const x = 30+i*136;
    rect(doc,x,228,127,83,p.panel,p.line,3);
    rect(doc,x+8,234,111,18,p.deep);
    txt(doc,title,x+12,238,103,8.2,'#ffffff',{align:'center',bold:true});
    rect(doc,x+9,258,43,46,p.surface,p.surface,3);
    performanceGlyph(doc,i,x+10,262,p);
    txt(doc,number(value,title === 'FLEXIBILITY' ? 1 : 0),x+54,263,61,21,p.ink,{align:'right',bold:true});
    txt(doc,unit,x+54,291,61,7,p.muted,{align:'right'});
  });
  txt(doc,`STEP UP PULSE  ${number(test.StepUpPulseRate,0)} bpm`,30,316,535,8,p.muted);

  section(doc,'Four key vitals',30,333,330,p);
  const vitals = [['VO2Max','VO2 MAX'],['BMI','BMI'],['BodyFat','BODY FAT'],['BMR','BMR']];
  vitals.forEach(([key,label],i) => vital(doc,key,label,a.metrics[key],30,359+i*76,330,p));
  section(doc,'Body composition',373,333,192,p);
  rect(doc,373,359,192,300,p.deep,p.line,2);
  doc.save().translate(401,363).scale(.89);
  bodyFigure(doc,0,0,p);
  doc.restore();
  measure(doc,'Height',test.Height,'cm',381,397,p);
  measure(doc,'Neck',test.Neck,'cm',478,397,p,'right');
  measure(doc,'Waist',test.Waist,'cm',381,480,p);
  measure(doc,'Hips',test.Hips,'cm',478,480,p,'right');
  measure(doc,'Weight',test.Weight,'kg',381,626,p);

  evaluatorFeedback(doc,test.comments || [],p);
  doc.rect(0,818,W,24).fill(p.orange);
  txt(doc,'KHAIMAH AL RIYADAH  |  MAROL',30,824,290,7.2,p.deep,{bold:true});
  txt(doc,`TR ${student.TR ?? '-'}  |  ${date(test.CreatedAt)}`,343,824,220,7.2,p.deep,{align:'right'});
}

function createReportDocument() {
  const doc = new PDFDocument({ autoFirstPage:false, compress:true, info:{ Title:'Fitness profile report' } });
  doc.registerFont('Report',FONT);
  return doc;
}

module.exports = { createReportDocument, renderFitnessReportPage };
