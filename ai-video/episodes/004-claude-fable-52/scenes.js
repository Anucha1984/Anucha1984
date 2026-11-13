// Episode 004 — Claude Fable 5.2 / Mythos 5.2 (released 9 Nov 2026). Look: rotation (004 -> dev-mono).
// Facts (agreeing outlets: TechCrunch 9 Nov, MacRumors 9 Nov, The Next Web / Resultsense 10 Nov 2026):
//  - Released 9 Nov 2026. Fable 5.2: $8/M input, $40/M output (Fable 5.1: $10/$50) = 20% cheaper. Output ~30% faster ("up to"), Anthropic's own claim.
//  - Fast mode up to 2.5x token speed (Claude Code, Claude Platform, Google Cloud, Microsoft Foundry).
//  - Fable and Mythos = same base model, different safeguards; Mythos 5.2 only for orgs verified via Cyber / Life Sciences programs.
//  - Ahead of Opus 5.5 on 10 of 11 general benchmarks in Anthropic's own table (self-reported).
//  - System card: Mythos 5.2 shows stronger covert capabilities in some evals; both models suspect evaluation more often (Anthropic's own report).
// Not independently verified: all benchmark/speed numbers are Anthropic's claims; primary Anthropic page not opened.
window.EN_EXTRA=[['คล็อด เฟเบิล ห้าจุดสอง','Claude Fable 5.2'],['เฟเบิล ห้าจุดสอง','Fable 5.2'],['เฟเบิล ห้าจุดหนึ่ง','Fable 5.1'],['โอปุส ห้าจุดห้า','Opus 5.5'],['ห้าจุดหนึ่ง','5.1'],['ห้าจุดสอง','5.2'],['เฟเบิล','Fable'],['ไมธอส','Mythos'],['แอนโทรปิก','Anthropic'],['เอดับเบิลยูเอส','AWS'],['กูเกิลคลาวด์','Google Cloud'],['แอซัวร์','Azure']];
const SRC='TechCrunch · The Next Web · พ.ย. 2026';
const SCENES = [
 {id:'headline', dur:7, h1:'Claude Fable 5.2', h1Size:62, h2:'ออกใหม่ 9 พ.ย.', h2Size:58, card:{label:'คุณ', text:'ต่างจากเดิมยังไง?', ph:3},
  subs:["แอนโทรปิกปล่อย คล็อด เฟเบิล ห้าจุดสอง","เมื่อวันที่เก้าพฤศจิกายน","คำถามคือ","ต่างจากเดิมยังไง"]},
 {id:'ticker', dur:10, kicker:'ราคา Fable 5.2 · ต่อล้านโทเคนขาเข้า', tick:{ph:1,value:8,icon:'$',unit:'',size:200,sub:'ขาออก $40 · ลง 20% จากรุ่น 5.1',subPh:3,src:SRC},
  subs:["เรื่องแรก ราคา","ขาเข้าแปดดอลลาร์ ต่อล้านโทเคน","ขาออกสี่สิบดอลลาร์","ถูกลงยี่สิบเปอร์เซ็นต์","จากเฟเบิล ห้าจุดหนึ่ง"]},
 {id:'stack', dur:14, title:'ของใหม่ที่ประกาศ', src:SRC, srcPh:6,
  rows:[{k:'ความเร็วเอาต์พุต',v:'เร็วขึ้นสูงสุด 30%',ph:1},{k:'โหมดเร็ว Claude Code',v:'สูงสุด 2.5 เท่า',ph:2},{k:'ราคา',v:'ลง 20%',ph:3},{k:'แพลตฟอร์ม',v:'AWS·Google·Azure',ph:4}],
  subs:["สรุปของใหม่","เอาต์พุตเร็วขึ้นสูงสุดสามสิบเปอร์เซ็นต์","มีโหมดเร็ว เร็วขึ้นสูงสุดสองเท่าครึ่ง","ราคาลงยี่สิบเปอร์เซ็นต์","ใช้ได้บนเอดับเบิลยูเอส กูเกิลคลาวด์ และแอซัวร์","ตัวเลขความเร็วเป็นของแอนโทรปิกเอง"]},
 {id:'compare', dur:14, title:'Fable เทียบ Mythos', src:SRC,
  left:{title:'Fable 5.2',sub:'ทุกคนใช้ได้',ph:1,hi:true,items:[{t:'ตัวกันความเสี่ยง ไซเบอร์/ชีวภาพ เข้มกว่า',ph:3},{t:'ใช้ผ่านแพลตฟอร์มทั่วไป',ph:3}]},
  right:{title:'Mythos 5.2',sub:'เฉพาะองค์กรที่ผ่านการยืนยัน',ph:1,items:[{t:'ข้อจำกัดน้อยกว่า ด้านไซเบอร์/ชีวภาพ',ph:4},{t:'โครงการ Cyber / Life Sciences',ph:5}]},
  subs:["แล้ว เฟเบิล กับ ไมธอส ต่างกันยังไง","สองตัวนี้คือโมเดลฐานเดียวกัน","ต่างกันที่ตัวกันความเสี่ยง","เฟเบิลทุกคนใช้ได้","ไมธอสจำกัดเฉพาะองค์กรที่ผ่านการยืนยัน","ด้านไซเบอร์และชีววิทยา"]},
 {id:'pictogram', dur:12, kicker:'Fable 5.2 เทียบ Opus 5.5', pic:{ph:2,pct:91,total:11,big:'10 จาก 11',bigPh:3,src:'เบนช์มาร์กที่ Anthropic เผยแพร่ (ผลทดสอบของบริษัทเอง)'},
  subs:["แอนโทรปิกบอกว่า","เฟเบิลห้าจุดสอง ชนะโอปุสห้าจุดห้า","สิบจากสิบเอ็ดเบนช์มาร์ก","ที่แอนโทรปิกเผยแพร่","แต่เป็นผลทดสอบของบริษัทเอง"]},
 {id:'headline', dur:12, h1:'ข้อควรระวัง', h1Size:62, h2:'จากรายงานของ Anthropic', h2Size:40, card:{label:'โมเดล', text:'ฉันกำลังถูกประเมินอยู่หรือเปล่า?', ph:4},
  subs:["แต่มีข้อควรระวัง","ในรายงานระบบของแอนโทรปิกเอง","ไมธอสมีความสามารถแอบแฝงสูงขึ้น ในบางการทดสอบ","และทั้งสองรุ่นสงสัยว่ากำลังถูกประเมิน","บ่อยขึ้นกว่ารุ่นก่อน","เลยคาดเดาพฤติกรรมจริงยากขึ้น"]},
 {id:'type', dur:5, lead:'คุณจะลองตัวไหน?', key:'Fable 5.2', keySize:52, note:'{ คอมเมนต์ไว้ }', share:'แล้วแชร์ให้เพื่อน', keyPh:1, notePh:2,
  subs:["คุณจะลองเฟเบิลไหม","คอมเมนต์ไว้","แล้วแชร์ให้เพื่อน"]},
];
if (typeof module!=='undefined') module.exports = SCENES;
