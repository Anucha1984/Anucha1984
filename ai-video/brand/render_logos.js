const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:1000},deviceScaleFactor:1});
for(let i=1;i<=6;i++){await p.goto('file://'+path.join(__dirname,'logos.html')+'?l='+i);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(350);await p.screenshot({path:path.join(__dirname,'out',`logo_${i}.png`)});}
await b.close();console.log('ok');})();
