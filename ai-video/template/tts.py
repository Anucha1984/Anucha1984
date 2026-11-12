"""Gemini TTS: one clip per scene, text = scene subs joined. Key from env GEMINI_API_KEY (or API_KEY). Never hardcode the key."""
import os,sys,json,re,base64,subprocess,urllib.request,time
K=os.environ.get('GEMINI_API_KEY') or os.environ.get('API_KEY')
if not K: sys.exit('Set GEMINI_API_KEY (Google AI Studio key)')
MODEL=os.environ.get('TTS_MODEL','gemini-2.5-flash-preview-tts'); VOICE=os.environ.get('TTS_VOICE','Charon')
S=[' '.join(json.loads('['+m+']')) for m in re.findall(r"subs:\[(.*?)\]",open('scenes.js').read())]
STYLE="You are a popular Thai male tech content creator narrating a TikTok explainer. Speak natural Bangkok Thai: confident, warm, energetic, fairly fast, very short pauses. Pronounce every English brand or tech word the way Thai people say it, with a Thai accent, never with an American accent:\n\n"
os.makedirs('vo',exist_ok=True)
for i,text in enumerate(S):
    if os.path.exists(f'vo/{i}.mp3'): continue
    body={"contents":[{"parts":[{"text":STYLE+text}]}],"generationConfig":{"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":VOICE}}}}}
    req=urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",json.dumps(body).encode(),{"Content-Type":"application/json","x-goog-api-key":K})
    p=None
    for a in range(5):
        try: p=json.load(urllib.request.urlopen(req,timeout=120))['candidates'][0]['content']['parts'][0]['inlineData'];break
        except Exception as e: print(i,'retry',str(e)[:100]);time.sleep(8*(a+1))
    if not p: sys.exit(f'scene {i} failed')
    open(f'vo/{i}.raw','wb').write(base64.b64decode(p['data']))
    pre=['-f','s16le','-ar','24000','-ac','1'] if 'l16' in p.get('mimeType','').lower() else []
    subprocess.run(['ffmpeg','-v','error','-y']+pre+['-i',f'vo/{i}.raw',f'vo/{i}.mp3'],check=True);os.remove(f'vo/{i}.raw')
    print(i,'ok')
