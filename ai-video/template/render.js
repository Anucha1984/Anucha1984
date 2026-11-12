const {chromium}=require('playwright');const {spawn}=require('child_process');const path=require('path');
(async()=>{
  const still=process.argv[2]==='still';
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1.5});
  await p.goto('file://'+path.join(__dirname,'index.html'));await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{renderAt(0)});await p.waitForTimeout(400);await p.evaluate(()=>document.fonts.ready);
  const total=await p.evaluate(()=>TOTAL);
  if(still){for(const t of process.argv.slice(3)){await p.evaluate(t=>renderAt(t),+t);await p.screenshot({path:`still_${t}.jpg`,quality:80,type:'jpeg',scale:'css'});}await b.close();return;}
  const fps=30,n=Math.round(total*fps);
  const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',''+fps,'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','video.mp4'],{stdio:['pipe','inherit','inherit']});
  for(let i=0;i<n;i++){await p.evaluate(t=>renderAt(t),i/fps);const buf=await p.screenshot({type:'jpeg',quality:92});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%300==0)console.log(i,'/',n);}
  ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done',total);
})();
