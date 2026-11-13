"""Generate short synthetic shout options with Gemini TTS. Key from env GEMINI_API_KEY. Not an imitation of any real person."""
import os,sys,json,base64,subprocess,urllib.request,time
K=os.environ.get('GEMINI_API_KEY') or sys.exit('set GEMINI_API_KEY')
WORD=os.environ.get('WORD','ไอ้สัส'); PRE=os.environ.get('PREFIX','')
OPTS=[('a_hoarse_uncle','Algenib',"Shout this single Thai exclamation like a cranky, hoarse middle-aged Thai uncle who just got annoyed. Sudden, loud, comedic, very short"),
      ('b_deep_bark','Charon',"Bark this single Thai exclamation in a deep, gruff, irritated voice. Loud, punchy, comedic, very short"),
      ('c_rasp_snap','Alnilam',"Snap this single Thai exclamation in a raspy, exasperated voice, like being fed up. Loud, quick, comedic, very short")]
ONLY=[x for x in os.environ.get('ONLY','').split(',') if x]
for name,voice,style in OPTS:
    if ONLY and name not in ONLY: continue
    body={"contents":[{"parts":[{"text":style+": "+WORD+"!"}]}],"generationConfig":{"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":voice}}}}}
    req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",json.dumps(body).encode(),{"Content-Type":"application/json","x-goog-api-key":K})
    p=None
    for a in range(5):
        try: p=json.load(urllib.request.urlopen(req,timeout=120))['candidates'][0]['content']['parts'][0]['inlineData'];break
        except Exception as e: print(name,'retry',str(e)[:90]);time.sleep(20*(a+1))
    if not p: print(name,'FAILED');continue
    open(f'sfx/{PRE}{name}.raw','wb').write(base64.b64decode(p['data']))
    pre=['-f','s16le','-ar','24000','-ac','1'] if 'l16' in p.get('mimeType','').lower() else []
    tmp=f'sfx/{PRE}{name}.tmp.wav'
    # trim leading/trailing silence only; loudnorm is NOT used (it silences very short clips)
    subprocess.run(['ffmpeg','-v','error','-y']+pre+['-i',f'sfx/{PRE}{name}.raw','-af','silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',tmp],check=True)
    m=subprocess.run(['ffmpeg','-i',tmp,'-af','volumedetect','-f','null','-'],capture_output=True,text=True).stderr
    peak=float([l for l in m.splitlines() if 'max_volume' in l][0].split('max_volume:')[1].split('dB')[0])
    gain=-2.0-peak                                   # peak -2 dBFS
    subprocess.run(['ffmpeg','-v','error','-y','-i',tmp,'-af',f'volume={gain}dB,alimiter=limit=0.89,afade=t=in:st=0:d=0.005,afade=t=out:st=0.0:d=0.0',f'sfx/{PRE}{name}.mp3'],check=True)
    os.remove(tmp)
    os.remove(f'sfx/{PRE}{name}.raw'); print(name,'ok')
