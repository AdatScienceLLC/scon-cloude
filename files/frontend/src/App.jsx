import { useState, useCallback, useRef, useEffect } from "react";

const BASE = import.meta.env.PROD ? "/piers" : "";
const API_URL = `${BASE}/api/upload/`;
const P = "#274365";
const C = { a:P, bg:"#f0f4f8", card:"#ffffff", b:"#dde3ea", t:"#222831", m:"#6b7280", d:"#dc2626" };
const SHAPES = [
  { key:"C", label:"C",   piers:3 },
  { key:"L", label:"L/T", piers:2 },
  { key:"I", label:"I",   piers:1 },
];

function ct(cell) {
  if (cell == null) return "--";
  if (typeof cell === "object") return JSON.stringify(cell);
  if (typeof cell === "number") return Math.round(cell);
  return String(cell);
}

function getOrientedTableData(data, isFlipped) {
  if (!data || !data.columns || !isFlipped) return data;
  const cols = [...data.columns];
  [cols[2], cols[5]] = [cols[5], cols[2]];
  [cols[3], cols[6]] = [cols[6], cols[3]];
  const rows = data.data.map(row => {
    const r = [...row];
    [r[3], r[6]] = [r[6], r[3]];
    [r[4], r[7]] = [r[7], r[4]];
    return r;
  });
  return { ...data, columns: cols, data: rows };
}

/* ── Table ─────────────────────────────────────────────── */
function Table({ data, panelLabels=[], orientation=0, onOrientationChange, onCopyAll }) {
  const [search, setSearch]         = useState("");
  const [sortCol, setSortCol]       = useState(null);
  const [sortDir, setSortDir]       = useState("asc");
  const [page, setPage]             = useState(1);
  const [rpp, setRpp]               = useState(1000);
  const [copied, setCopied]         = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hiddenCases, setHiddenCases] = useState({});
  const filterRef = useRef();

  useEffect(() => { setSearch(""); setSortCol(null); setSortDir("asc"); setPage(1); setHiddenCases({}); }, [data]);
  useEffect(() => { setPage(1); }, [search, sortCol, sortDir, hiddenCases]);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = e => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  if (!data || !data.piers || !data.piers.length)
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",
        height:240,color:C.m,fontSize:15,flexDirection:"column",gap:10}}>
        <div style={{fontSize:36}}>📋</div>
        <div>Select shape, panels and stories, then click <b>Generate Scon Input Loads</b>.</div>
      </div>
    );

  const { piers, columns, data:rows, units={} } = data;
  const allCases = [...new Set(rows.map(r => String(r[0])))];

  const toggleCase = c => setHiddenCases(prev => ({...prev, [c]: !prev[c]}));
  const showAll = () => setHiddenCases({});
  const hideAll = () => setHiddenCases(Object.fromEntries(allCases.map(c=>[c,true])));

  const SCON_LABEL = { P:'N', V2:'Vy', M3:'Mz', V3:'Vz', M2:'My' };
  const colLabel = col => {
    const unit = units[col];
    const scon = SCON_LABEL[col];
    return (
      <>
        <span style={{fontWeight:700}}>{scon || col}{unit ? ` (${unit})` : ''}</span>
        {scon && <div style={{fontSize:10,fontWeight:400,color:C.m,marginTop:2,lineHeight:1}}>{col}</div>}
      </>
    );
  };

  const handleSort = i => {
    if (sortCol === i) setSortDir(d => d==="asc" ? "desc" : "asc");
    else { setSortCol(i); setSortDir("asc"); }
  };
  const SortIco = ({i}) => sortCol!==i
    ? <span style={{opacity:0.25,fontSize:9,marginLeft:3}}>▲▼</span>
    : <span style={{fontSize:10,marginLeft:3,color:sortCol===0?"#fff":P}}>{sortDir==="asc"?"▲":"▼"}</span>;

  const q = search.trim().toLowerCase();
  let displayRows = rows.filter(r => !hiddenCases[String(r[0])]);
  if (q) displayRows = displayRows.filter(r => String(r[0]).toLowerCase().includes(q));
  if (sortCol !== null) {
    displayRows = [...displayRows].sort((a,b) => {
      const av = a[sortCol], bv = b[sortCol];
      const cmp = typeof av==="number" ? av-bv : String(av).localeCompare(String(bv));
      return sortDir==="asc" ? cmp : -cmp;
    });
  }

  const total    = displayRows.length;
  const start    = (page-1)*rpp;
  const pageRows = displayRows.slice(start, start+rpp);
  const numColor = v => typeof v==="number" && v<0 ? "#dc2626" : "#1a1d23";
  const hiddenCount = Object.values(hiddenCases).filter(Boolean).length;

  const copyTable = () => {
    if (onCopyAll) { onCopyAll(setCopied); return; }
    const text = displayRows.map(row => row.slice(1).map(ct).join("\t")).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="scon-print-area" style={{background:"#fff",borderRadius:8,border:"1px solid #dee2e6",
      boxShadow:"0 1px 6px rgba(0,0,0,0.07)",overflow:"hidden"}}>

      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",
        borderBottom:"1px solid #dee2e6",background:"#fff"}}>

        <div style={{display:"flex",alignItems:"center",gap:6,flex:"0 0 200px",
          border:"1px solid #dee2e6",borderRadius:6,background:"#f8f9fa",padding:"6px 12px"}}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="#adb5bd" strokeWidth="2"/>
            <path d="M14 14l4 4" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Search output case…" value={search}
            onChange={e=>setSearch(e.target.value)}
            style={{flex:1,border:"none",outline:"none",fontSize:13,color:"#495057",background:"transparent"}} />
          {search&&<button onClick={()=>setSearch("")}
            style={{background:"none",border:"none",cursor:"pointer",color:"#adb5bd",fontSize:16,lineHeight:1,padding:0}}>×</button>}
        </div>

        <div style={{position:"relative"}} ref={filterRef}>
          <button onClick={()=>setFilterOpen(o=>!o)}
            style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:32,
              border:`1px solid ${hiddenCount>0?"#f59e0b":"#dee2e6"}`,borderRadius:5,
              background:hiddenCount>0?"#fffbeb":"#fff",cursor:"pointer",
              color:hiddenCount>0?"#b45309":"#495057",fontSize:13,fontWeight:500,flexShrink:0}}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Load Cases{hiddenCount>0?` (${allCases.length-hiddenCount}/${allCases.length})`:""}
          </button>
          {filterOpen&&(
            <div style={{position:"absolute",left:0,top:38,width:220,background:"#fff",
              border:"1px solid #dee2e6",borderRadius:8,boxShadow:"0 6px 20px rgba(0,0,0,0.12)",
              zIndex:200,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"8px 12px",borderBottom:"1px solid #dee2e6",background:"#f8f9fa"}}>
                <span style={{fontSize:12,fontWeight:700,color:P,textTransform:"uppercase",letterSpacing:"0.04em"}}>Load Cases</span>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={showAll} style={{fontSize:11,color:"#16a34a",border:"none",background:"none",cursor:"pointer",fontWeight:600,padding:0}}>All</button>
                  <button onClick={hideAll} style={{fontSize:11,color:"#dc2626",border:"none",background:"none",cursor:"pointer",fontWeight:600,padding:0}}>None</button>
                </div>
              </div>
              <div style={{maxHeight:280,overflowY:"auto",padding:"6px 0"}}>
                {allCases.map(c=>(
                  <label key={c} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 14px",cursor:"pointer",fontSize:13,
                    background:hiddenCases[c]?"#fef2f2":"transparent",color:hiddenCases[c]?"#9ca3af":C.t}}>
                    <input type="checkbox" checked={!hiddenCases[c]} onChange={()=>toggleCase(c)}
                      style={{accentColor:P,cursor:"pointer",margin:0}} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{flex:1}} />

        <span style={{fontSize:12,color:"#6c757d",whiteSpace:"nowrap"}}>
          {total} row{total!==1?"s":""}
          {(search||hiddenCount>0)&&<span style={{color:P,fontWeight:600}}> · filtered</span>}
        </span>

        <button onClick={copyTable} title={onCopyAll?"Copy all floors":"Copy data"}
          style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:32,
            border:"1px solid #dee2e6",borderRadius:5,background:copied?"#16a34a":"#fff",
            cursor:"pointer",color:copied?"#fff":"#495057",fontSize:13,fontWeight:500,
            transition:"all 0.2s",flexShrink:0}}>
          {copied ? (
            <><svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <path d="M4 10l5 5 7-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>Copied!</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <rect x="7" y="7" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M14 7V5a1.5 1.5 0 00-1.5-1.5h-8A1.5 1.5 0 003 5v10a1.5 1.5 0 001.5 1.5H7" stroke="currentColor" strokeWidth="1.8"/>
            </svg>{onCopyAll ? "Copy All Floors" : "Copy"}</>
          )}
        </button>

        {columns && onOrientationChange && (
          <>
            <div style={{width:1,height:22,background:"#dee2e6",flexShrink:0}} />
            <span style={{fontSize:12,color:C.m,whiteSpace:"nowrap",flexShrink:0}}>Orientation:</span>
            {[0,90,180,270].map(deg=>(
              <button key={deg} onClick={()=>onOrientationChange(deg)}
                style={{padding:"0 8px",height:32,minWidth:38,
                  border:`1px solid ${orientation===deg?P:"#dee2e6"}`,
                  borderRadius:5,background:orientation===deg?P:"#fff",
                  color:orientation===deg?"#fff":"#495057",
                  fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                {deg}°
              </button>
            ))}
          </>
        )}
      </div>

      {/* Table */}
      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 260px)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:14,
          fontFamily:"'Century Gothic',CenturyGothic,AppleGothic,sans-serif"}}>
          <thead style={{position:"sticky",top:0,zIndex:10}}>
          {columns ? (
            <tr style={{background:"#f1f3f5"}}>
              <th style={{padding:"10px 8px",textAlign:"center",fontWeight:700,fontSize:12,whiteSpace:"nowrap",
                borderRight:"1px solid #dee2e6",borderBottom:"2px solid #ced4da",
                background:P,color:"#fff",position:"sticky",top:0,zIndex:11,minWidth:40,width:40}}>No.</th>
              <th onClick={()=>handleSort(0)}
                style={{padding:"10px 16px",textAlign:"center",fontWeight:700,fontSize:13,whiteSpace:"nowrap",
                  borderRight:"2px solid #dee2e6",borderBottom:"2px solid #ced4da",cursor:"pointer",
                  userSelect:"none",minWidth:170,background:P,color:"#fff",position:"sticky",top:0,zIndex:11}}>
                Output Case <SortIco i={0}/>
              </th>
              {columns.map((col,i)=>{
                const ci=i+1; const isConst=col==="Cmy"||col==="Cmz";
                return (
                  <th key={col} onClick={()=>!isConst&&handleSort(ci)}
                    style={{padding:"10px 0",textAlign:"center",fontWeight:700,fontSize:13,whiteSpace:"nowrap",
                      background:isConst?"#f0f4f8":"#f1f3f5",borderLeft:"1px solid #dee2e6",
                      borderBottom:"2px solid #ced4da",cursor:isConst?"default":"pointer",
                      userSelect:"none",width:"11%",minWidth:90,color:isConst?C.m:sortCol===ci?P:C.t}}>
                    {colLabel(col)}{!isConst&&<SortIco i={ci}/>}
                    {isConst&&<div style={{fontSize:10,fontWeight:400,color:C.m}}>= 1</div>}
                  </th>
                );
              })}
            </tr>
          ) : (
            <>
            <tr style={{background:"#f1f3f5"}}>
              <th rowSpan={2} style={{padding:"10px 8px",textAlign:"center",fontWeight:700,fontSize:12,
                whiteSpace:"nowrap",verticalAlign:"middle",borderRight:"1px solid #dee2e6",
                borderBottom:"1px solid #dee2e6",minWidth:40,width:40,background:P,color:"#fff",
                position:"sticky",top:0,zIndex:11}}>No.</th>
              <th rowSpan={2} onClick={()=>handleSort(0)}
                style={{padding:"10px 16px",textAlign:"center",fontWeight:700,fontSize:13,
                  whiteSpace:"nowrap",verticalAlign:"middle",borderRight:"2px solid #dee2e6",
                  borderBottom:"1px solid #dee2e6",cursor:"pointer",userSelect:"none",
                  minWidth:170,background:P,color:"#fff",position:"sticky",top:0,zIndex:11}}>
                Output Case <SortIco i={0}/>
              </th>
              {piers.map((p,i)=>(
                <th key={i} colSpan={3}
                  style={{padding:"8px 16px",textAlign:"center",fontWeight:700,fontSize:14,
                    color:P,whiteSpace:"nowrap",background:"#f1f3f5",
                    borderLeft:"2px solid #dee2e6",borderBottom:"1px solid #ced4da"}}>
                  {panelLabels[i]&&(
                    <div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>
                      {panelLabels[i]}
                    </div>
                  )}
                  {p}
                </th>
              ))}
            </tr>
            <tr style={{background:"#f8f9fa"}}>
              {piers.flatMap((_,i)=>["P","V2","M3"].map((col,j)=>{
                const ci=1+i*3+j;
                return (
                  <th key={`${i}-${col}`} onClick={()=>handleSort(ci)}
                    style={{padding:"8px 16px",textAlign:"right",fontWeight:600,fontSize:12,
                      color:sortCol===ci?P:"#495057",whiteSpace:"nowrap",background:"#f8f9fa",
                      borderLeft:col==="P"?"2px solid #dee2e6":"none",
                      borderBottom:"2px solid #ced4da",cursor:"pointer",userSelect:"none"}}>
                    {colLabel(col)} <SortIco i={ci}/>
                  </th>
                );
              }))}
            </tr>
            </>
          )}
          </thead>
          <tbody>
            {pageRows.map((row,ri)=>(
              <tr key={ri} style={{background:ri%2===0?"#fff":"#f8f9fa"}}
                onMouseEnter={e=>e.currentTarget.style.background="#e8f0fe"}
                onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?"#fff":"#f8f9fa"}>
                <td style={{padding:"10px 8px",borderBottom:"1px solid #e9ecef",borderRight:"1px solid #dee2e6",
                  textAlign:"center",fontSize:12,color:C.m,fontWeight:500,whiteSpace:"nowrap"}}>
                  {start+ri+1}
                </td>
                {row.map((cell,j)=>(
                  <td key={j} style={{padding:"10px 8px",borderBottom:"1px solid #e9ecef",
                    borderLeft:columns?j>0?"1px solid #dee2e6":"none":j>0&&(j-1)%3===0?"2px solid #dee2e6":"none",
                    color:j===0?"#343a40":numColor(cell),whiteSpace:"nowrap",textAlign:"center",
                    fontWeight:j===0?600:400,fontSize:14}}>
                    {ct(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length===0&&(
              <tr><td colSpan={columns?2+columns.length:1+piers.length*3}
                style={{padding:"36px",textAlign:"center",color:"#adb5bd",fontSize:14}}>
                No matching rows
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,
        padding:"10px 16px",borderTop:"1px solid #dee2e6",background:"#f8f9fa",fontSize:13,color:"#6c757d"}}>
        <span>Rows per page:</span>
        <select value={rpp} onChange={e=>{setRpp(Number(e.target.value));setPage(1);}}
          style={{border:"1px solid #dee2e6",borderRadius:4,padding:"3px 8px",fontSize:13,
            background:"#fff",color:"#495057",outline:"none",cursor:"pointer"}}>
          {[50,100,500,1000].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{minWidth:80,textAlign:"right"}}>
          {total===0?"0":start+1}–{Math.min(start+rpp,total)} of {total}
        </span>
        <button onClick={()=>setPage(p=>p-1)} disabled={page===1}
          style={{width:28,height:28,borderRadius:5,border:"1px solid #dee2e6",
            background:page===1?"#f1f3f5":"#fff",cursor:page===1?"not-allowed":"pointer",
            color:page===1?"#ced4da":"#495057",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>◁</button>
        <button onClick={()=>setPage(p=>p+1)} disabled={start+rpp>=total}
          style={{width:28,height:28,borderRadius:5,border:"1px solid #dee2e6",
            background:start+rpp>=total?"#f1f3f5":"#fff",cursor:start+rpp>=total?"not-allowed":"pointer",
            color:start+rpp>=total?"#ced4da":"#495057",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>▷</button>
      </div>
    </div>
  );
}

/* ── Charts ─────────────────────────────────────────────── */
const BASE_LAYOUT = { paper_bgcolor:"transparent",plot_bgcolor:"transparent",font:{family:"sans-serif",size:11},showlegend:true };

function PlotlyChart({ traces, layout }) {
  const ref = useRef();
  useEffect(()=>{
    if(!ref.current||!traces||!traces.length) return;
    function render() { try { window.Plotly.newPlot(ref.current,traces,{...BASE_LAYOUT,...layout},{responsive:true,displayModeBar:false}); } catch(e){ console.error(e); } }
    if(window.Plotly){ render(); return; }
    const id=setInterval(()=>{ if(window.Plotly){ clearInterval(id); render(); } },100);
    return ()=>clearInterval(id);
  },[traces]);
  if(!traces||!traces.length) return <div style={{color:C.m,fontSize:13,padding:16}}>No data</div>;
  return <div ref={ref} style={{width:"100%"}} />;
}

const CARD={background:C.card,border:"1px solid "+C.b,borderRadius:10,padding:16};
const PALETTE=["#274365","#ef4444","#f59e0b","#10b981","#8b5cf6","#3b82f6","#ec4899","#14b8a6","#f97316","#6366f1"];

function SectionTitle({children}){return <div style={{fontWeight:700,fontSize:15,color:C.t,marginBottom:16,paddingBottom:8,borderBottom:"2px solid "+C.b}}>{children}</div>;}
function ChartCard({title,children}){return <div style={CARD}><div style={{fontWeight:600,fontSize:12,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:12}}>{title}</div>{children}</div>;}

function StoryFilter({value,onChange,storyList}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <label style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>Filter by story</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{padding:"5px 10px",borderRadius:6,border:"1px solid "+C.b,background:C.card,fontSize:13,color:C.t,outline:"none",minWidth:140}}>
        <option value="">All Stories</option>
        {storyList.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

function PierShareCard({graphs}){
  const [pieStory,setPieStory]=useState("");
  const storyList=Object.keys(graphs.pier_share_by_story||{});
  const traces=pieStory?(graphs.pier_share_by_story?.[pieStory]||graphs.pier_share):graphs.pier_share;
  return(<ChartCard title={`V2 Pier Share — ${pieStory||"All Stories"}`}>
    <StoryFilter value={pieStory} onChange={setPieStory} storyList={storyList}/>
    <PlotlyChart traces={traces} layout={{height:320,margin:{t:10,r:100,b:30,l:100},legend:{orientation:"h",y:-0.1,xanchor:"center",x:0.5}}}/>
  </ChartCard>);
}

function ForcePieBarCard({title,forceKey,forceDist,yLabel}){
  const [selStory,setSelStory]=useState("");
  const storyList=forceDist?.stories?.length?forceDist.stories:Object.keys(forceDist?.by_story||{});
  const src=selStory?(forceDist?.by_story?.[selStory]?.[forceKey]):forceDist?.[forceKey];
  const pieTraces=src?.pie||[];const gov=src?.governing||{};const isP=!!gov.max_cases;
  const tickAngle=(gov.piers||[]).length>7?-45:0;
  let barTraces,uniqueCases,caseColor;
  if(isP){
    const allC=[...new Set([...(gov.max_cases||[]),...(gov.min_cases||[])])];
    caseColor=Object.fromEntries(allC.map((c,i)=>[c,PALETTE[i%PALETTE.length]]));uniqueCases=allC;
    barTraces=[
      {name:"Max P (Tension)",type:"bar",x:gov.piers||[],y:gov.max_values||[],text:gov.max_cases||[],textposition:"outside",marker:{color:(gov.max_cases||[]).map(c=>caseColor[c])},hovertemplate:"<b>%{x}</b><br>Max P: %{y} kip<br>Case: %{text}<extra></extra>"},
      {name:"Min P (Compression)",type:"bar",x:gov.piers||[],y:gov.min_values||[],text:gov.min_cases||[],textposition:"outside",marker:{color:(gov.min_cases||[]).map(c=>caseColor[c]),opacity:0.65},hovertemplate:"<b>%{x}</b><br>Min P: %{y} kip<br>Case: %{text}<extra></extra>"},
    ];
  }else{
    uniqueCases=[...new Set(gov.cases||[])];
    caseColor=Object.fromEntries(uniqueCases.map((c,i)=>[c,PALETTE[i%PALETTE.length]]));
    barTraces=[{type:"bar",x:gov.piers||[],y:gov.values||[],text:gov.cases||[],textposition:"outside",marker:{color:(gov.cases||[]).map(c=>caseColor[c])},hovertemplate:"<b>%{x}</b><br>"+yLabel+": %{y}<br>Case: %{text}<extra></extra>"}];
  }
  return(
    <div style={CARD}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:8,borderBottom:"1px solid "+C.b}}>
        <div style={{fontWeight:700,fontSize:13,color:C.t}}>{title}</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <label style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>Story</label>
          <select value={selStory} onChange={e=>setSelStory(e.target.value)} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+C.b,background:"#fff",fontSize:12,color:C.t,outline:"none",minWidth:130}}>
            <option value="">All Stories</option>{storyList.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        <div><div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Pier Share</div>
          <PlotlyChart traces={pieTraces} layout={{height:280,margin:{t:10,r:80,b:30,l:80},legend:{orientation:"h",y:-0.1,xanchor:"center",x:0.5}}}/>
        </div>
        <div><div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>{isP?"Max (Tension) & Min (Compression) — Governing Case":"Max Value & Governing Case"}</div>
          <PlotlyChart traces={barTraces} layout={{height:280,showlegend:isP,barmode:"group",margin:{t:30,r:10,b:tickAngle?80:55,l:65},xaxis:{title:"Pier",tickangle:tickAngle,automargin:true},yaxis:{title:yLabel,automargin:true},legend:{orientation:"h",y:-0.25,xanchor:"center",x:0.5}}}/>
          <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",marginTop:8}}>
            {uniqueCases.map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.t}}><div style={{width:10,height:10,borderRadius:2,background:caseColor[c],flexShrink:0}}/>{c}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function EnvelopeCard({graphs}){
  const [envStory,setEnvStory]=useState("");
  const env=graphs.envelope||{};const storyList=Object.keys(env.by_story||{});
  const d=envStory?(env.by_story?.[envStory]||env):env;
  const pierCount=(d.piers||[]).length;const tickAngle=pierCount>8?-45:0;const bH=Math.max(240,pierCount*20+80);
  const barLayout=yTitle=>({height:bH,margin:{t:10,r:20,b:tickAngle?90:55,l:70},xaxis:{title:"Pier",automargin:true,tickangle:tickAngle},yaxis:{title:yTitle,automargin:true},showlegend:false});
  const mkTrace=(key,label,color)=>[{name:label,x:d.piers||[],y:d[key]||[],type:"bar",marker:{color}}];
  const pTraces=[{name:"Max P",x:d.piers||[],y:d.p_max||[],type:"bar",marker:{color:"#10b981"}},{name:"Min P",x:d.piers||[],y:d.p_min||[],type:"bar",marker:{color:"#f59e0b"}}];
  const pLayout={...barLayout("P (kip)"),barmode:"group",showlegend:true,legend:{orientation:"h",y:-0.25,xanchor:"center",x:0.5},margin:{...barLayout("P (kip)").margin,b:tickAngle?110:75}};
  return(<ChartCard title={`Pier Demand Envelope — ${envStory||"All Stories"}`}>
    <StoryFilter value={envStory} onChange={setEnvStory} storyList={storyList}/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div><div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Axial P — Max &amp; Min (kip)</div><PlotlyChart traces={pTraces} layout={pLayout}/></div>
      <div><div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Shear V2 (kip)</div><PlotlyChart traces={mkTrace("v2","V2","#274365")} layout={barLayout("V2 (kip)")}/></div>
      <div style={{gridColumn:"1/-1"}}><div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Moment M3 (kip-ft)</div><PlotlyChart traces={mkTrace("m3","M3","#ef4444")} layout={{...barLayout("M3 (kip-ft)"),height:Math.max(200,pierCount*16+70)}}/></div>
    </div>
  </ChartCard>);
}

function PMScatterCard({graphs}){
  const traces=graphs.pm_scatter||[];
  return(<ChartCard title="P–M Interaction — Axial Force vs Moment (All Load Cases)">
    <PlotlyChart traces={traces} layout={{height:400,hovermode:"closest",margin:{t:20,r:30,b:70,l:80},xaxis:{title:"M3 (kip-ft)",zeroline:true,zerolinecolor:"#e3e6eb",zerolinewidth:1.5},yaxis:{title:"P (kip)",zeroline:true,zerolinecolor:"#e3e6eb",zerolinewidth:1.5},legend:{orientation:"h",y:-0.18,xanchor:"center",x:0.5}}}/>
    <div style={{fontSize:11,color:C.m,marginTop:6}}>Each dot = one load case. Hover to see case name.</div>
  </ChartCard>);
}

function ProfileCard({title,traces,xTitle}){
  const allStories=traces?.[0]?.y||[];
  const [fromStory,setFromStory]=useState("");const [toStory,setToStory]=useState("");
  const iFrom=fromStory?allStories.indexOf(fromStory):0;const iTo=toStory?allStories.indexOf(toStory):allStories.length-1;
  const lo=Math.min(iFrom,iTo),hi=Math.max(iFrom,iTo);
  const filtered=(traces||[]).map(tr=>({...tr,x:tr.x.slice(lo,hi+1),y:tr.y.slice(lo,hi+1)}));
  const layout={height:Math.max(360,(hi-lo+1)*22+100),paper_bgcolor:"transparent",plot_bgcolor:"transparent",font:{family:"sans-serif",size:10},margin:{t:10,r:10,b:50,l:90},xaxis:{title:xTitle,automargin:true,zeroline:true,zerolinecolor:"#e3e6eb"},yaxis:{title:"Story",type:"category",automargin:true,tickfont:{size:10}},legend:{orientation:"h",y:-0.14,xanchor:"center",x:0.5},hovermode:"y unified"};
  return(<ChartCard title={title}>
    <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
      {[{label:"From",val:fromStory,set:setFromStory},{label:"To",val:toStory,set:setToStory}].map(({label,val,set})=>(
        <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</span>
          <select value={val} onChange={e=>set(e.target.value)} style={{padding:"3px 7px",borderRadius:5,border:"1px solid "+C.b,fontSize:12,color:C.t,background:"#fff",outline:"none",minWidth:110}}>
            <option value="">{label==="From"?"Bottom":"Top"}</option>{allStories.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ))}
      {(fromStory||toStory)&&<button onClick={()=>{setFromStory("");setToStory("");}} style={{fontSize:11,color:C.d,border:"none",background:"none",cursor:"pointer",padding:0}}>Clear</button>}
    </div>
    <PlotlyChart traces={filtered} layout={layout}/>
  </ChartCard>);
}

function OverviewGraphs({graphs}){
  if(!graphs) return null;
  return(<div style={{display:"flex",flexDirection:"column",gap:20}}>
    <SectionTitle>Pier Demand — Distribution &amp; Governing Load Case</SectionTitle>
    <ForcePieBarCard title="Shear Force V2"       forceKey="v2" forceDist={graphs.force_dist} yLabel="Max |V2| (kip)"/>
    <ForcePieBarCard title="Overturning Moment M3" forceKey="m3" forceDist={graphs.force_dist} yLabel="Max |M3| (kip-ft)"/>
    <ForcePieBarCard title="Axial Force P"          forceKey="p"  forceDist={graphs.force_dist} yLabel="Max |P| (kip)"/>
    <SectionTitle>P–M Interaction</SectionTitle>
    <PMScatterCard graphs={graphs}/>
    <SectionTitle>Story Force Profiles</SectionTitle>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
      <ProfileCard title="Shear V2 by Story"     traces={graphs.v2_profile} xTitle="Max |V2| (kip)"/>
      <ProfileCard title="Moment M3 by Story"    traces={graphs.m3_profile} xTitle="Max |M3| (kip-ft)"/>
      <ProfileCard title="Axial Force P by Story" traces={graphs.p_profile}  xTitle="Max |P| (kip)"/>
    </div>
  </div>);
}

function AIIndicatorTab({graphs}){
  if(!graphs) return null;
  const insights=[];const fd=graphs.force_dist;
  const v2gov=fd?.v2?.governing;
  if(v2gov?.piers?.length){const idx=v2gov.values.reduce((mi,v,i)=>Math.abs(v)>Math.abs(v2gov.values[mi])?i:mi,0);insights.push({icon:"⚡",label:"Critical Shear (V2) Pier",value:v2gov.piers[idx],detail:`Max |V2| = ${Math.abs(v2gov.values[idx]).toFixed(0)} kip`,case:v2gov.cases[idx],color:"#1d4ed8",bg:"#eff6ff"});}
  const m3gov=fd?.m3?.governing;
  if(m3gov?.piers?.length){const idx=m3gov.values.reduce((mi,v,i)=>Math.abs(v)>Math.abs(m3gov.values[mi])?i:mi,0);insights.push({icon:"🔩",label:"Critical Moment (M3) Pier",value:m3gov.piers[idx],detail:`Max |M3| = ${Math.abs(m3gov.values[idx]).toFixed(0)} kip-ft`,case:m3gov.cases[idx],color:"#7c3aed",bg:"#f5f3ff"});}
  const pgov=fd?.p?.governing;
  if(pgov?.piers?.length){
    if(pgov.max_values?.length){const idx=pgov.max_values.reduce((mi,v,i)=>v>pgov.max_values[mi]?i:mi,0);insights.push({icon:"↑",label:"Max Tension Pier",value:pgov.piers[idx],detail:`P = +${pgov.max_values[idx].toFixed(0)} kip (tension)`,case:pgov.max_cases[idx],color:"#b45309",bg:"#fffbeb"});}
    if(pgov.min_values?.length){const idx=pgov.min_values.reduce((mi,v,i)=>v<pgov.min_values[mi]?i:mi,0);insights.push({icon:"↓",label:"Max Compression Pier",value:pgov.piers[idx],detail:`P = ${pgov.min_values[idx].toFixed(0)} kip (compression)`,case:pgov.min_cases[idx],color:"#be123c",bg:"#fff1f2"});}
  }
  const allCases=[...(v2gov?.cases||[]),...(m3gov?.cases||[]),...(pgov?.max_cases||[]),...(pgov?.min_cases||[])];
  let dominantCase=null;
  if(allCases.length){const freq={};allCases.forEach(c=>{freq[c]=(freq[c]||0)+1;});const top=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];dominantCase={name:top[0],count:top[1],total:allCases.length};}
  const pierSet=new Set([...(v2gov?.piers||[]),...(m3gov?.piers||[]),...(pgov?.piers||[])]);
  const pierRows=[...pierSet].map(pier=>{
    const v2i=v2gov?.piers?.indexOf(pier);const m3i=m3gov?.piers?.indexOf(pier);const pi=pgov?.piers?.indexOf(pier);
    return{pier,v2:v2i>=0?Math.abs(v2gov.values[v2i]).toFixed(0):"—",v2c:v2i>=0?v2gov.cases[v2i]:"—",m3:m3i>=0?Math.abs(m3gov.values[m3i]).toFixed(0):"—",m3c:m3i>=0?m3gov.cases[m3i]:"—",pt:pi>=0&&pgov.max_values?pgov.max_values[pi].toFixed(0):"—",pc:pi>=0&&pgov.min_values?pgov.min_values[pi].toFixed(0):"—"};
  });
  const th={padding:"8px 12px",fontSize:12,fontWeight:700,color:"#fff",background:P,textAlign:"left",whiteSpace:"nowrap"};
  const td={padding:"7px 12px",fontSize:12,color:C.t,borderBottom:"1px solid "+C.b};
  const tdc={padding:"7px 12px",fontSize:11,color:C.m,borderBottom:"1px solid "+C.b};
  return(
    <div style={{padding:24}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <span style={{background:P,color:"#fff",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:12,letterSpacing:"0.08em"}}>✦ AI INDICATOR</span>
        <span style={{fontSize:13,color:C.m}}>Automated insights derived from governing pier force data</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14,marginBottom:24}}>
        {insights.map((ins,i)=>(
          <div key={i} style={{background:ins.bg,border:"1px solid "+C.b,borderRadius:10,padding:"14px 16px",boxShadow:"0 1px 4px rgba(39,67,101,0.08)"}}>
            <div style={{fontSize:11,color:ins.color,fontWeight:700,marginBottom:6,letterSpacing:"0.05em"}}>{ins.icon} {ins.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:ins.color,marginBottom:4}}>{ins.value}</div>
            <div style={{fontSize:12,color:C.t,fontWeight:500}}>{ins.detail}</div>
            <div style={{fontSize:11,color:C.m,marginTop:3}}>Case: <b>{ins.case}</b></div>
          </div>
        ))}
        {dominantCase&&(
          <div style={{background:"#f0fdf4",border:"1px solid "+C.b,borderRadius:10,padding:"14px 16px",boxShadow:"0 1px 4px rgba(39,67,101,0.08)"}}>
            <div style={{fontSize:11,color:"#15803d",fontWeight:700,marginBottom:6,letterSpacing:"0.05em"}}>📋 Dominant Load Case</div>
            <div style={{fontSize:22,fontWeight:800,color:"#15803d",marginBottom:4}}>{dominantCase.name}</div>
            <div style={{fontSize:12,color:C.t,fontWeight:500}}>Governs {dominantCase.count} of {dominantCase.total} critical checks</div>
            <div style={{fontSize:11,color:C.m,marginTop:3}}>{((dominantCase.count/dominantCase.total)*100).toFixed(0)}% dominance across all forces</div>
          </div>
        )}
      </div>
      <div style={{fontSize:13,fontWeight:700,color:P,marginBottom:8}}>Pier-by-Pier Governing Summary</div>
      <div style={{overflowX:"auto",borderRadius:8,boxShadow:"0 1px 6px rgba(39,67,101,0.08)"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>
            <th style={th}>Pier</th><th style={th}>Max |V2| (kip)</th><th style={th}>V2 Case</th>
            <th style={th}>Max |M3| (kip-ft)</th><th style={th}>M3 Case</th><th style={th}>Max P+ (kip)</th><th style={th}>Min P− (kip)</th>
          </tr></thead>
          <tbody>{pierRows.map((r,i)=>(
            <tr key={r.pier} style={{background:i%2===0?"#fff":"#f8fafc"}}>
              <td style={{...td,fontWeight:700,color:P}}>{r.pier}</td>
              <td style={td}>{r.v2}</td><td style={tdc}>{r.v2c}</td>
              <td style={td}>{r.m3}</td><td style={tdc}>{r.m3c}</td>
              <td style={td}>{r.pt}</td><td style={td}>{r.pc}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{fontSize:11,color:C.m,marginTop:10,fontStyle:"italic"}}>Results are for reference only — please verify before use.</div>
    </div>
  );
}

/* ── Sidebar helpers ── */
function SbLabel({children}){return <div style={{fontSize:14,fontWeight:600,color:P,marginBottom:6}}>{children}</div>;}
function Divider(){return <div style={{borderTop:"1px solid "+C.b,margin:"14px 0"}}/>;}

/* ── App ── */
export default function App(){
  const [projName,setProjName]=useState("");const [engineer,setEngineer]=useState("");
  const today=new Date().toLocaleDateString();
  const [file,setFile]=useState(null);const [fileKey,setFileKey]=useState(0);
  const [loading,setLoading]=useState(false);const [error,setError]=useState(null);
  const [options,setOptions]=useState(null);const [result,setResult]=useState(null);
  const [overviewLoading,setOverviewLoading]=useState(false);
  const [loadType,setLoadType]=useState("panel");const [orientation,setOrientation]=useState(0);

  const loadOverview=useCallback(async f=>{
    if(!f) return; setOverviewLoading(true);
    const form=new FormData(); form.append("lateral_loads_file",f);
    try{ const res=await fetch(`${BASE}/api/overview/`,{method:"POST",body:form}); const json=await res.json(); if(res.ok) setOptions(prev=>({...prev,...json})); }catch(e){}
    finally{ setOverviewLoading(false); }
  },[]);

  const [shape,setShape]=useState("");
  const [selectedStories,setSelectedStories]=useState([]);
  const [currentStoryIdx,setCurrentStoryIdx]=useState(0);
  const [pierSlots,setPierSlots]=useState([]);
  const [tab,setTab]=useState("table");
  const [helpOpen,setHelpOpen]=useState(false);
  const helpRef=useRef(null);

  useEffect(()=>{
    if(!helpOpen) return;
    const handler=e=>{ if(helpRef.current&&!helpRef.current.contains(e.target)) setHelpOpen(false); };
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[helpOpen]);

  const requiredPiers=SHAPES.find(s=>s.key===shape)?.piers||0;
  const isSectional=shape==='I'||loadType==='sectional';
  const effectivePierCount=isSectional?1:requiredPiers;
  const selectedPiers=pierSlots.filter(Boolean);

  // All piers from file — no story dependency (story selected after panels)
  const pierOpts=options?.pier_options||[];

  // Story list filtered to floors where ALL selected piers exist
  const validStories=selectedPiers.length>0&&selectedPiers.length===effectivePierCount
    ?(options?.story_options||[]).filter(s=>selectedPiers.every(p=>(options?.story_piers?.[s]||[]).includes(p)))
    :(options?.story_options||[]);

  const canApply=selectedStories.length>0&&effectivePierCount>0&&
    selectedPiers.length===effectivePierCount&&new Set(selectedPiers).size===effectivePierCount;

  const isFlipped=(shape==='C'&&[0,180].includes(orientation))||(['I','L'].includes(shape)&&[90,270].includes(orientation));

  const storyOrder=result?.tables?(options?.story_options||[]).filter(s=>s in result.tables):[];
  const currentStory=storyOrder[currentStoryIdx]||null;
  const currentTableData=currentStory?result.tables[currentStory]:null;
  const orientedTable=getOrientedTableData(currentTableData,isFlipped);

  useEffect(()=>{
    if(window.Plotly) return;
    const s=document.createElement("script"); s.src="https://cdn.plot.ly/plotly-2.27.0.min.js"; s.async=true; document.head.appendChild(s);
  },[]);

  const uploadFile=useCallback(async f=>{
    setLoading(true); setError(null);
    const form=new FormData(); form.append("lateral_loads_file",f);
    try{ const res=await fetch(API_URL,{method:"POST",body:form}); const json=await res.json(); if(!res.ok) throw new Error(json.detail||"Upload failed"); setOptions(json); }
    catch(e){ setError(e.message); } finally{ setLoading(false); }
  },[]);

  const applySelection=useCallback(async()=>{
    if(!canApply||!file) return; setLoading(true); setError(null);
    const form=new FormData();
    form.append("lateral_loads_file",file); form.append("stories",JSON.stringify(selectedStories));
    form.append("piers",JSON.stringify(selectedPiers)); form.append("shape",shape); form.append("load_type",loadType);
    try{
      const res=await fetch(API_URL,{method:"POST",body:form}); const json=await res.json();
      if(!res.ok) throw new Error(json.detail||"Error");
      setOptions(prev=>({...prev,...json})); setResult(json); setCurrentStoryIdx(0); setTab("table");
    }catch(e){ setError(e.message); } finally{ setLoading(false); }
  },[canApply,file,selectedStories,selectedPiers,shape,loadType]);

  const handleFile=useCallback(f=>{
    setFile(f); setOptions(null); setResult(null);
    setShape(""); setSelectedStories([]); setPierSlots([]); setCurrentStoryIdx(0);
    uploadFile(f);
  },[uploadFile]);

  const handleShapeChange=s=>{
    const n=SHAPES.find(x=>x.key===s)?.piers||0;
    setShape(s); setLoadType("panel"); setOrientation(0);
    setPierSlots(Array(n).fill("")); setSelectedStories([]); setResult(null); setCurrentStoryIdx(0);
  };
  const handleLoadTypeChange=lt=>{
    setLoadType(lt); setOrientation(0);
    const n=lt==='sectional'?1:requiredPiers;
    setPierSlots(Array(n).fill("")); setSelectedStories([]); setResult(null); setCurrentStoryIdx(0);
  };

  // Pier change: auto-remove stories that no longer have all selected piers
  const handlePierSlotChange=(i,value)=>{
    const next=[...pierSlots]; next[i]=value; setPierSlots(next);
    const newPiers=next.filter(Boolean);
    setSelectedStories(prev=>newPiers.length>0
      ?prev.filter(s=>newPiers.every(p=>(options?.story_piers?.[s]||[]).includes(p)))
      :[]
    );
    setResult(null); setCurrentStoryIdx(0);
  };

  const toggleStory=s=>{ setSelectedStories(prev=>prev.includes(s)?prev.filter(x=>x!==s):[...prev,s]); setResult(null); setCurrentStoryIdx(0); };
  const selectAllStories=()=>{ setSelectedStories(validStories); setResult(null); setCurrentStoryIdx(0); };
  const clearAllStories=()=>{ setSelectedStories([]); setResult(null); setCurrentStoryIdx(0); };

  const copyAllStories=useCallback((setCopied)=>{
    if(!result?.tables) return;
    const order=(options?.story_options||[]).filter(s=>s in result.tables);
    const lines=order.flatMap(s=>{
      const tData=result.tables[s]; if(!tData?.data?.length) return [];
      return[`[${s}]`,...tData.data.map(row=>row.slice(1).map(ct).join("\t")),""];
    });
    navigator.clipboard.writeText(lines.join("\n").trimEnd()).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  },[result,options]);

  const infoInput={border:"none",borderBottom:"1px solid #ccc",padding:"3px 4px",fontSize:13,color:C.t,background:"transparent",outline:"none",width:"100%"};

  return(
    <>
      <style>{`*{box-sizing:border-box}body{font-family:'Century Gothic',CenturyGothic,AppleGothic,sans-serif;background:${C.bg};margin:0}@keyframes spin{to{transform:rotate(360deg)}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:#b0bac6;border-radius:3px}@media print{body>*{display:none!important}.scon-print-area{display:block!important;border:none!important;box-shadow:none!important}.scon-print-area button,.scon-print-area input,.scon-print-area select{display:none!important}.scon-print-area td,.scon-print-area th{padding:6px 10px!important;font-size:11px!important}}`}</style>

      {/* Header */}
      <div style={{height:80,background:P,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 8px rgba(0,0,0,0.18)"}}>
        <div/>
        <div ref={helpRef} style={{position:"relative"}}>
          <span onClick={()=>setHelpOpen(o=>!o)} style={{color:"#fff",cursor:"pointer",fontSize:15,fontWeight:500,letterSpacing:"0.03em",padding:"4px 8px",borderRadius:4,background:helpOpen?"rgba(255,255,255,0.15)":"transparent"}}>Help</span>
          {helpOpen&&(
            <div style={{position:"absolute",right:0,top:36,paddingTop:4,width:360,zIndex:300}}>
              <div style={{background:"#fff",border:"1px solid "+C.b,borderRadius:8,boxShadow:"0 6px 20px rgba(0,0,0,0.15)",padding:16,fontSize:13,color:P}}>
                <ul style={{margin:0,paddingLeft:20,lineHeight:2.2,color:P,fontWeight:500}}>
                  <li>Compatible with ETABS Pier Forces export (.xlsx)</li>
                  <li>Database Units should be Kip – Ft</li>
                  <li>Select shape → panels → stories (auto-filtered to floors with your panels)</li>
                  <li><a href={`${BASE}/static/sample_pier_forces.xlsx`} download style={{color:P,fontWeight:700}}>Download sample file</a></li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{display:"flex",minHeight:"calc(100vh - 80px)",width:"100vw"}}>

        {/* Sidebar */}
        <div style={{width:265,background:C.card,borderRight:"1px solid "+C.b,padding:"20px 0",overflowY:"auto",flexShrink:0,boxShadow:"3px 0 8px rgba(0,0,0,0.06)"}}>
          <div style={{textAlign:"center",fontWeight:700,fontSize:22,color:P,marginBottom:20,letterSpacing:"-0.01em"}}>ETABS PIER VIEWER</div>

          <div style={{padding:"0 18px"}}>
            {[{label:"Project Name:",val:projName,set:setProjName,ph:"Enter Project Name"},{label:"Engineer:",val:engineer,set:setEngineer,ph:"Enter Engineer Name"}].map(({label,val,set,ph})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:600,color:P,minWidth:95,flexShrink:0}}>{label}</span>
                <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={{...infoInput,fontSize:12}}/>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:600,color:P,minWidth:95,flexShrink:0}}>Date:</span>
              <input value={today} disabled style={{...infoInput,color:C.m,fontSize:12}}/>
            </div>
          </div>

          <Divider/>

          <div style={{padding:"0 18px",marginBottom:4}}>
            <SbLabel>Upload Pier Forces from ETABS</SbLabel>
            <input key={fileKey} type="file" accept=".xlsx" onChange={e=>{if(e.target.files[0]) handleFile(e.target.files[0]);}} style={{fontSize:12,width:"100%",cursor:"pointer"}}/>
          </div>

          {loading&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",color:C.m,fontSize:12}}><div style={{width:13,height:13,border:"2px solid "+C.b,borderTop:"2px solid "+P,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/>Processing…</div>}
          {error&&<div style={{margin:"8px 18px",background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:6,padding:"8px 10px",color:C.d,fontSize:12}}>{error}</div>}

          {options&&!loading&&(<>
            <Divider/>

            {/* 1 — Wall Shape */}
            <div style={{padding:"0 18px",marginBottom:4}}>
              <SbLabel>Select Wall Shape</SbLabel>
              <div style={{display:"flex",gap:4}}>
                {SHAPES.map(s=>(
                  <button key={s.key} onClick={()=>handleShapeChange(s.key)}
                    style={{flex:1,padding:"7px 0",border:"1px solid "+(shape===s.key?P:C.b),borderRadius:4,background:shape===s.key?P:C.card,color:shape===s.key?"#fff":C.t,fontSize:14,fontWeight:700,cursor:"pointer",transition:"all 0.1s"}}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2 — Load Type (C/L only) */}
            {shape&&(shape==='C'||shape==='L')&&(<>
              <Divider/>
              <div style={{padding:"0 18px",marginBottom:4}}>
                <SbLabel>Load Type</SbLabel>
                <div style={{display:"flex",gap:4}}>
                  {[{key:'panel',label:'Panel'},{key:'sectional',label:'Sectional'}].map(lt=>(
                    <button key={lt.key} onClick={()=>handleLoadTypeChange(lt.key)}
                      style={{flex:1,padding:"7px 0",border:"1px solid "+(loadType===lt.key?P:C.b),borderRadius:4,background:loadType===lt.key?P:C.card,color:loadType===lt.key?"#fff":C.t,fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.1s"}}>
                      {lt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>)}

            {/* 3 — Panels, Story, Generate */}
            {shape&&effectivePierCount>0&&(<>
              <Divider/>
              <div style={{padding:"0 18px"}}>
                <SbLabel>Select Panels — {shape} shape</SbLabel>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {pierSlots.map((val,i)=>{
                    const label=effectivePierCount===1?"Panel":`Panel ${i+1}`;
                    const usedElsewhere=pierSlots.filter((_,j)=>j!==i);
                    const opts=pierOpts.filter(p=>!usedElsewhere.includes(p));
                    return(
                      <div key={i}>
                        <div style={{fontSize:12,fontWeight:600,color:C.m,marginBottom:3}}>{label}</div>
                        <select value={val} onChange={e=>handlePierSlotChange(i,e.target.value)}
                          style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid "+(val?"#16a34a":C.b),background:C.card,color:val?C.t:C.m,fontSize:13,outline:"none",cursor:"pointer"}}>
                          <option value="">— Select pier —</option>
                          {opts.map(p=><option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div style={{fontSize:11,marginTop:8,color:selectedPiers.length===effectivePierCount?"#16a34a":C.m}}>
                  {selectedPiers.length}/{effectivePierCount} selected
                  {selectedPiers.length<effectivePierCount?` — select ${effectivePierCount-selectedPiers.length} more`:" ✓ ready"}
                </div>
              </div>

              {/* 4 — Story (filtered to floors with these panels) */}
              <Divider/>
              <div style={{padding:"0 18px",marginBottom:4}}>
                <SbLabel>Select Story</SbLabel>
                {selectedPiers.length===effectivePierCount?(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <span style={{fontSize:11,color:C.m}}>
                        {selectedStories.length===0
                          ?`${validStories.length} floor${validStories.length!==1?"s":""} available`
                          :`${selectedStories.length} of ${validStories.length} selected`}
                      </span>
                      <div style={{display:"flex",gap:10}}>
                        <button onClick={selectAllStories} style={{fontSize:11,color:"#16a34a",border:"none",background:"none",cursor:"pointer",fontWeight:600,padding:0}}>All</button>
                        <button onClick={clearAllStories} style={{fontSize:11,color:C.d,border:"none",background:"none",cursor:"pointer",fontWeight:600,padding:0}}>None</button>
                      </div>
                    </div>
                    <div style={{height:180,overflowY:"auto",border:"1px solid "+C.b,borderRadius:4,background:C.card}}>
                      {validStories.length===0?(
                        <div style={{padding:"16px 10px",fontSize:12,color:C.m,textAlign:"center"}}>No floors found with all selected panels</div>
                      ):validStories.map(s=>(
                        <label key={s} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 10px",cursor:"pointer",fontSize:13,background:selectedStories.includes(s)?"#27436514":"transparent",color:selectedStories.includes(s)?P:C.t}}>
                          <input type="checkbox" checked={selectedStories.includes(s)} onChange={()=>toggleStory(s)} style={{accentColor:P,cursor:"pointer",margin:0}}/>
                          {s}
                        </label>
                      ))}
                    </div>
                  </>
                ):(
                  <div style={{fontSize:12,color:C.m,padding:"8px 0",fontStyle:"italic"}}>Select panels above to see available floors</div>
                )}
              </div>

              <Divider/>

              <div style={{padding:"0 18px"}}>
                <button onClick={applySelection} disabled={!canApply||loading}
                  style={{width:"100%",padding:"11px 0",borderRadius:28,background:canApply&&!loading?P:"#aab0ba",color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:canApply&&!loading?"pointer":"not-allowed",letterSpacing:"0.01em",boxShadow:canApply?"0 2px 8px rgba(39,67,101,0.3)":"none",transition:"all 0.15s"}}>
                  Generate Scon Input Loads
                </button>
              </div>

              <div style={{padding:"8px 18px 0"}}>
                <button onClick={()=>{ setFile(null); setFileKey(k=>k+1); setOptions(null); setResult(null); setShape(""); setSelectedStories([]); setPierSlots([]); setCurrentStoryIdx(0); setError(null); }}
                  style={{width:"100%",padding:"7px 0",borderRadius:28,background:"transparent",color:C.m,border:"1px solid "+C.b,fontSize:13,cursor:"pointer"}}>
                  Reset
                </button>
              </div>
            </>)}
          </>)}
        </div>

        {/* Main content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <div style={{flex:1,padding:24,overflowY:"auto",minWidth:0}}>
          {!file&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",flexDirection:"column",gap:16,color:C.m}}>
              <div style={{fontSize:52}}>📂</div>
              <div style={{fontSize:15,fontWeight:500}}>Upload an ETABS Pier Forces Excel file to get started</div>
              <div style={{fontSize:13}}>Use the panel on the left</div>
            </div>
          )}

          {result&&(<>
            <div style={{display:"flex",alignItems:"center",borderBottom:"2px solid "+C.b,marginBottom:16}}>
              {[{key:"table",label:"Scon Table"},{key:"graphs",label:"Graphs"},{key:"ai",label:"✦ AI Indicator"}].map(t=>(
                <button key={t.key} onClick={()=>{ setTab(t.key); if((t.key==="graphs"||t.key==="ai")&&!options?.overview_graphs) loadOverview(file); }}
                  style={{padding:"10px 22px",fontSize:14,fontWeight:tab===t.key?700:400,border:"none",background:"none",cursor:"pointer",borderBottom:tab===t.key?"2px solid "+P:"2px solid transparent",color:tab===t.key?P:C.m,marginBottom:-2,transition:"all 0.1s"}}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab==="table"&&(<>
              {storyOrder.length>1&&(
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:"#f0f4f8",borderRadius:8,border:"1px solid #dee2e6",marginBottom:10}}>
                  <button onClick={()=>setCurrentStoryIdx(i=>Math.max(0,i-1))} disabled={currentStoryIdx===0}
                    style={{width:28,height:28,borderRadius:5,border:"1px solid #dee2e6",background:currentStoryIdx===0?"#f1f3f5":"#fff",cursor:currentStoryIdx===0?"not-allowed":"pointer",color:currentStoryIdx===0?"#ced4da":"#495057",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>◁</button>
                  <span style={{fontSize:13,fontWeight:700,color:P,minWidth:90,textAlign:"center"}}>{currentStory}</span>
                  <span style={{fontSize:12,color:C.m}}>floor {currentStoryIdx+1} of {storyOrder.length}</span>
                  <button onClick={()=>setCurrentStoryIdx(i=>Math.min(storyOrder.length-1,i+1))} disabled={currentStoryIdx===storyOrder.length-1}
                    style={{width:28,height:28,borderRadius:5,border:"1px solid #dee2e6",background:currentStoryIdx===storyOrder.length-1?"#f1f3f5":"#fff",cursor:currentStoryIdx===storyOrder.length-1?"not-allowed":"pointer",color:currentStoryIdx===storyOrder.length-1?"#ced4da":"#495057",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>▷</button>
                  <span style={{fontSize:11,color:C.m,marginLeft:6}}>"Copy All Floors" copies all {storyOrder.length} floors at once</span>
                </div>
              )}
              <Table data={orientedTable}
                panelLabels={selectedPiers.map((_,i)=>effectivePierCount===1?"Panel":`Panel ${i+1}`)}
                orientation={orientation}
                onOrientationChange={isSectional?setOrientation:undefined}
                onCopyAll={storyOrder.length>1?copyAllStories:undefined}/>
            </>)}
            {tab==="graphs"&&(overviewLoading
              ?<div style={{display:"flex",alignItems:"center",gap:10,padding:40,color:C.m}}><div style={{width:16,height:16,border:"2px solid "+C.b,borderTop:"2px solid "+P,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Analysing full dataset for graphs…</div>
              :<OverviewGraphs graphs={options?.overview_graphs}/>)}
            {tab==="ai"&&(overviewLoading
              ?<div style={{display:"flex",alignItems:"center",gap:10,padding:40,color:C.m}}><div style={{width:16,height:16,border:"2px solid "+C.b,borderTop:"2px solid "+P,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Computing AI insights…</div>
              :<AIIndicatorTab graphs={options?.overview_graphs}/>)}
          </>)}
        </div>
        </div>
      </div>
    </>
  );
}
