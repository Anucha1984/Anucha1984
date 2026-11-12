import json,os,subprocess,wave,re
import numpy as np
SR=44100
src=open('scenes.js').read()
durs=[float(x) for x in re.findall(r"dur:([0-9.]+)",src)]
subs=[json.loads('['+m+']') for m in re.findall(r"subs:\[(.*?)\]",src)]
N=len(durs); rng=np.random.default_rng(3)
def load(i):
    f=f'vo/{i}.mp3'
    if not os.path.exists(f): return None
    raw=subprocess.run(['ffmpeg','-v','error','-i',f,'-af','atempo='+os.environ.get('TEMPO','1.0'),'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
    a=np.frombuffer(raw,dtype=np.float32).copy()
    w=int(SR*.02); env=np.sqrt(np.convolve(a*a,np.ones(w)/w,'same')); on=np.where(env>.04*env.max())[0]
    return a[max(0,on[0]-int(.03*SR)):on[-1]+int(.08*SR)]
def phrase_times(a,ph,dur):
    tot=sum(len(x)+3 for x in ph);p=0;est=[]
    for x in ph: est.append(p/tot*dur);p+=len(x)+3
    if a is None: return est
    w=int(SR*.02);env=np.sqrt(np.convolve(a*a,np.ones(w)/w,'same'));sil=env<.06*env.max()
    pauses=[];i=0
    while i<len(sil):
        if sil[i]:
            j=i
            while j<len(sil) and sil[j]: j+=1
            if (j-i)/SR>=.09 and i>0 and j<len(sil): pauses.append((i/SR,j/SR))
            i=j
        else: i+=1
    out=[0.0];last=0
    for e in est[1:]:
        c=[q for q in pauses if q[1]>last+.25 and abs(q[1]-e)<.9]
        if c:
            q=min(c,key=lambda q:abs(q[1]-e)-.5*(q[1]-q[0])); t=q[1]-.04
        else: t=max(e,last+.3)
        out.append(round(t,3));last=t
    return out
T=[];voice=[];t0=0;missing=[]
for i in range(N):
    a=load(i)
    if a is None: missing.append(i);d=durs[i]
    else: d=len(a)/SR+(1.3 if i==N-1 else .62)
    T.append({'dur':round(d,3),'pt':phrase_times(a,subs[i],d if a is None else len(a)/SR)});voice.append((t0,a));t0+=d
total=t0;n=int(total*SR)+SR//10
open('timings.js','w').write('window.TIMINGS='+json.dumps(T)+';')
V=np.zeros(n);
for s,a in voice:
    if a is not None: V[int(s*SR):int(s*SR)+len(a)]+=a
V/=max(1e-9,np.abs(V).max())
t=np.arange(n)/SR
# music: 100bpm, Am F C G pads + soft kick + hat
bpm=100;beat=60/bpm;M=np.zeros(n)
chords=[[220,261.63,329.63],[174.61,220,261.63],[261.63,329.63,392],[196,246.94,293.66]]
bar=beat*4
for k in range(int(total/bar)+1):
    s=int(k*bar*SR);e=min(n,int((k+1)*bar*SR));
    if s>=n:break
    tt=np.arange(e-s)/SR;env=np.minimum(1,tt/.25)*np.minimum(1,(tt[-1]-tt)/.25+.001)
    for f in chords[k%4]:
        M[s:e]+=env*(np.sin(2*np.pi*f*tt)+.4*np.sin(2*np.pi*f*2.003*tt)+.5*np.sin(2*np.pi*f/2*tt))*.12
    for b in range(4):
        bs=s+int(b*beat*SR);L=int(.18*SR)
        if bs+L<n:
            kt=np.arange(L)/SR;M[bs:bs+L]+=np.sin(2*np.pi*(48+70*np.exp(-kt*30))*kt)*np.exp(-kt*22)*.55
        hs=bs+int(beat/2*SR);L2=int(.04*SR)
        if hs+L2<n:
            hn=rng.standard_normal(L2);hn=np.diff(hn,prepend=0);M[hs:hs+L2]+=hn*np.exp(-np.arange(L2)/SR*110)*.07
# sfx: whoosh at scene starts, pop at phrase starts
X=np.zeros(n);t0=0
for i,sc in enumerate(T):
    if i>0:
        L=int(.45*SR);s=int((t0-.25)*SR);w=rng.standard_normal(L);w=np.convolve(w,np.ones(40)/40,'same');wt=np.arange(L)/L
        X[s:s+L]+=w*np.sin(np.pi*wt)**2*1.6
    for p in sc['pt'][1:]:
        L=int(.09*SR);s=int((t0+p)*SR);pt=np.arange(L)/SR
        if s+L<n: X[s:s+L]+=np.sin(2*np.pi*(620+900*pt/.09)*pt)*np.exp(-pt*45)*.35
    t0+=sc['dur']
mix=V*.9+M*.16+X*.14
mix[-int(.6*SR):]*=np.linspace(1,0,int(.6*SR))
mix=mix/np.abs(mix).max()*.95
w=wave.open('audio.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((mix*32767).astype(np.int16).tobytes());w.close()
print('total',round(total,2),'missing',missing)
