// Episode 003 — Thai generative-AI adoption by generation. Look: dev-mono (flat black + yellow, mixed scene types).
// Source: True Corporation executive (Oliver Kittipong Veeratecha, Head of Brand & Communications), "Human Insights in the AI Era" event,
// reported by Marketing Oops (8 Aug 2026) and Relevant Audience (9 Aug 2026). Underlying survey/sample NOT published -> labelled on screen
// as a company presentation. Another True/Telenor-linked report (Digital Lives Decoded 2025, 1,000 Thai users) gives 91%; not used here.
window.STYLE_PRESET='dev-mono';
window.EN_EXTRA=[['เจนเนอเรทีฟเอไอ','Generative AI'],['เจนซี','Gen Z'],['เจนวาย','Gen Y'],['เจนเอ็กซ์','Gen X'],['ทรู','True']];
const SRC='True Corporation · ส.ค. 2026 (จากการนำเสนอของบริษัท)';
const SCENES = [
 {id:'headline', dur:6, h1:'คนไทย 75%', h1Size:88, h2:'ใช้ Generative AI แล้ว', h2Size:54, card:{label:'คุณ', text:'ฉันอยู่กลุ่มไหนนะ?', ph:3},
  subs:["คนไทยเจ็ดสิบห้าเปอร์เซ็นต์","ใช้เจนเนอเรทีฟเอไอแล้ว","แต่แต่ละรุ่นใช้ไม่เท่ากัน","คุณอยู่กลุ่มไหน"]},
 {id:'ticker', dur:9, kicker:'<span style="font-size:46px;font-weight:800;color:#fff">Gen Z</span> &nbsp;ใช้ Generative AI แล้ว',
  tick:{ph:2,value:85,unit:'%',sub:'สูงสุดในสามรุ่น',subPh:3,src:SRC},
  subs:["กลุ่มแรก เจนซี","ใช้เจนเนอเรทีฟเอไอแล้ว","แปดสิบห้าเปอร์เซ็นต์","สูงสุดในสามรุ่นนี้","นำโด่งเลย"]},
 {id:'bars', dur:8, title:'Gen Y เทียบ Gen Z', src:SRC,
  rows:[{label:'Gen Y',value:80,ph:1,hi:true},{label:'Gen Z',value:85,ph:2}],
  subs:["กลุ่มที่สอง เจนวาย","ใช้อยู่แปดสิบเปอร์เซ็นต์","ตามหลังเจนซี","แค่นิดเดียว"]},
 {id:'pictogram', dur:9, kicker:'Gen X', pic:{ph:1,pct:50,total:10,big:'5 ใน 10',bigPh:2,src:SRC},
  subs:["กลุ่มที่สาม เจนเอ็กซ์","ใช้อยู่ห้าสิบเปอร์เซ็นต์","คือครึ่งหนึ่งของรุ่น","อีกครึ่งยังไม่ได้ใช้"]},
 {id:'stack', dur:18, title:'ตัวเลขทั้งหมด', src:'True Corporation · ส.ค. 2026', srcPh:7,
  rows:[{k:'Gen Z',v:'85%',ph:1},{k:'Gen Y',v:'80%',ph:2},{k:'Gen X',v:'50%',ph:3},{k:'นักการตลาดใช้ AI ในงาน',v:'73%',ph:4},{k:'ความพร้อมด้าน AI ขององค์กร',v:'~10%',ph:5,c:'#ff5a5f'}],
  subs:["สรุปตัวเลข แคปหน้าจอไว้เลย","เจนซี แปดสิบห้าเปอร์เซ็นต์","เจนวาย แปดสิบเปอร์เซ็นต์","เจนเอ็กซ์ ห้าสิบเปอร์เซ็นต์","นักการตลาดใช้เอไอในงานแล้ว เจ็ดสิบสามเปอร์เซ็นต์","แต่ความพร้อมด้านเอไอขององค์กร","ยังอยู่ราวสิบเปอร์เซ็นต์","ตัวเลขทั้งหมดมาจากการนำเสนอของทรู","ไม่ใช่งานวิจัยอิสระ"]},
 {id:'steps', dur:14, n:4, name:'เริ่มใช้ AI',
  items:[{k:'ขั้นที่ 1',t:'ถามเรื่องที่ทำทุกวัน',ph:1},{k:'ขั้นที่ 2',t:'ให้ช่วยร่างงานจริง',ph:2},{k:'ขั้นที่ 3',t:'ตรวจคำตอบก่อนใช้',ph:3},{k:'ขั้นที่ 4',t:'เก็บคำสั่งที่ใช้ได้ผล',ph:4}],
  subs:["ถ้ายังไม่ได้เริ่ม ลองแบบนี้","ขั้นแรก ถามเรื่องที่ทำอยู่ทุกวัน","ขั้นสอง ให้ช่วยร่างงานจริง","ขั้นสาม ตรวจคำตอบก่อนใช้เสมอ","ขั้นสี่ เก็บคำสั่งที่ใช้ได้ผลไว้","แค่นี้ก็ตามเพื่อนทันแล้ว"]},
 {id:'type', dur:5, lead:'คุณอยู่กลุ่มไหน?', key:'Gen Z / Y / X', keySize:50, note:'{ คอมเมนต์ไว้ }', share:'แล้วแชร์ให้เพื่อน', keyPh:1, notePh:2,
  subs:["คุณอยู่กลุ่มไหน","คอมเมนต์ไว้","แล้วแชร์ให้เพื่อน"]},
];
if (typeof module!=='undefined') module.exports = SCENES;
