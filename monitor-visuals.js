const svgNode=(tag,attrs={},text='')=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e;};
const agentPalette={evidence:'#70d9c1',author:'#b6a3ef',reviewer:'#79b9ef',editor:'#dfbc7c',red_team:'#db8fa1',citation_verifier:'#85c5ce',prose_adjudicator:'#afa9df',translator:'#96c99d'};
let networkElements=new Map(),networkProject='';
let instruments=[],instrumentScale=10,instrumentProject='';
function renderInstruments(s){
 if(instrumentProject!==s.project.id){instrumentScale=10;instrumentProject=s.project.id;}
 const t=s.telemetry;if(!t)return;instrumentScale=Math.max(instrumentScale,Math.ceil(t.output_tokens_per_second/10)*10);
 const values=[{name:'流程任务完成',value:s.progress?.percent||0,text:s.progress?s.progress.percent+'%':'—',color:'#8ed8be',note:'9 阶段等权 / 已保存任务'},
 {name:'输出用量回报速率',value:100*t.output_tokens_per_second/instrumentScale,text:t.output_tokens_per_second.toFixed(1),color:'#91baf0',note:'t/s · 60秒窗 · 刻度上限 '+instrumentScale},
 {name:'预算占用',value:t.budget_percent||0,text:t.budget_percent===null?'—':t.budget_percent.toFixed(1)+'%',color:t.budget_percent>90?'#e2b47e':'#c0a5ee',note:'实测用量 + 已预留 / 限额'},
 {name:'活动智能体',value:t.active_agents/8*100,text:String(t.active_agents).padStart(2,'0'),color:'#dabd85',note:t.active_requests+' 个请求 / 8 个 Agent'}];
 const host=document.querySelector('#dashboard-instruments');if(!host)return;
 if(!instruments.length){values.forEach((v,index)=>{const card=element('div','','instrument'),svg=svgNode('svg',{viewBox:'0 0 180 130'}),start=135,sweep=270,cx=90,cy=73,r=57;
 const point=a=>[cx+Math.cos(a*Math.PI/180)*r,cy+Math.sin(a*Math.PI/180)*r];const arc=(r)=>{const a=start*Math.PI/180,b=(start+sweep)*Math.PI/180;return `M${cx+Math.cos(a)*r} ${cy+Math.sin(a)*r} A${r} ${r} 0 1 1 ${cx+Math.cos(b)*r} ${cy+Math.sin(b)*r}`;};
 svg.append(svgNode('path',{d:arc(r),fill:'none',stroke:'#2a3b50','stroke-width':5,'stroke-linecap':'round'}));
 for(let i=0;i<=30;i++){const a=(start+i*sweep/30)*Math.PI/180,outer=67,inner=i%5===0?61:64;svg.append(svgNode('line',{x1:cx+Math.cos(a)*inner,y1:cy+Math.sin(a)*inner,x2:cx+Math.cos(a)*outer,y2:cy+Math.sin(a)*outer,stroke:i%5===0?'#6f8fa4':'#354a60','stroke-width':i%5===0?1.3:.7}));}
 const fill=svgNode('path',{d:arc(r),fill:'none',stroke:v.color,'stroke-width':4,'stroke-linecap':'round',pathLength:100,'stroke-dasharray':'0 100',class:'instrument-arc'}),value=svgNode('text',{x:cx,y:80,'text-anchor':'middle',fill:'#deebef','font-family':'Consolas,monospace','font-size':27}),unit=svgNode('text',{x:cx,y:101,'text-anchor':'middle',fill:'#7894aa','font-size':8,'letter-spacing':1.6},index===1?'TOKENS / SEC':index===3?'ACTIVE / 08':'PERCENT');svg.append(fill,value,unit);const label=element('h3',v.name),note=element('small',v.note);card.append(svg,label,note);host.append(card);instruments.push({fill,value,note});});}
 values.forEach((v,i)=>{instruments[i].fill.setAttribute('stroke-dasharray',Math.min(100,v.value)+' 100');instruments[i].fill.setAttribute('stroke',v.color);instruments[i].value.textContent=v.text;instruments[i].note.textContent=v.note;});
}
function renderNetwork(agents,s){
 const host=document.querySelector('#network-map');if(!host)return;
 if(networkProject!==s.project.id){host.replaceChildren();networkElements.clear();networkProject=s.project.id;}
 if(!networkElements.size){
  const svg=svgNode('svg',{viewBox:'0 0 960 430',role:'img','aria-label':'八个 Agent 的真实活动、任务进度与宿主工具交互图'});
  const defs=svgNode('defs');const gradient=svgNode('radialGradient',{id:'core-gradient'});gradient.append(svgNode('stop',{offset:'0%','stop-color':'#244851','stop-opacity':'.8'}),svgNode('stop',{offset:'100%','stop-color':'#10232c','stop-opacity':'.2'}));defs.append(gradient);svg.append(defs);
  for(const r of [96,135,180])svg.append(svgNode('ellipse',{cx:480,cy:208,rx:r*1.85,ry:r,fill:'none',stroke:'#779cad','stroke-opacity':r===180?'.11':'.06','stroke-dasharray':r===135?'3 7':'none'}));
  for(let i=0;i<16;i++){const a=i*Math.PI/8;svg.append(svgNode('line',{x1:480+Math.cos(a)*332,y1:208+Math.sin(a)*180,x2:480+Math.cos(a)*342,y2:208+Math.sin(a)*185,stroke:'#415e6e','stroke-width':'1'}));}
  const positions=[[240,77],[480,44],[720,77],[821,208],[720,338],[480,371],[240,338],[139,208]];
  agents.forEach((a,i)=>{const [x,y]=positions[i],color=agentPalette[a.role];
   const line=svgNode('path',{d:`M480 208 Q${(480+x)/2} ${y} ${x} ${y}`,fill:'none',stroke:color,'stroke-opacity':'.14','stroke-width':'1',class:'network-link'});svg.append(line);
   const group=svgNode('g',{class:'network-agent',tabindex:'0',role:'button','aria-label':a.name+'，点击查看运行详情'});
   const halo=svgNode('circle',{cx:x,cy:y,r:37,fill:color,'fill-opacity':'.025',stroke:color,'stroke-opacity':'.08',class:'network-halo'});
   const track=svgNode('circle',{cx:x,cy:y,r:28,fill:'#0e1a26',stroke:'#344250','stroke-width':'2'});
   const ring=svgNode('circle',{cx:x,cy:y,r:28,fill:'none',stroke:color,'stroke-width':'2','stroke-dasharray':'0 176',transform:`rotate(-90 ${x} ${y})`,class:'network-ring'});
   const initials=svgNode('text',{x,y:y+4,'text-anchor':'middle',fill:color,'font-size':'13','font-family':'Consolas,monospace'},roleInitials[a.role]);
   const anchor=x<240?'start':x>720?'end':'middle',lx=x<240?x-48:x>720?x+48:x;
   const name=svgNode('text',{x:lx,y:y+49,'text-anchor':anchor,fill:'#a0b6c5','font-size':'10'},a.name);
   const pct=svgNode('text',{x:lx,y:y+65,'text-anchor':anchor,fill:color,'font-family':'Consolas,monospace','font-size':'10'});
   group.append(halo,track,ring,initials,name,pct);svg.append(group);
   const inspect=()=>{const current=snapshot.agents.find(v=>v.role===a.role);showAgentDetail(current);};group.onclick=inspect;group.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')inspect();};networkElements.set(a.role,{group,line,ring,pct});
  });
  svg.append(svgNode('circle',{cx:480,cy:208,r:83,fill:'url(#core-gradient)',stroke:'#3a5965','stroke-opacity':'.5'}),svgNode('circle',{cx:480,cy:208,r:65,fill:'#0f202b',stroke:'#253e4b','stroke-width':'5'}));
  const coreRing=svgNode('circle',{cx:480,cy:208,r:65,fill:'none',stroke:'#7bdbbf','stroke-width':'3','stroke-dasharray':'0 409',transform:'rotate(-90 480 208)'}),coreText=svgNode('text',{x:480,y:208,'text-anchor':'middle',fill:'#e4f0ed','font-family':'Consolas,monospace','font-size':'35'}),subtitle=svgNode('text',{x:480,y:231,'text-anchor':'middle',fill:'#779ca9','font-size':'9','letter-spacing':'2'},'CHECKPOINT PROGRESS');
  svg.append(coreRing,coreText,subtitle,svgNode('text',{x:480,y:178,'text-anchor':'middle',fill:'#8bb2b3','font-size':'8','letter-spacing':'3'},'PI / ORCHESTRATION'));
  networkElements.set('core',{ring:coreRing,text:coreText});host.append(svg);
 }
 for(const a of agents){const node=networkElements.get(a.role),p=s.progress?.agents?.[a.role]?.percent;
  node.group.classList.toggle('active',a.status==='running');node.group.classList.toggle('interrupted',a.status==='interrupted');node.line.classList.toggle('active',a.status==='running');node.ring.setAttribute('stroke-dasharray',`${(p||0)*1.7593} 176`);node.pct.textContent=(p===undefined?'—':p+'%')+' / '+(labels[a.status]||a.status);
 }
 const core=networkElements.get('core');core.ring.setAttribute('stroke-dasharray',`${(s.progress?.percent||0)*4.084} 409`);core.text.textContent=s.progress?s.progress.percent+'%':'—';
 document.querySelector('#network-active').textContent=s.telemetry?.active_agents||0;document.querySelector('#network-requests').textContent=s.telemetry?.active_requests||0;document.querySelector('#network-pid').textContent=s.runtime.pid||'—';document.querySelector('#network-status').textContent=labels[s.runtime.state]||s.runtime.state;
 document.querySelector('#network-task').textContent=s.agents.filter(a=>a.status==='running').map(a=>a.name+' / '+a.active_requests.at(-1)?.stage).join('\n')||'等待下一项已授权任务';
}

function showAgentDetail(a){const body=element('div','','agent-detail'),p=snapshot.progress?.agents?.[a.role],u=snapshot.telemetry?.by_role?.[a.role];body.append(badge(labels[a.status]||a.status,a.status));const summary=element('div','','detail-metrics');for(const [label,value] of [['任务进度',p?p.percent+'%':'—'],['模型请求',a.requests+' 次'],['输出用量',number(u?.output_tokens)+' tokens'],['工具调用 / 60秒',(u?.tools_60s||0)+' 次']]){const item=element('div');item.append(element('small',label),element('b',value));summary.append(item);}body.append(summary,element('h3','当前任务'),element('p',a.active_requests.length?a.active_requests.map(r=>r.stage).join('\n'):a.last_request?.stage||'等待调度'));if(p)body.append(element('h3',p.label),element('p',p.basis),element('p',p.completed+'/'+(p.total||'待定')+' 项已保存'));if(p?.additional)for(const phase of p.additional)body.append(element('p',phase.label+'：'+phase.percent+'% · '+phase.completed+'/'+(phase.total||'待定')));body.append(element('h3','最近真实交互'));const tools=snapshot.telemetry?.latest_tools?.filter(t=>t.role===a.role)||[];for(const t of tools)body.append(element('p',time(t.at)+' · '+t.tool+(t.source_id?' · '+t.source_id:'')));if(!tools.length)body.append(element('p','观察窗口内暂无该 Agent 的工具记录'));const raw=element('details');raw.append(element('summary','查看详细运行记录'),jsonView({current_requests:a.active_requests,last_request:a.last_request,progress:p,usage:u}));body.append(raw);detail(a.name,body);}
