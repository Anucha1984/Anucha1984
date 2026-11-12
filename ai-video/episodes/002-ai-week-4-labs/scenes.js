// Episode 002 — four labs shipped new AI in one week (news of 4–11 Nov 2026).
// Facts: Meta item from TechCrunch (9 Nov 2026); the other three from The Neuron daily digest (11 Nov 2026) and release trackers.
window.EN_EXTRA=[['เจมิไน โฟร์ คาร์บอน','Gemini 4 Carbon'],['คล็อด เฟเบิล ห้าจุดสอง','Claude Fable 5.2'],['คล็อด เฟเบิล','Claude Fable'],['มิวส์ เอมเบอร์','Muse Ember'],['จีพีทีซิกซ์ ไซเบอร์','GPT-6 Cyber'],['แอนโทรปิก','Anthropic'],['โอเพ่นเอไอ','OpenAI'],['เมตา','Meta'],['เอเจนต์','Agent']];
const SRC='The Neuron · พ.ย. 2026';
const SCENES = [
 {id:'hook', color:'#e2334a', dur:6, chip:'', title:'AI ใหม่ 4 ค่าย', titleSize:104, line:'ออกพร้อมกันใน<span class="gold">สัปดาห์เดียว</span>', box:'ตัวไหนเกี่ยวกับคุณ?',
  subs:["สัปดาห์เดียว","เอไอตัวใหม่ออกพร้อมกันสี่ค่าย","แต่ละตัวทำมาเพื่อคนละงาน","ตัวไหนเกี่ยวกับคุณ","ดูจบรู้เลย"]},
 {id:'tool', rank:1, label:'ค่ายที่', big:'Gemini 4 Carbon', bigSize:54, small:'Google · เปิดให้ใช้ 10 พ.ย.', th:'', en:'Gemini', color:'#4f7cff', dur:10, src:SRC,
  subs:["ค่ายแรก กูเกิล","เปิดตัว เจมิไน โฟร์ คาร์บอน","รุ่นท็อปสำหรับงานเขียนโค้ด","งานวิจัย และงานเอเจนต์หลายขั้นตอน","ตอนนี้ใช้ได้เฉพาะแพ็กเกจจ่ายเงิน"],
  chips:[{t:'เขียนโค้ด',ph:2,f:.3},{t:'งานวิจัย',ph:3,f:0},{t:'Agent หลายขั้นตอน',ph:3,f:.4}], chipLabelPh:2, chipLabel:'ทำมาเพื่อ', punch:{t:'ตอนนี้เฉพาะแพ็กเกจจ่ายเงิน',ph:4}},
 {id:'tool', rank:2, label:'ค่ายที่', big:'Claude Fable 5.2', bigSize:54, small:'Anthropic · ออก 9 พ.ย.', th:'', en:'Claude', color:'#e8892b', dur:9, src:SRC,
  subs:["ค่ายที่สอง แอนโทรปิก","ปล่อย คล็อด เฟเบิล ห้าจุดสอง","เน้นงานเทคนิคขั้นสูง","ใครทำงานซับซ้อน","ตัวนี้น่าลอง"],
  chips:[{t:'งานเทคนิคขั้นสูง',ph:2,f:.2}], chipLabelPh:2, chipLabel:'เน้นเรื่อง', punch:{t:'งานซับซ้อน น่าลอง',ph:3}},
 {id:'tool', rank:3, label:'ค่ายที่', big:'Muse Ember', bigSize:66, small:'Meta · ออก 9 พ.ย.', th:'', en:'Muse', color:'#19b8a6', dur:9, src:'TechCrunch · 9 พ.ย. 2026',
  subs:["ค่ายที่สาม เมตา","ออก มิวส์ เอมเบอร์","โมเดลตัวเล็ก ราคาประหยัดที่สุดของค่าย","ไว้ให้เอเจนต์ทำงานแทนเรา"],
  chips:[{t:'ตัวเล็กสุดของค่าย',ph:2,f:.1},{t:'ประหยัดสุดของค่าย',ph:2,f:.5},{t:'งาน Agent',ph:3,f:.2}], chipLabelPh:2, chipLabel:'จุดเด่น', punch:{t:'เล็ก ประหยัด ไว้รัน Agent',ph:3}},
 {id:'tool', rank:4, label:'ค่ายที่', big:'GPT-6 Cyber', bigSize:66, small:'OpenAI', th:'', en:'GPT', color:'#e0409a', dur:10, src:SRC,
  subs:["ค่ายที่สี่ โอเพ่นเอไอ","เปิด จีพีทีซิกซ์ ไซเบอร์","เอไอสำหรับงานความปลอดภัย","หาช่องโหว่ และทดสอบเจาะระบบ","แต่ใช้ได้เฉพาะลูกค้าที่ได้รับอนุมัติ"],
  chips:[{t:'งานความปลอดภัย',ph:2,f:.2},{t:'หาช่องโหว่',ph:3,f:0},{t:'ทดสอบเจาะระบบ',ph:3,f:.45}], chipLabelPh:2, chipLabel:'ทำมาเพื่อ', punch:{t:'เฉพาะลูกค้าที่ได้รับอนุมัติ',ph:4}},
 {id:'sum', color:'#e6b450', dur:11, chip:'สรุป', title:'ใครควรตามตัวไหน', badgeSize:32,
  subs:["สรุป แคปหน้าจอไว้เลย","โค้ดกับวิจัย ดูเจมิไน โฟร์ คาร์บอน","งานเทคนิคขั้นสูง ดูคล็อด เฟเบิล","รันเอเจนต์แบบประหยัด ดูมิวส์ เอมเบอร์","สายความปลอดภัย ดูจีพีทีซิกซ์ ไซเบอร์"],
  rows:[['โค้ด + วิจัย','Gemini 4 Carbon','#4f7cff'],['เทคนิคขั้นสูง','Claude Fable 5.2','#e8892b'],['รัน Agent ประหยัด','Muse Ember','#19b8a6'],['ความปลอดภัย','GPT-6 Cyber','#e0409a']]},
 {id:'cta', color:'#9a5cf0', dur:5, chip:'', head:'ตามข่าว AI<br><span class="gold">ให้ทันทุกสัปดาห์</span>', foot:'ให้เพื่อนที่ยังตามข่าว AI ไม่ทัน',
  subs:["เซฟไว้","แล้วแชร์ให้เพื่อน","ที่ยังตามข่าวเอไอไม่ทัน"]},
];
if (typeof module!=='undefined') module.exports = SCENES;
