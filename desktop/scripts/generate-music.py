"""Original PixCut instrumental music. Compositions, synthesis and recordings: CC0.
Rebuild with Python + NumPy, then FFmpeg (all synthesis is local; no samples).
"""
from pathlib import Path
import numpy as np
import wave, subprocess
RATE=22050
ROOT=Path(__file__).resolve().parents[1]/'public'/'music'
TRACKS=[('morning-coffee',92,'keys',0),('golden-reel',110,'pluck',2),('quiet-horizon',78,'pad',-3),('neon-walk',118,'pluck',-2),('little-memories',84,'piano',3),('fresh-start',104,'keys',5)]
for seed,(name,bpm,voice,key) in enumerate(TRACKS):
 rng=np.random.default_rng(907+seed);beat=60/bpm;duration=64*beat;n=int(duration*RATE);mix=np.zeros((n,2))
 def put(signal,at,gain=.1,pan=.5):
  start=int(at*RATE)
  if start<0 or start>=n:return
  signal=signal[:n-start]*gain
  mix[start:start+len(signal),0]+=signal*np.sqrt(1-pan)
  mix[start:start+len(signal),1]+=signal*np.sqrt(pan)
 def note(midi,at,length,gain,kind=voice,pan=.5):
  t=np.arange(int(length*RATE))/RATE;f=440*2**((midi-69)/12)
  if kind=='pad':
   env=(1-np.exp(-t*5))*np.exp(-t/max(.1,length*.65))*np.minimum(1,(length-t)*4)
   signal=(np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*1.003*t)+.12*np.sin(2*np.pi*f*2*t))*env
  elif kind=='bass':signal=np.sin(2*np.pi*f*t)*(1-np.exp(-t*100))*np.exp(-t*3)*np.minimum(1,(length-t)*40)
  else:
   decay={'keys':3,'piano':2.6,'pluck':7}[kind]
   signal=sum(a*np.sin(2*np.pi*f*h*t)*np.exp(-t*decay*(1+h*.12)) for h,a in [(1,1),(2,.32),(3,.13),(4,.06)])
   signal*=np.minimum(1,t*150)*np.minimum(1,(length-t)*35)
  put(signal,at,gain,pan)
  if kind!='bass':put(signal,at+.19,gain*.13,1-pan);put(signal,at+.37,gain*.06,pan)
 chords=[[48,55,60,64],[45,52,57,60],[53,60,65,69],[55,62,67,71]]
 melody=[0,7,12,7,4,9,7,4,2,7,11,7,4,2,0,7]
 for bar in range(16):
  chord=[m+key for m in chords[(bar//2)%4]];at=bar*4*beat;quiet=voice in ['pad','piano'];gain=.055 if quiet else .045
  for m in chord:note(m+12,at,beat*4.5,gain,pan=.3+(m%5)*.1)
  if bar not in [0,15]:
   for step in [0,1.5,2,3.5]:note(chord[0]-12,at+step*beat,beat*.8,.19 if not quiet else .095,'bass')
  if bar>=2 and bar<15:
   for step in ([0,1.5,2.5,3] if voice!='pad' else [0,2.5]):
    m=chord[0]+24+melody[(bar*3+int(step*2)+seed)%16]
    note(m,at+step*beat,beat*(1.6 if quiet else .8),.065 if quiet else .075,'piano' if quiet else voice,pan=.35 if int(step)%2 else .65)
  if not quiet and bar not in [0,15]:
   for step in [0,2,2.75 if seed%2 else 3.5]:
    t=np.arange(int(.24*RATE))/RATE;kick=np.sin(2*np.pi*(45*t+115*(1-np.exp(-t*32))/32))*np.exp(-t*19);put(kick,at+step*beat,.3)
   for step in [1,3]:
    t=np.arange(int(.15*RATE))/RATE;noise=rng.uniform(-1,1,len(t));put((noise*.6+np.sin(2*np.pi*175*t)*.25)*np.exp(-t*28),at+step*beat,.13)
   for step in np.arange(.5,4,.5):
    t=np.arange(int(.045*RATE))/RATE;noise=rng.uniform(-1,1,len(t));noise=np.diff(noise,prepend=0);put(noise*np.exp(-t*90),at+step*beat,.025 if step%1 else .038,pan=.65)
 # A short room and soft mastering keep the instrumental beds behind speech.
 dry=mix.copy()
 for delay,gain in [(.061,.07),(.113,.05),(.237,.03)]:
  d=int(delay*RATE);mix[d:]+=dry[:-d,::-1]*gain
 fade=np.minimum(1,np.arange(n)/(RATE*.5))*np.minimum(1,(n-np.arange(n))/(RATE*1.8));mix*=fade[:,None]
 mix=np.tanh(mix*1.1);peak=np.max(np.abs(mix));mix*=.78/max(peak,.01)
 wav=ROOT/f'{name}.wav'
 with wave.open(str(wav),'wb') as out:out.setnchannels(2);out.setsampwidth(2);out.setframerate(RATE);out.writeframes((mix*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','aac','-b:a','160k','-metadata','artist=PixCut','-metadata','copyright=CC0 1.0 Universal',str(ROOT/f'{name}.m4a')],check=True)
 wav.unlink();print(f'{name}: {duration:.3f}s / {bpm} BPM',flush=True)
