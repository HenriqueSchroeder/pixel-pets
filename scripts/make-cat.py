"""Draws the default cat and writes pets/cat.json.

    python3 scripts/make-cat.py

pets/cat.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. Each frame is a base sprite with a few pixels painted
over it (eyes, mouth, effects), so a pose is a short list of (row, column, letter).
"""

import json
from pathlib import Path
MAIN = ['.o........o.','obo......obo','obboooooobbo','obbbbbbbbbbo','obbbbbbbbbbo','obbbbbbbbbbo','obpbbbbbbpbo','obbbbbbbbbbo','obbbbbbbbbbo','.obbbbbbbbo.','..oooooooo..','..o......o..']
MINI = ['.o....o.','oboooobo','obbbbbbo','obebbebo','obbbbbbo','obbbbbbo','.obbbbo.','.o....o.']
OPEN=[(4,3,'e'),(5,3,'e'),(4,8,'e'),(5,8,'e')]
SHUT=[(5,3,'o'),(5,4,'o'),(5,7,'o'),(5,8,'o')]
DOWN=[(5,3,'e'),(5,8,'e')]
SMILE=[(4,3,'o'),(5,2,'o'),(5,4,'o'),(4,8,'o'),(5,7,'o'),(5,9,'o')]
MOUTH=[(7,5,'o'),(7,6,'o')]
OMOUTH=[(7,5,'o'),(7,6,'o'),(8,5,'o'),(8,6,'o')]
GRIN=[(7,4,'o'),(8,5,'o'),(8,6,'o'),(7,7,'o')]
FROWN=[(8,4,'o'),(7,5,'o'),(7,6,'o'),(8,7,'o')]
look=lambda s:[(r,c+s,l) for r,c,l in OPEN]
scan=lambda s:[(5,3+s,'e'),(5,8+s,'e')]
hop=lambda c:[(11,c,'.'),(10,c,'o')]
w=lambda *ps:[(r,c,'w') for r,c in ps]
t=lambda r,c:[(r,c,'t')]
# heavy lids: a drooping line over half an eye
HALF=[(4,2,'o'),(4,3,'o'),(5,3,'e'),(4,8,'o'),(4,9,'o'),(5,8,'e')]
# brows pulled in over the inner corners of the eyes
BROW=[(3,4,'o'),(3,7,'o')]
FLAT=[(8,4,'o'),(8,5,'o'),(8,6,'o'),(8,7,'o')]
WAVY=[(8,4,'o'),(7,5,'o'),(8,6,'o'),(7,7,'o')]

asleep=SHUT+MOUTH
L,Rr=look(-1)+MOUTH,look(1)+MOUTH
F={
 # 4 fps: a frame repeated is a pose held for another quarter second
 'sleeping':[asleep]*4+[asleep+w((1,5))]*2+[asleep+w((0,6))]*2,
 'deepSleep':[asleep,asleep+w((1,4)),asleep+w((1,4)),asleep+w((1,4),(0,6)),asleep+w((1,4),(0,6)),asleep+w((0,6),(1,8)),asleep+w((0,6),(1,8)),asleep],
 'waking':[OPEN+OMOUTH]*3+[SHUT+OMOUTH],
 'thinking':[L]*4+[Rr]*4,
 'typing':[OPEN+GRIN+hop(2)]*2+[OPEN+GRIN+hop(9)]*2,
 'running':[look(1)+MOUTH+w((11,c)) for c in range(3,9)],
 'writing':[DOWN+GRIN+hop(2)]*2+[DOWN+GRIN+hop(9)]*2,
 'reading':[DOWN+MOUTH],
 'searching':[scan(-1)+MOUTH]*2+[scan(0)+MOUTH]*2+[scan(1)+MOUTH]*2+[scan(0)+MOUTH]*2,
 'compacting':[DOWN+MOUTH+w((0,3),(1,8))]*2+[DOWN+MOUTH+w((1,3),(0,8))]*2,
 'sweating':[OPEN+FROWN+t(r,10) for r in (3,3,4,4,5,5)],
 'happy':[SMILE+GRIN]*2+[SMILE+GRIN+hop(2)+hop(9)]*2,
 # a long job done: hopping on both feet in falling confetti
 'celebrating':[SMILE+GRIN+hop(2)+hop(9)+[(0,3,'p'),(1,6,'t'),(0,8,'w')], SMILE+GRIN+[(1,4,'w'),(0,6,'p'),(1,8,'t')]]*4,
 # sitting around, awake
 'idle':[OPEN+MOUTH],
 # drawn facing right; the core mirrors it to walk left
 'walking':[look(1)+MOUTH+hop(2), look(1)+MOUTH+hop(9)],
 # eyes on the agents beside it (drawn on its right), a glance back now and then
 'supervising':[Rr]*6+[OPEN+MOUTH]*2,
 # eyes on the prompt below
 'watching':[DOWN+MOUTH]*6+[[(5,4,'e'),(5,9,'e')]+MOUTH]*2,
 'sad':[OPEN+FROWN+t(r,3) for r in (6,6,7,7,8,8)],
 # at night: heavy lids, slow blinks
 'sleepy':[HALF+MOUTH]*5+[SHUT+MOUTH]*3,
 # hours into the work: heavy lids, a long yawn
 'tired':[HALF+FLAT]*4+[HALF+OMOUTH]*2+[SHUT+OMOUTH]*2,
 # glancing about, mouth wobbling, a drop of sweat now and then
 'worried':[look(-1)+WAVY]*3+[OPEN+WAVY]+[look(1)+WAVY+t(3,10)]*3+[OPEN+WAVY],
 # brows down, mouth flat, a puff of steam rising
 'grumpy':[OPEN+BROW+FLAT]*4+[OPEN+BROW+FLAT+w((1,5))]*2+[OPEN+BROW+FLAT+w((0,6))]*2,
 # eyes shut in a smile, grinning, a sparkle on its head
 'proud':[SMILE+GRIN]*4+[SMILE+GRIN+w((1,6))]*2+[SMILE+GRIN+w((0,6))]*2,
}
UP=[(4,3,'e'),(4,8,'e')]
SIDEMOUTH=[(7,6,'o'),(7,7,'o')]
ear_flick=lambda: [(0,1,'.'),(0,0,'o')]
V={
 'thinking':[[UP+SIDEMOUTH]*8],
 'reading':[[scan(-1)+MOUTH]*3+[scan(0)+MOUTH]*3+[scan(1)+MOUTH]*2],
}
T={
 '*>sleeping':[OPEN+MOUTH, OPEN+OMOUTH, DOWN+OMOUTH, SHUT+OMOUTH, SHUT+MOUTH],
 'happy>sleeping':[SMILE+GRIN, SMILE+MOUTH, OPEN+MOUTH, DOWN+OMOUTH, SHUT+OMOUTH, SHUT+MOUTH],
 'sleeping>*':[SHUT+MOUTH, DOWN+MOUTH, OPEN+OMOUTH, OPEN+OMOUTH, OPEN+MOUTH],
 'deepSleep>*':[SHUT+MOUTH, DOWN+MOUTH, OPEN+OMOUTH, OPEN+OMOUTH, OPEN+MOUTH],
 'deepSleep>waking':[OPEN+OMOUTH],
 'sleeping>deepSleep':[asleep],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping']=T['happy>sleeping']
MOUTH_FACES=['idle','thinking','supervising','running','searching','reading','compacting','watching']
A={
 'blink':{'frames':[SHUT+MOUTH],'moods':MOUTH_FACES,'every':[2,6]},
 'blinkTwice':{'frames':[SHUT+MOUTH,OPEN+MOUTH,SHUT+MOUTH],'moods':MOUTH_FACES,'every':[9,20]},
 'blinkGrin':{'frames':[SHUT+GRIN],'moods':['typing','writing'],'every':[2,6]},
 'blinkFrown':{'frames':[SHUT+FROWN],'moods':['sweating'],'every':[2,5]},
 'earTwitch':{'frames':[OPEN+MOUTH+ear_flick(),OPEN+MOUTH,OPEN+MOUTH+ear_flick()],'moods':['idle','thinking','reading','supervising'],'every':[6,15]},
 'lookAround':{'frames':[look(-1)+MOUTH]*3+[look(1)+MOUTH]*3,'moods':['idle','compacting'],'every':[8,18]},
 'dreamTwitch':{'frames':[asleep+ear_flick(),asleep,asleep+ear_flick()],'moods':['sleeping','deepSleep'],'every':[8,25]},
 'groom':{'frames':[SHUT+[(7,5,'o'),(7,6,'o'),(8,5,'p')]]*2+[SHUT+MOUTH]+[SHUT+[(7,5,'o'),(7,6,'o'),(8,5,'p')]]*2,'moods':['idle'],'every':[12,30]},
 'idleYawn':{'frames':[OPEN+OMOUTH,SHUT+OMOUTH,SHUT+OMOUTH,OPEN+MOUTH],'moods':['idle'],'every':[20,45]},
 'sleepyYawn':{'frames':[HALF+OMOUTH,SHUT+OMOUTH,SHUT+OMOUTH,HALF+MOUTH],'moods':['sleepy'],'every':[15,35]},
 'nod':{'frames':[SHUT+MOUTH]*3+[HALF+MOUTH],'moods':['sleepy','tired'],'every':[8,20]},
 'blinkWorried':{'frames':[SHUT+WAVY],'moods':['worried'],'every':[2,5]},
 'blinkGrumpy':{'frames':[SHUT+BROW+FLAT],'moods':['grumpy'],'every':[3,7]},
 'yawn':{'frames':[SHUT+OMOUTH]*3,'moods':['sleeping'],'every':[15,40]},
}
MINI_HAPPY=[(3,2,'o'),(3,5,'o'),(5,3,'o'),(5,4,'o')]
MINI_SAD=[(5,3,'o'),(5,4,'o')]
MINI_STEP=[(7,1,'.'),(6,1,'o')], [(7,6,'.'),(6,6,'o')]
def paint(base,px):
  g=[list(r) for r in base]
  for r,c,l in px:
    if 0<=c<len(g[r]): g[r][c]=l
  return [''.join(r) for r in g]
pack={
 '$schema':'https://raw.githubusercontent.com/HenriqueSchroeder/pixel-pets/main/schema/pet.schema.json',
 'name':'cat','author':'Henrique Schroeder','description':'An orange cat, the default pet.',
 'palette':{'o':'#2b1d14','b':'#f0a35e','e':'#1a1a1a','p':'#f27c8f','w':'#ffffff','t':'#5ab4ff'},
 'fps':4,
 'main':{
   'moods':{m:[paint(MAIN,f) for f in fr] for m,fr in F.items()},
   'variants':{m:[[paint(MAIN,f) for f in loop] for loop in loops] for m,loops in V.items()},
   'transitions':{k:[paint(MAIN,f) for f in fr] for k,fr in T.items()},
   'actions':{k:{'frames':[paint(MAIN,f) for f in a['frames']],'moods':a['moods'],'every':a['every']} for k,a in A.items()},
 },
 'mini':{'tint':'b','moods':{
   'working':[paint(MINI,MINI_STEP[0])]*2+[paint(MINI,MINI_STEP[1])]*2,
   'happy':[paint(MINI,MINI_HAPPY)]*2+[paint(MINI,MINI_HAPPY+MINI_STEP[0]+MINI_STEP[1])]*2,
   'sad':[paint(MINI,MINI_SAD+t(4,2))]*2+[paint(MINI,MINI_SAD+t(5,2))]*2,
 }},
 'speech':{
   'en':{'longThink':['mrrp… hmm','hmm… *tail flick*'],'manyReads':['so many files… mrow!'],'manyAgents':['a whole litter of agents!'],'lateNight':["*yawn* it's late…"]},
   'pt-BR':{'longThink':['mrrp… hmm','hmm… *mexe o rabo*'],'manyReads':['quanto arquivo… miau!'],'manyAgents':['uma ninhada de agents!'],'lateNight':['*boceja* já tá tarde…']},
 },
}
for m,fr in pack['main']['moods'].items(): assert len(fr)<=8,(m,len(fr))
out = Path(__file__).resolve().parent.parent / 'pets' / 'cat.json'
out.write_text(json.dumps(pack, indent=2) + '\n')
print(f'{out}: written')
