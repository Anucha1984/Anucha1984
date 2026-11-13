const {chromium}=require('playwright');const {spawn}=require('child_process');const path=require('path');
const [logo,sfx,out]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1.5});
await p.goto('file://'+path.join(__dirname,'outro.html')+'?logo='+encodeURIComponent('file://'+path.resolve(logo)));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
const fps=30,n=Math.round(3.2*fps);
const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',''+fps,'-c:v','mjpeg','-i','-','-i',sfx,'-filter_complex','[1:a]adelay=250|250,apad=whole_dur=3.2[a]','-map','0:v','-map','[a]','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-c:a','aac','-b:a','160k','-t','3.2',out],{stdio:['pipe','inherit','inherit']});
for(let i=0;i<n;i++){await p.evaluate(t=>renderAt(t),i/fps);const buf=await p.screenshot({type:'jpeg',quality:92});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done',out);})();
