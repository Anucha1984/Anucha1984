"""Generate short synthetic shout options with Gemini TTS. Key from env GEMINI_API_KEY. Not an imitation of any real person."""
import os,sys,json,base64,subprocess,urllib.request,time
K=os.environ.get('GEMINI_API_KEY') or sys.exit('set GEMINI_API_KEY')
OPTS=[('a_hoarse_uncle','Algenib',"Shout this single Thai exclamation like a cranky, hoarse middle-aged Thai uncle who just got annoyed. Sudden, loud, comedic, very short"),
      ('b_deep_bark','Charon',"Bark this single Thai exclamation in a deep, gruff, irritated voice. Loud, punchy, comedic, very short"),
      ('c_rasp_snap','Alnilam',"Snap this single Thai exclamation in a raspy, exasperated voice, like being fed up. Loud, quick, comedic, very short")]
for name,voice,style in OPTS:
    body={"contents":[{"parts":[{"text":style+": ไอ้สัส!"}]}],"generationConfig":{"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":voice}}}}}
    req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",json.dumps(body).encode(),{"Content-Type":"application/json","x-goog-api-key":K})
    p=None
    for a in range(5):
        try: p=json.load(urllib.request.urlopen(req,timeout=120))['candidates'][0]['content']['parts'][0]['inlineData'];break
        except Exception as e: print(name,'retry',str(e)[:90]);time.sleep(8*(a+1))
    if not p: print(name,'FAILED');continue
    open(f'sfx/{name}.raw','wb').write(base64.b64decode(p['data']))
    pre=['-f','s16le','-ar','24000','-ac','1'] if 'l16' in p.get('mimeType','').lower() else []
    subprocess.run(['ffmpeg','-v','error','-y']+pre+['-i',f'sfx/{name}.raw','-af','silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_silence=0.15:stop_threshold=-45dB,loudnorm=I=-12:TP=-1.5,afade=t=out:st=0:d=0.01',f'sfx/{name}.mp3'],check=True)
    os.remove(f'sfx/{name}.raw'); print(name,'ok')
