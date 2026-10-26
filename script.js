const SLEEP=["Menos de 5 horas","5 a menos de 6 horas","6 a menos de 7 horas","7 a 8 horas","Mais de 8 horas"];
const CONC=["Nunca","Raramente","Às vezes","Frequentemente","Sempre"];
const SERIES=["1º ano","2º ano","3º ano","Outro / Prefiro não informar"];
const CCOL=["#BFDBFE","#93C5FD","#5EEAD4","#FBBF24","#F97316"];
const SMALL=5,GOAL=20;
let rows=[],imported=null,stats=null,F={s:"",sl:"",c:""};
const $=id=>document.getElementById(id);
const norm=s=>String(s==null?"":s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const pct=(a,b)=>b?Math.round(a/b*100):0;
// undefined = inválido/vazio; null = prefere não informar
function pSleep(v){const n=norm(v);if(!n)return;if(n.startsWith("prefiro"))return null;
 if(/^menos de 5/.test(n))return 0;if(/^5 a/.test(n))return 1;if(/^6 a/.test(n))return 2;if(/^7 a/.test(n))return 3;if(/^mais de 8/.test(n))return 4}
function pConc(v){const n=norm(v);if(!n)return;if(n.startsWith("prefiro"))return null;
 return {"nunca":0,"raramente":1,"as vezes":2,"frequentemente":3,"sempre":4}[n]}
function pSerie(v){const n=norm(v);if(!n)return;if(/^1/.test(n))return 0;if(/^2/.test(n))return 1;if(/^3/.test(n))return 2;return 3}
function findCol(h,test,not){return h.find(x=>{const n=norm(x);return test(n)&&!(not&&not(n))})}
function mapHeaders(h){return{
 consent:findCol(h,n=>n.includes("concorda")),
 serie:findCol(h,n=>n.includes("serie")),
 sono:findCol(h,n=>n.includes("horas")&&n.includes("dorm")||n.includes("quantas horas")),
 conc:findCol(h,n=>n.includes("concentr"))}}
async function readText(file){const buf=await file.arrayBuffer();let t;
 try{t=new TextDecoder("utf-8",{fatal:true}).decode(buf)}catch(e){t=new TextDecoder("windows-1252").decode(buf)}
 return t.replace(/^\uFEFF/,"")}
function processCsv(text){
 if(typeof Papa==="undefined")throw new Error("Biblioteca de leitura CSV não carregou. Verifique a conexão com a internet e recarregue.");
 if(!text.trim())throw new Error("O arquivo está vazio.");
 const r=Papa.parse(text,{header:true,skipEmptyLines:"greedy"});
 if(!r.meta.fields||!r.data.length)throw new Error("Nenhuma resposta encontrada no arquivo.");
 const m=mapHeaders(r.meta.fields),miss=[];
 if(!m.serie)miss.push("Série");if(!m.sono)miss.push("Horas de sono por noite");if(!m.conc)miss.push("Dificuldade de concentração");
 if(miss.length)throw new Error("Colunas não encontradas: "+miss.join(", ")+". Confira os títulos das perguntas no CSV.");
 const out=[];let bad=0,noConsent=0;
 for(const d of r.data){
  if(m.consent&&norm(d[m.consent]).startsWith("nao")){noConsent++;continue}
  const s=pSerie(d[m.serie]),sl=pSleep(d[m.sono]),c=pConc(d[m.conc]);
  if(s===undefined||sl===undefined||c===undefined){bad++;continue}
  out.push({s,sl,c})}
 if(!out.length)throw new Error("Nenhuma linha válida: todas estavam incompletas ou com respostas fora das categorias esperadas ("+bad+" ignoradas).");
 return{out,stats:{total:r.data.length,ok:out.length,bad,noConsent}}}
function filtered(){return rows.filter(r=>(F.s===""||r.s==F.s)&&(F.sl===""||r.sl==F.sl)&&(F.c===""||r.c==F.c))}
function evalHyp(R){
 const b=R.filter(r=>r.sl!==null&&r.c!==null),sh=b.filter(r=>r.sl<=2),lg=b.filter(r=>r.sl>=3);
 const hi=a=>a.filter(r=>r.c>=3).length;
 const o={n:b.length,ns:sh.length,nl:lg.length,ps:pct(hi(sh),sh.length),pl:pct(hi(lg),lg.length),hs:hi(sh),hl:hi(lg)};
 if(b.length<GOAL){o.v="Resultado inconclusivo";o.why=`Há apenas ${b.length} respostas com sono e concentração informados (mínimo: ${GOAL}).`;return o}
 if(sh.length<SMALL||lg.length<SMALL){o.v="Resultado inconclusivo";o.why=`Um dos grupos tem menos de ${SMALL} respostas (menos de 7 h: ${sh.length}; 7 h ou mais: ${lg.length}).`;return o}
 const d=(o.hs/sh.length-o.hl/lg.length)*100;o.d=Math.round(d);
 if(d>=10){o.v="Evidências compatíveis com a hipótese"}else if(d<=-10){o.v="Evidências que não apoiam a hipótese"}else o.v="Resultado inconclusivo";
 o.why=`Entre quem dorme menos de 7 h, ${o.ps}% (${o.hs} de ${sh.length}) relatam dificuldade frequentemente ou sempre; entre quem dorme 7 h ou mais, ${o.pl}% (${o.hl} de ${lg.length}). Diferença: ${o.d>0?"+":""}${o.d} pontos percentuais.`;return o}
function render(){
 const R=filtered(),has=rows.length>0;
 const active=[];if(F.s!=="")active.push("Série: "+SERIES[F.s]);if(F.sl!=="")active.push("Sono: "+SLEEP[F.sl]);if(F.c!=="")active.push("Concentração: "+CONC[F.c]);
 $("active").textContent="Filtros ativos: "+(active.join(" · ")||"nenhum")+(imported?" · Última importação: "+imported:"");
 // KPIs
 const sI=R.filter(r=>r.sl!==null),cI=R.filter(r=>r.c!==null),bI=R.filter(r=>r.sl!==null&&r.c!==null);
 const k1=R.length,k2=sI.filter(r=>r.sl<=2).length,k3=cI.filter(r=>r.c>=3).length,k4=bI.filter(r=>r.sl<=2&&r.c>=3).length;
 const K=(t,n,d,den)=>`<div class="card kpi"><span>${t}</span><b>${has?n:"—"}</b>${has&&den?`<small>${pct(n,d)}% de ${d} respostas com informação</small>`:""}</div>`;
 $("kpis").innerHTML=has?K("Respostas válidas",k1,0,0)+K("Dormem menos de 7 horas",k2,sI.length,1)+K("Dificuldade frequente ou sempre",k3,cI.length,1)+K("As duas características juntas",k4,bI.length,1)
 :`<div class="card empty" style="grid-column:1/-1">Aguardando dados reais. Importe as respostas do Google Forms para gerar os indicadores.</div>`;
 // meta
 const n=rows.length;$("goalBar").style.width=Math.min(100,n/GOAL*100)+"%";
 $("goalTxt").textContent=!n?"Aguardando respostas.":n<GOAL?`${n} de ${GOAL} respostas válidas. Há dados insuficientes para comparar alguns grupos.`:`Meta de ${GOAL} respostas alcançada (${n}). A meta não garante representatividade estatística; os resultados ainda podem ter limitações.`;
 const none=`<div class="empty">${has?"Nenhuma resposta corresponde aos filtros escolhidos.":"Sem dados. Importe um CSV para visualizar."}</div>`;
 // chart1
 const cs=SLEEP.map((_,i)=>sI.filter(r=>r.sl===i).length),ts=cs.reduce((a,b)=>a+b,0),mx=Math.max(1,...cs);
 $("ch1").innerHTML=ts?`<div class="cols" role="img" aria-label="Distribuição das horas de sono: ${SLEEP.map((l,i)=>l+": "+cs[i]).join("; ")}">${cs.map((c,i)=>`<div class="col" title="${SLEEP[i]}: ${c} (${pct(c,ts)}%)"><div class="v">${c}<br>${pct(c,ts)}%</div><div class="b" style="height:${c/mx*150}px"></div></div>`).join("")}</div><div class="xl">${SLEEP.map(l=>`<span>${l.replace(" horas","")}</span>`).join("")}</div><p style="font-size:12px;color:var(--muted)">Base: ${ts} respostas que informaram o sono.</p>`:none;
 // chart2
 const cc=CONC.map((_,i)=>cI.filter(r=>r.c===i).length),tc=cc.reduce((a,b)=>a+b,0);
 if(tc){let off=25;const seg=cc.map((c,i)=>{const p=c/tc*100,s=`<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${CCOL[i]}" stroke-width="7" stroke-dasharray="${p} ${100-p}" stroke-dashoffset="${off}"><title>${CONC[i]}: ${c} (${pct(c,tc)}%)</title></circle>`;off-=p;return s}).join("");
  $("ch2").innerHTML=`<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center"><svg viewBox="0 0 42 42" width="190" role="img" aria-label="Frequência da dificuldade de concentração: ${CONC.map((l,i)=>l+": "+cc[i]).join("; ")}">${seg}<text x="21" y="22.5" text-anchor="middle" font-size="6" font-weight="700" fill="currentColor">${tc}</text></svg><ul class="leg">${CONC.map((l,i)=>`<li><span class="sw" style="background:${CCOL[i]}"></span>${l}: <b>${cc[i]}</b> (${pct(cc[i],tc)}%)</li>`).join("")}</ul></div><p style="font-size:12px;color:var(--muted)">Base: ${tc} respostas que informaram a concentração.</p>`}else $("ch2").innerHTML=none;
 // chart3
 let h3="";SLEEP.forEach((l,i)=>{const g=bI.filter(r=>r.sl===i),t=g.length,c=CONC.map((_,j)=>g.filter(r=>r.c===j).length);
  h3+=`<div class="srow"><div class="h"><b>${l}</b><span>n = ${t}${t&&t<SMALL?" ⚠ poucas respostas":""}</span></div>${t?`<div class="stack" role="img" aria-label="${l}: ${CONC.map((x,j)=>x+" "+pct(c[j],t)+"%").join(", ")}">${c.map((v,j)=>v?`<div style="width:${v/t*100}%;background:${CCOL[j]}" title="${CONC[j]}: ${v} (${pct(v,t)}%)">${v/t>=.09?pct(v,t)+"%":""}</div>`:"").join("")}</div>`:`<div class="stack" style="opacity:.4"></div><span style="font-size:12px;color:var(--muted)">Sem respostas nesta faixa.</span>`}</div>`});
 $("ch3").innerHTML=bI.length?h3+`<ul class="leg" style="display:flex;gap:14px;flex-wrap:wrap">${CONC.map((l,i)=>`<li><span class="sw" style="background:${CCOL[i]}"></span>${l}</li>`).join("")}</ul>`:none;
 // analysis
 const A=[];
 if(!R.length)A.push(has?"Nenhuma resposta corresponde aos filtros.":"A análise será gerada depois da importação de respostas reais.");
 else{A.push(`Foram consideradas ${R.length} respostas válidas.`);
  if(ts){const i=cs.indexOf(Math.max(...cs));A.push(`Faixa de sono mais frequente: ${SLEEP[i]} (${cs[i]} de ${ts}, ${pct(cs[i],ts)}%).`)}
  if(tc){const i=cc.indexOf(Math.max(...cc));A.push(`Resposta mais frequente sobre concentração: ${CONC[i]} (${cc[i]} de ${tc}, ${pct(cc[i],tc)}%).`);A.push(`${k3} de ${tc} (${pct(k3,tc)}%) relatam dificuldade frequentemente ou sempre.`)}
  const rates=SLEEP.map((l,i)=>{const g=bI.filter(r=>r.sl===i);return{l,t:g.length,p:pct(g.filter(r=>r.c>=3).length,g.length)}}).filter(x=>x.t>=SMALL);
  if(rates.length>=2){const a=[...rates].sort((x,y)=>y.p-x.p);A.push(`Entre faixas com pelo menos ${SMALL} respostas, “frequentemente/sempre” varia de ${a[a.length-1].p}% (${a[a.length-1].l}) a ${a[0].p}% (${a[0].l}).`)}
  else A.push("Há dados insuficientes para comparar as faixas de sono.");
  if(R.length<GOAL)A.push("Cuidado: com poucas respostas, qualquer padrão é pouco confiável.");
  if(bI.length&&SLEEP.some((_,i)=>{const t=bI.filter(r=>r.sl===i).length;return t>0&&t<SMALL}))A.push("Algumas faixas têm menos de 5 respostas e não devem ser tratadas como tendência.")}
 $("analysis").innerHTML=`<ul style="margin:0;padding-left:20px">${A.map(a=>`<li>${a}</li>`).join("")}</ul>`;
 // hipótese
 const H=evalHyp(R),col=H.v.startsWith("Evid")&&H.v.includes("compat")?"var(--teal)":H.v.includes("não apoiam")?"var(--orange)":"var(--muted)";
 $("hyp").innerHTML=`<div class="verdict" style="color:${col}">${H.v}</div><p>${H.why}</p>`;
}
// UI
function opts(el,first,arr){el.innerHTML=`<option value="">${first}</option>`+arr.map((l,i)=>`<option value="${i}">${l}</option>`).join("")}
opts($("fS"),"Todas as séries",SERIES);opts($("fSl"),"Todas as faixas",SLEEP);opts($("fC"),"Todas as respostas",CONC);
[["fS","s"],["fSl","sl"],["fC","c"]].forEach(([id,k])=>$(id).addEventListener("change",e=>{F[k]=e.target.value;render()}));
$("btnClear").onclick=()=>{F={s:"",sl:"",c:""};["fS","fSl","fC"].forEach(i=>$(i).value="");render()};
$("btnImp").onclick=()=>$("file").click();
$("btnPrint").onclick=()=>window.print();
function msg(t,c){$("status").innerHTML=`<div class="msg ${c}">${t}</div>`}
$("file").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;msg("Lendo arquivo…","");
 try{const{out,stats:s}=processCsv(await readText(f));rows=out;stats=s;
  imported=new Date().toLocaleString("pt-BR");
  msg(`Importação concluída: ${s.total} linhas lidas, ${s.ok} aceitas, ${s.bad} ignoradas por estarem incompletas ou fora das categorias${s.noConsent?`, ${s.noConsent} sem consentimento`:""}. Os dados anteriores foram substituídos.`,"ok");
 }catch(err){msg(err.message||"Não foi possível ler o arquivo.","err")}
 e.target.value="";render()});
$("btnExp").onclick=()=>{
 const R=filtered().filter(r=>r.sl!==null&&r.c!==null);
 if(!R.length){msg("Não há dados para exportar com os filtros atuais.","err");return}
 const L=["faixa_de_sono,concentracao,quantidade,percentual_na_faixa"];
 SLEEP.forEach((s,i)=>{const g=R.filter(r=>r.sl===i);CONC.forEach((c,j)=>{const q=g.filter(r=>r.c===j).length;L.push(`"${s}","${c}",${q},${pct(q,g.length)}`)})});
 const b=new Blob(["\uFEFF"+L.join("\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
 a.href=URL.createObjectURL(b);a.download="resumo-agregado-sono.csv";a.click();URL.revokeObjectURL(a.href)};
render();