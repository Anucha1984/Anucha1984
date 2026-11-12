// Episode 003 — Thai generative-AI adoption by generation.
// Source: True Corporation executive (Oliver Kittipong Veeratecha, Head of Brand & Communications), "Human Insights in the AI Era" event,
// reported by Marketing Oops (8 Aug 2026) and Relevant Audience (9 Aug 2026). Underlying survey/sample NOT published -> shown on screen as a company presentation.
// Another True/Telenor-linked report (Digital Lives Decoded 2025, 1,000 Thai users) gives a different adoption figure (91%); not used here.
window.EN_EXTRA=[['เจนเนอเรทีฟเอไอ','Generative AI'],['เจนซี','Gen Z'],['เจนวาย','Gen Y'],['เจนเอ็กซ์','Gen X'],['ทรู','True']];
const SRC='True Corporation · ส.ค. 2026 (ข้อมูลจากการนำเสนอของบริษัท)';
const SCENES = [
 {id:'hook', color:'#e2334a', dur:6, chip:'', title:'คนไทย 75%', titleSize:118, line:'ใช้ <span class="gold">Generative AI</span> แล้ว', box:'คุณอยู่กลุ่มไหน?',
  subs:["คนไทยเจ็ดสิบห้าเปอร์เซ็นต์","ใช้เจนเนอเรทีฟเอไอแล้ว","แต่แต่ละรุ่นใช้ไม่เท่ากัน","คุณอยู่กลุ่มไหน"]},
 {id:'tool', rank:1, label:'รุ่นที่', big:'Gen Z', small:'ใช้ Generative AI แล้ว', th:'', en:'Gen Z', color:'#4f7cff', dur:9,
  stat:{ph:1,numPh:2,barPh:2,value:85,unit:'%',label:'ใช้ Generative AI แล้ว',pct:85,note:'ของคนรุ่นนี้',src:SRC},
  subs:["กลุ่มแรก เจนซี","ใช้เจนเนอเรทีฟเอไอแล้ว","แปดสิบห้าเปอร์เซ็นต์","สูงสุดในสามรุ่นนี้","นำโด่งเลย"],
  chips:[{t:'สูงสุดในสามรุ่น',ph:3,f:.3},{t:'ราว 8 ใน 10 คน',ph:3,f:.7}], chipLabelPh:3, chipLabel:'ตัวเลขนี้แปลว่า', punch:{t:'นำเป็นอันดับหนึ่ง',ph:4}},
 {id:'tool', rank:2, label:'รุ่นที่', big:'Gen Y', small:'ใช้ Generative AI แล้ว', th:'', en:'Gen Y', color:'#19b8a6', dur:8,
  stat:{ph:1,numPh:2,barPh:2,value:80,unit:'%',label:'ใช้ Generative AI แล้ว',pct:80,note:'ของคนรุ่นนี้',src:SRC},
  subs:["กลุ่มที่สอง เจนวาย","ใช้อยู่แปดสิบเปอร์เซ็นต์","ตามหลังเจนซี","แค่นิดเดียว"],
  chips:[{t:'ตามหลัง Gen Z',ph:2,f:.5},{t:'ห่างกันแค่ 5 จุด',ph:3,f:.2}], chipLabelPh:2, chipLabel:'ตัวเลขนี้แปลว่า', punch:{t:'ตามมาติดๆ',ph:3}},
 {id:'tool', rank:3, label:'รุ่นที่', big:'Gen X', small:'ใช้ Generative AI แล้ว', th:'', en:'Gen X', color:'#e8892b', dur:9,
  stat:{ph:1,numPh:2,barPh:2,value:50,unit:'%',label:'ใช้ Generative AI แล้ว',pct:50,note:'ของคนรุ่นนี้',src:SRC},
  subs:["กลุ่มที่สาม เจนเอ็กซ์","ใช้อยู่ห้าสิบเปอร์เซ็นต์","คือครึ่งหนึ่งของรุ่น","อีกครึ่งยังไม่ได้ใช้"],
  chips:[{t:'ครึ่งหนึ่งของรุ่น',ph:2,f:.4},{t:'น้อยสุดในสามรุ่น',ph:3,f:.2}], chipLabelPh:2, chipLabel:'ตัวเลขนี้แปลว่า', punch:{t:'ครึ่งต่อครึ่ง',ph:3}},
 {id:'sum', color:'#e6b450', dur:18, chip:'สรุป', title:'ตัวเลขทั้งหมด', badgeSize:32,
  subs:["สรุปตัวเลข แคปหน้าจอไว้เลย","เจนซี แปดสิบห้าเปอร์เซ็นต์","เจนวาย แปดสิบเปอร์เซ็นต์","เจนเอ็กซ์ ห้าสิบเปอร์เซ็นต์","นักการตลาดใช้เอไอในงานแล้ว เจ็ดสิบสามเปอร์เซ็นต์","แต่ความพร้อมด้านเอไอขององค์กร","ยังอยู่ราวสิบเปอร์เซ็นต์","ตัวเลขทั้งหมดมาจากการนำเสนอของทรู","ไม่ใช่งานวิจัยอิสระ"],
  rows:[['รุ่นนี้ใช้แล้ว','Gen Z · 85%','#4f7cff'],['รุ่นนี้ใช้แล้ว','Gen Y · 80%','#19b8a6'],['รุ่นนี้ใช้แล้ว','Gen X · 50%','#e8892b'],['นักการตลาด','ใช้ AI ในงาน 73%','#9a5cf0'],['ความพร้อมขององค์กร','ราว 10%','#e0409a']]},
 {id:'sum', color:'#19b8a6', dur:14, chip:'เริ่มยังไง', title:'ถ้ายังไม่ได้เริ่ม', badgeSize:28,
  subs:["ถ้ายังไม่ได้เริ่ม ลองแบบนี้","ขั้นแรก ถามเรื่องที่ทำอยู่ทุกวัน","ขั้นสอง ให้ช่วยร่างงานจริง","ขั้นสาม ตรวจคำตอบก่อนใช้เสมอ","ขั้นสี่ เก็บคำสั่งที่ใช้ได้ผลไว้","แค่นี้ก็ตามเพื่อนทันแล้ว"],
  rows:[['ขั้นที่ 1','ถามเรื่องที่ทำทุกวัน','#4f7cff'],['ขั้นที่ 2','ให้ช่วยร่างงานจริง','#19b8a6'],['ขั้นที่ 3','ตรวจคำตอบก่อนใช้','#e8892b'],['ขั้นที่ 4','เก็บคำสั่งที่ใช้ได้ผล','#e0409a']]},
 {id:'cta', color:'#9a5cf0', dur:5, chip:'', head:'คุณอยู่<br><span class="gold">กลุ่มไหน?</span>', foot:'คอมเมนต์ไว้ แล้วแชร์ให้เพื่อน',
  subs:["คุณอยู่กลุ่มไหน","คอมเมนต์ไว้","แล้วแชร์ให้เพื่อน"]},
];
if (typeof module!=='undefined') module.exports = SCENES;
