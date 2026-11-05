// Riff invariants. Generates thousands of riffs across scales, keys, boxes,
// feels and levels, prints what it measured, and exits non-zero if any rule a
// riff must never break is broken. Run through scripts/check-riffs.sh.
const r = await import(process.argv[2]); const s = await import(process.argv[3]);
const scales=['minor-pentatonic','major','natural-minor','major-pentatonic','blues','dorian','mixolydian'].map(id=>s.SCALES.find(x=>x.id===id)).filter(Boolean);
const Q=12, pct=(a,b)=>(100*a/Math.max(1,b)).toFixed(0)+'%';
const st={riffs:0,empty:0,startRoot:0,db:0,dbChord:0,finalOff:0,finalShort:0,finalNotRoot:0,trill:0,wrongDir:0,slurRest:0,slurOther:0,chrom:0,chromBad:0,bends:0,bendShort:0,jump16:0,fastHand:0,outsideSimple:0,simpleNotes:0,oneStringRun:0,uniq:[]};
const byFeel={};
for (const scale of scales) for (const k of ['A','E','G','C','F#']) {
  const key=s.SCALE_KEYS.find(x=>x.label===k||x.label==='Gb'&&k==='F#'); if(!key) continue;
  const diag=s.buildScaleDiagram(scale,key);
  for (const box of diag.boxNumbers.slice(0,3)) for (const feel of r.RIFF_FEELS) for (const lvl of [1,2,3,4]) for (const span of [1,2,3]) for (let v=0;v<(span===1?8:3);v++){
    const lv=r.RIFF_COMPLEXITY.find(c=>c.level===lvl);
    // A different seed for every combination, so the sweep really samples
    // the generator instead of replaying the same few random sequences
    const seed=[...`${scale.id}|${k}|${box}|${feel.id}|${lvl}|${span}|${v}`].reduce((h,ch)=>Math.imul(h^ch.charCodeAt(0),16777619)>>>0,2166136261);
    const riff=r.generateRiff(scale,key,box,feel,seed,undefined,lvl,span); st.riffs++;
    const ev=riff.events, snd=ev.map((e,i)=>({...e,i})).filter(e=>!e.rest);
    if(!snd.length){st.empty++;continue;}
    const f=byFeel[feel.id]??={n:0,root:0,rest:0,ticks:0,strings:0,riffs:0}; f.riffs++; f.n+=snd.length; f.root+=snd.filter(e=>e.notes[0].interval==='R').length; f.rest+=ev.filter(e=>e.rest).reduce((a,e)=>a+e.duration,0); f.ticks+=riff.bars*48; f.strings+=new Set(snd.map(e=>e.notes[0].stringIndex)).size;
    if (snd[0].notes[0].interval==='R') st.startRoot++; if (['R','3','b3','5','b5','#5'].includes(snd[0].notes[0].interval)) st.startChord=(st.startChord||0)+1;
    st.uniq.push(new Set(snd.map(e=>e.notes[0].midi)).size);
    let run=1,maxRun=1; for(let i=2;i<snd.length;i++){ const a=snd[i].notes[0].midi,b=snd[i-1].notes[0].midi,c=snd[i-2].notes[0].midi; if(a===c&&a!==b){run++;maxRun=Math.max(maxRun,run)} else run=1;} if(maxRun>=4) st.trill++;
    const bx=diag.boxes.find(b=>b.number===box); const width=Math.max(lv.handSpan-1, bx.end-bx.start);
    let sr=[]; for(let i=0;i<snd.length;i++){ const a=snd[i].notes[0], b=i?snd[i-1].notes[0]:null; if(!b||a.stringIndex!==b.stringIndex) sr=[]; if(a.fret>0&&a.interval!=='ch') sr.push(a.fret); if(sr.length>=4 && Math.max(...sr)-Math.min(...sr)>width){st.oneStringRun++; break;} }
    const box_=diag.boxes.find(b=>b.number===box);
    for (let j=0;j<snd.length;j++){
      const e=snd[j], n=e.notes[0], nx=snd[j+1], ev1=ev[e.i+1];
      if (e.start%24===0){st.db++; if(['R','3','b3','5','b5'].includes(n.interval)) st.dbChord++;}
      if ((e.technique==='hammer'||e.technique==='pull')&&nx){ if((e.technique==='hammer')!==(nx.notes[0].fret>n.fret)) st.wrongDir++; }
      if (['hammer','pull','slide'].includes(e.technique)){ if(!ev1||ev1.rest) st.slurRest++; else if (ev1.notes[0].stringIndex!==n.stringIndex) st.slurOther++; }
      if (n.interval==='ch'){st.chrom++; if(!nx||Math.abs(nx.notes[0].midi-n.midi)!==1) st.chromBad++;}
      if (e.technique==='bend'){st.bends++; if(e.duration<Q/2) st.bendShort++; if(e.bendRelease) st.released=(st.released||0)+1;
        if (ev1 && !ev1.rest && ev1.notes[0].stringIndex===n.stringIndex && !e.bendRelease) st.stuckBend=(st.stuckBend||0)+1; }
      if (nx){ const dt=nx.start-e.start; const df=(n.fret&&nx.notes[0].fret)?Math.abs(nx.notes[0].fret-n.fret):0;
        if (dt<=Q/4 && Math.abs(nx.notes[0].stringIndex-n.stringIndex)>=3){ const ped=(x)=>x.interval==='R'&&x.stringIndex<=1; if(ped(n)||ped(nx.notes[0])) st.jumpPedal=(st.jumpPedal||0)+1; else st.jump16++; }
        if (dt<=Q/2 && df>lv.handSpan) st.fastHand++; }
      if (lvl===1&&span===1){st.simpleNotes++; if(n.fret>0&&(n.fret<box_.start||n.fret>box_.end)) st.outsideSimple++;}
    }
    if (lvl>=3 && feel.stringBias==='low'){ st.hardLowNotes=(st.hardLowNotes||0)+snd.length; st.hardLowE=(st.hardLowE||0)+snd.filter(e=>e.notes[0].stringIndex===0).length; }
    if (span>1 && riff.span>1){ st.travel=(st.travel||0)+1;
      // the boxes it should pass through, in order up the neck
      const boxes=[box_]; while(boxes.length<riff.span){ const l=boxes[boxes.length-1]; const nn=(l.number%diag.boxNumbers.length)+1; const nx=diag.boxes.filter(b=>b.number===nn&&b.start>l.start).sort((a,b)=>a.start-b.start)[0]; if(!nx) break; boxes.push(nx); }
      const visited=boxes.every(b=>snd.some(e=>{const f=e.notes[0].fret; return f>=b.start&&f<=b.end;}));
      if(visited) st.visitAll=(st.visitAll||0)+1;
      const lastF=snd[snd.length-1].notes[0].fret, lb=boxes[boxes.length-1]; if(lastF>=lb.start-1&&lastF<=lb.end+1) st.endsUp=(st.endsUp||0)+1; }
    if (ev.some(e=>e.rest && e.duration>=6 && e.start>0 && e.start < riff.bars*48-24)) st.breathes=(st.breathes||0)+1;
    const last=snd[snd.length-1]; if(last.start%Q!==0) st.finalOff++; if(last.duration<Q) st.finalShort++; if(last.notes[0].interval!=='R') st.finalNotRoot++;
  }
}
const u=st.uniq.sort((a,b)=>a-b);
console.log(`riffs ${st.riffs} (empty ${st.empty})
start on the root ${pct(st.startRoot,st.riffs)}, on a chord tone ${pct(st.startChord,st.riffs)} | beats 1&3 on chord tones ${pct(st.dbChord,st.db)}
final: off the beat ${pct(st.finalOff,st.riffs)}, shorter than a quarter ${pct(st.finalShort,st.riffs)}, not the root ${pct(st.finalNotRoot,st.riffs)}
trills (A-B-A-B-A-B) ${pct(st.trill,st.riffs)} | sliding along one string past the hand's span ${pct(st.oneStringRun,st.riffs)}
slurs wrong direction ${st.wrongDir} | slur/slide into a rest ${st.slurRest} | into another string ${st.slurOther}
chromatic not resolving ${st.chromBad}/${st.chrom} | bends shorter than an eighth ${st.bendShort}/${st.bends} | bends released ${pct(st.released,st.bends)}
16th jumps of 3+ strings: ${st.jump16} (plus ${st.jumpPedal||0} to or from a low root) | hand jumps beyond its span on eighths or faster ${st.fastHand}
Simple: notes outside the box ${st.outsideSimple}/${st.simpleNotes}
Tricky/Brutal low feels: notes on the low E ${pct(st.hardLowE,st.hardLowNotes)}
multi-position riffs: reach every position ${pct(st.visitAll,st.travel)}, finish in the last one ${pct(st.endsUp,st.travel)}
riffs that breathe between phrases ${pct(st.breathes,st.riffs)}
distinct pitches per riff: median ${u[u.length>>1]}, 10th pct ${u[Math.floor(u.length*0.1)]}`);
for (const [id,f] of Object.entries(byFeel)) console.log(`  ${id.padEnd(8)} root share ${pct(f.root,f.n)}  resting ${pct(f.rest,f.ticks)}  strings/riff ${(f.strings/f.riffs).toFixed(1)}`);

const hard = {
  "every riff starts on a chord tone": st.startChord === st.riffs - st.empty,
  "every riff ends on a held root on the beat": st.finalOff + st.finalShort + st.finalNotRoot === 0,
  "hammer-ons go up, pull-offs go down": st.wrongDir === 0,
  "slurs and slides go straight into a note on the same string": st.slurRest + st.slurOther === 0,
  "chromatic notes resolve by a half step": st.chromBad === 0,
  "bends are on notes long enough to reach pitch": st.bendShort === 0,
  "Simple stays inside its box": st.outsideSimple === 0,
  "a bend comes down before the next note on its string": (st.stuckBend||0) === 0,
  "no riff comes out empty": st.empty === 0,
  "every riff has at least three pitches": u[0] >= 3,
  "multi-position riffs reach every position": (st.visitAll||0) >= 0.95 * (st.travel||0),
};
const failed = Object.entries(hard).filter(([, ok]) => !ok);
for (const [rule] of failed) console.log("FAIL: " + rule);
console.log(failed.length === 0 ? "All riff rules hold." : `${failed.length} rule(s) broken.`);
process.exit(failed.length === 0 ? 0 : 1);
