/* Numeric monitoring data only; no invented history or model-stream speed. */
(function(root){
 const ns='http://www.w3.org/2000/svg',colours={mint:'#8ee0c2',blue:'#7dafec',purple:'#b6a1ef'};
 function node(tag,attrs={},text){const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=String(text);return n;}
 const compact=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+'k':Number(n.toFixed(1)).toString();
 const clock=at=>new Date(at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
 function cumulative(buckets,key){let sum=0;return buckets.map(b=>({at:Date.parse(b.at),value:sum+=key==='total'?b.input_tokens+b.output_tokens:b[key],detail:b.requests+' 次请求 · '+b.unknown+' 次用量未知'}));}
 function observe(samples,s){
  const at=Date.parse(s.observed_at),fresh=Number.isFinite(at)&&!s.cloud?.stale&&Math.abs(Date.now()-at)<30000;
  if(!fresh||samples.at(-1)?.at>=at)return samples;
  const version=s.progress?.version||s.draft?.version||'',progress=typeof s.progress?.percent==='number'?s.progress.percent:null;
  return [...samples.filter(p=>p.at>at-86400000),{at,version,progress,input:s.telemetry?.input_tokens_per_second??null,output:s.telemetry?.output_tokens_per_second??null,input_tokens:s.telemetry?.input_tokens??null,output_tokens:s.telemetry?.output_tokens??null,requests:s.ledger?.requests??null}].slice(-720);
 }
 function stepPath(points,x,y){let d='',previous=null;for(const p of points){if(!Number.isFinite(p.value)){previous=null;continue;}d+=(previous?'H'+x(p.at)+'V'+y(p.value):'M'+x(p.at)+' '+y(p.value));previous=p;}return d;}
 function observedPoints(samples,value){const out=[];let previous;for(const p of samples){if(previous&&p.at-previous.at>20000)out.push({at:p.at-1,value:null});out.push({at:p.at,value:value(p)});previous=p;}return out;}
 function plot(svg,points,{unit='',colour=colours.mint,bars=false,fixedMax=0,through=null,empty='暂无历史数据',readout=null}={}){
  svg.replaceChildren();svg.onpointermove=null;svg.onkeydown=null;svg.setAttribute('viewBox','0 0 640 228');svg.setAttribute('tabindex','0');
  const valid=points.filter(p=>Number.isFinite(p.at)&&Number.isFinite(p.value));
  if(!valid.length){svg.append(node('text',{x:320,y:106,'text-anchor':'middle',class:'chart-empty'},empty));if(readout)readout.textContent='等待真实数据';return;}
  const last=through||valid.at(-1).at,first=valid.length===1?last-60000:valid[0].at,peak=Math.max(1,...valid.map(p=>p.value))*1.08,max=fixedMax||((bars||unit.includes('请求'))?Math.ceil(peak/4)*4:peak);
  const x=n=>58+(n-first)/(last-first)*566,y=n=>188-n/max*160;
  for(let i=0;i<=4;i++){const v=max*i/4,yy=y(v);svg.append(node('line',{x1:58,y1:yy,x2:624,y2:yy,class:'chart-grid'}),node('text',{x:48,y:yy+4,'text-anchor':'end',class:'chart-tick'},compact(v)));}
  for(let i=0;i<=4;i++){const at=first+(last-first)*i/4,label=last-first<600000?new Date(at).toLocaleTimeString('zh-CN',{hour12:false}):clock(at);svg.append(node('text',{x:x(at),y:210,'text-anchor':i===0?'start':i===4?'end':'middle',class:'chart-tick'},label));}
  svg.append(node('text',{x:58,y:14,class:'chart-unit'},unit));
  if(bars){const width=Math.min(24,566/Math.max(1,points.length)*.7);for(const p of valid){const r=node('rect',{x:x(p.at)-width/2,y:y(p.value),width,height:Math.max(p.value?2:0,188-y(p.value)),rx:2,fill:colour,opacity:.8});r.append(node('title',{},clock(p.at)+' · '+p.value+' '+unit+' · '+(p.detail||'')));svg.append(r);}}
  else{const d=stepPath(points,x,y);svg.append(node('path',{d,fill:'none',stroke:colour,'stroke-width':2.4,'stroke-linejoin':'round'}));for(const p of valid){const c=node('circle',{cx:x(p.at),cy:y(p.value),r:valid.length===1?4:2,fill:colour});c.append(node('title',{},clock(p.at)+' · '+p.value.toLocaleString()+' '+unit+' · '+(p.detail||'')));svg.append(c);}}
  const guide=node('line',{x1:0,y1:28,x2:0,y2:188,class:'chart-guide',visibility:'hidden'}),dot=node('circle',{r:4,fill:colour,visibility:'hidden'});svg.append(guide,dot);let index=valid.length-1;
  const show=i=>{index=Math.max(0,Math.min(valid.length-1,i));const p=valid[index];guide.setAttribute('x1',x(p.at));guide.setAttribute('x2',x(p.at));guide.setAttribute('visibility','visible');dot.setAttribute('cx',x(p.at));dot.setAttribute('cy',y(p.value));dot.setAttribute('visibility','visible');if(readout)readout.textContent=clock(p.at)+' · '+p.value.toLocaleString()+' '+unit+(p.detail?' · '+p.detail:'');};
  svg.onpointermove=e=>{const box=svg.getBoundingClientRect(),xx=(e.clientX-box.left)*640/box.width;show(valid.reduce((best,p,i)=>Math.abs(x(p.at)-xx)<Math.abs(x(valid[best].at)-xx)?i:best,0));};
  svg.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?valid.length-1:index+(e.key==='ArrowLeft'?-1:1));}};show(index);
 }
 const sessions=new Map();let rangeHours=6;
 function render(s,project){
  const panel=document.getElementById('view-trends');if(!panel)return;
  const key=project+'|'+(s.progress?.version||s.draft?.version||''),samples=observe(sessions.get(key)||[],s);sessions.set(key,samples);if(sessions.size>12)sessions.delete(sessions.keys().next().value);
  const end=Date.parse(s.history?.through||s.observed_at),cutoff=end-rangeHours*3600000,buckets=(s.history?.buckets||[]).filter(b=>Date.parse(b.at)>=cutoff),mode=document.getElementById('usage-mode').value;
  document.querySelectorAll('[data-trend-hours]').forEach(b=>{const selected=Number(b.dataset.trendHours)===rangeHours;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));b.onclick=()=>{rangeHours=Number(b.dataset.trendHours);render(s,project);};});
  document.getElementById('usage-mode').onchange=()=>render(s,project);
  const draw=(id,points,options)=>plot(document.getElementById(id),points,{...options,readout:document.getElementById(id+'-value')});
  const observed=samples.filter(p=>p.at>=cutoff),progress=[];let previous;
  const historical=s.history?.kind==='request_start_buckets';
  draw('usage-trend',historical?cumulative(buckets,mode):observedPoints(observed,p=>mode==='total'&&p.input_tokens!==null&&p.output_tokens!==null?p.input_tokens+p.output_tokens:p[mode]??null),{unit:'tokens',through:historical?end:null,empty:'等待实际用量回报'});
  draw('requests-trend',historical?buckets.map(b=>({at:Date.parse(b.at),value:b.requests,detail:b.measured+' 次已回报 · '+b.unknown+' 次用量未知'})):observedPoints(observed,p=>p.requests),{unit:historical?'请求 / 15 分钟':'累计请求',colour:colours.blue,bars:historical,through:historical?end:null,empty:'等待实际请求观察'});
  document.getElementById('usage-trend').setAttribute('aria-label',historical?'所选时段累计已回报用量，横轴请求启动时段，纵轴 tokens':'页面实际观察的项目累计用量，横轴观察时间，纵轴 tokens');
  document.getElementById('requests-trend').setAttribute('aria-label',historical?'每十五分钟实际启动的请求次数柱状图':'页面实际观察的项目累计请求次数曲线');
  document.getElementById('trend-data-note').textContent=historical?'请求台账提供历史用量；进度和速率从打开页面后的真实观察开始记录。':'当前连接提供累计状态；折线从打开页面后的真实观察开始记录，不回填此前历史。';
  document.getElementById('usage-trend-heading').textContent=historical?'时段累计用量':'已回报累计用量（页面观察）';
  document.getElementById('requests-trend-heading').textContent=historical?'请求次数':'累计请求（页面观察）';
  document.getElementById('requests-trend-key').textContent=historical?'每 15 分钟':'真实观察点';
  document.getElementById('usage-trend-note').textContent=historical?'按请求启动时间归入 15 分钟时段，累计所选窗口内已回报用量。未回报用量不补为零；曲线会随回报更新。':'当前连接提供累计计数，曲线从打开页面后的观察开始；不回填此前历史，未知用量不计入。';
  document.getElementById('requests-trend-note').textContent=historical?'包含已完成、失败和在途的台账请求。柱高表示启动次数，不代表科研成果数量。':'当前连接未提供分时请求台账；显示实际观察到的累计请求数，不推测请求发生时间。';
  for(const p of observed){if(previous&&p.at-previous.at>20000)progress.push({at:p.at-1,value:null});progress.push({at:p.at,value:p.progress});previous=p;}
  draw('progress-trend',progress,{unit:'%',fixedMax:100,empty:'尚未观察到当前版本的进度'});
  document.getElementById('progress-trend-note').textContent='当前版本 '+(s.progress?.version||'待定')+' · '+observed.length+' 次实际观察；间隔超过 20 秒断线显示。切换版本后重新记录。';
  const roleHost=document.getElementById('role-usage');roleHost.replaceChildren();const rows=Object.entries(s.telemetry?.by_role||{}).filter(([r])=>['evidence','author','reviewer','editor','red_team','citation_verifier','prose_adjudicator','translator'].includes(r)),maximum=Math.max(1,...rows.map(([,v])=>v.input_tokens+v.output_tokens));
  for(const[r,v]of rows){const row=document.createElement('div');row.className='role-bar-row';const label=document.createElement('span');label.textContent=({evidence:'文献证据',author:'作者',reviewer:'审稿',editor:'编辑',red_team:'红队',citation_verifier:'引文核验',prose_adjudicator:'语言裁决',translator:'翻译'})[r];const track=document.createElement('div');track.className='role-bar-track';for(const[k,c]of [['input_tokens','blue'],['output_tokens','mint']]){const bar=document.createElement('i');bar.className=c;bar.style.width=(v[k]/maximum*100)+'%';track.append(bar);}const value=document.createElement('b');value.textContent=compact(v.input_tokens+v.output_tokens);row.title=label.textContent+'：输入 '+v.input_tokens.toLocaleString()+' / 输出 '+v.output_tokens.toLocaleString()+' tokens';row.append(label,track,value);roleHost.append(row);}
  if(!rows.length){const p=document.createElement('p');p.textContent='暂无已回报用量';roleHost.append(p);}
  document.getElementById('trend-window').textContent='最近 '+rangeHours+' 小时 · '+(s.cloud?.stale?'同步已过期':clock(s.observed_at)+' 更新');
  document.getElementById('trend-status').textContent='已记录 '+(s.ledger?.requests||0)+' 次请求 · '+(s.progress?.percent??'—')+'% 流程任务';
  const ratePoints=[];previous=null;for(const p of samples){if(previous&&p.at-previous.at>20000)ratePoints.push({at:p.at-1,value:null});ratePoints.push({at:p.at,value:p.output});previous=p;}
  plot(document.getElementById('rate-chart'),ratePoints,{unit:'输出 tokens / 秒',empty:'等待实际观察',readout:document.getElementById('rate-chart-value')});
 }
 root.ReviewForgeCharts={render,observe,cumulative,stepPath,observedPoints};
})(globalThis);
