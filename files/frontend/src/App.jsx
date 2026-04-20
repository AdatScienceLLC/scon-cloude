import { useState, useCallback, useRef, useEffect } from "react";

const API_URL = "/api/upload/";
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

/* ── Table ─────────────────────────────────────────────── */
function Table({ data, onDownloadCSV, onDownloadXLSX }) {
  const [search, setSearch]       = useState("");
  const [sortCol, setSortCol]     = useState(null);
  const [sortDir, setSortDir]     = useState("asc");
  const [page, setPage]           = useState(1);
  const [rpp, setRpp]             = useState(1000);
  const [copied, setCopied]       = useState(false);
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
        <div>Select shape, story and piers, then click <b>Generate Scon Input Loads</b>.</div>
      </div>
    );

  const { piers, data:rows, units={} } = data;
  const allCases = [...new Set(rows.map(r => String(r[0])))];

  const toggleCase = c => setHiddenCases(prev => ({...prev, [c]: !prev[c]}));
  const showAll  = () => setHiddenCases({});
  const hideAll  = () => setHiddenCases(Object.fromEntries(allCases.map(c=>[c,true])));

  const colLabel = col => units[col] ? `${col} (${units[col]})` : col;

  const handleSort = i => {
    if (sortCol === i) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(i); setSortDir("asc"); }
  };
  const SortIco = ({i}) => sortCol!==i
    ? <span style={{opacity:0.25,fontSize:9,marginLeft:3}}>▲▼</span>
    : <span style={{fontSize:10,marginLeft:3,color:sortCol===0?"#fff":P}}>{sortDir==="asc"?"▲":"▼"}</span>;

  const q = search.trim().toLowerCase();
  let displayRows = rows.filter(r => !hiddenCases[String(r[0])]);
  if (q) displayRows = displayRows.filter(r => String(r[0]).toLowerCase().includes(q));
  if (sortCol !== null) {
    displayRows = [...displayRows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const total    = displayRows.length;
  const start    = (page - 1) * rpp;
  const pageRows = displayRows.slice(start, start + rpp);
  const numColor = v => typeof v === "number" && v < 0 ? "#dc2626" : "#1a1d23";
  const hiddenCount = Object.values(hiddenCases).filter(Boolean).length;

  const copyTable = () => {
    const text = displayRows.map(row => row.map(ct).join("\t")).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="scon-print-area" style={{background:"#fff",borderRadius:8,border:"1px solid #dee2e6",
      boxShadow:"0 1px 6px rgba(0,0,0,0.07)",overflow:"hidden"}}>

      {/* ── Toolbar ── */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",
        borderBottom:"1px solid #dee2e6",background:"#fff"}}>
        {/* Search */}
        <div style={{display:"flex",alignItems:"center",gap:6,flex:"0 0 200px",
          border:"1px solid #dee2e6",borderRadius:6,background:"#f8f9fa",padding:"6px 12px"}}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="#adb5bd" strokeWidth="2"/>
            <path d="M14 14l4 4" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input type="text" placeholder="Search output case…" value={search}
            onChange={e=>setSearch(e.target.value)}
            style={{flex:1,border:"none",outline:"none",fontSize:13,color:"#495057",
              background:"transparent"}} />
          {search&&<button onClick={()=>setSearch("")}
            style={{background:"none",border:"none",cursor:"pointer",color:"#adb5bd",
              fontSize:16,lineHeight:1,padding:0}}>×</button>}
        </div>

        {/* Filter cases */}
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
                <span style={{fontSize:12,fontWeight:700,color:P,textTransform:"uppercase",letterSpacing:"0.04em"}}>
                  Load Cases
                </span>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={showAll} style={{fontSize:11,color:"#16a34a",border:"none",background:"none",cursor:"pointer",fontWeight:600,padding:0}}>All</button>
                  <button onClick={hideAll} style={{fontSize:11,color:"#dc2626",border:"none",background:"none",cursor:"pointer",fontWeight:600,padding:0}}>None</button>
                </div>
              </div>
              <div style={{maxHeight:280,overflowY:"auto",padding:"6px 0"}}>
                {allCases.map(c=>(
                  <label key={c} style={{display:"flex",alignItems:"center",gap:8,
                    padding:"5px 14px",cursor:"pointer",fontSize:13,
                    background:hiddenCases[c]?"#fef2f2":"transparent",
                    color:hiddenCases[c]?"#9ca3af":C.t}}>
                    <input type="checkbox" checked={!hiddenCases[c]}
                      onChange={()=>toggleCase(c)}
                      style={{accentColor:P,cursor:"pointer",margin:0}} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{flex:1}} />

        {/* Row count */}
        <span style={{fontSize:12,color:"#6c757d",whiteSpace:"nowrap"}}>
          {total} row{total!==1?"s":""}
          {(search||hiddenCount>0)&&<span style={{color:P,fontWeight:600}}> · filtered</span>}
        </span>

        {/* Copy button */}
        <button onClick={copyTable} title="Copy data (no headers)"
          style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:32,
            border:"1px solid #dee2e6",borderRadius:5,background:copied?"#16a34a":"#fff",
            cursor:"pointer",color:copied?"#fff":"#495057",fontSize:13,fontWeight:500,
            transition:"all 0.2s",flexShrink:0}}>
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <path d="M4 10l5 5 7-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <rect x="7" y="7" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M14 7V5a1.5 1.5 0 00-1.5-1.5h-8A1.5 1.5 0 003 5v10a1.5 1.5 0 001.5 1.5H7" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              Copy
            </>
          )}
        </button>

        <div style={{width:1,height:22,background:"#dee2e6",flexShrink:0}} />

        {/* Download buttons */}
        {[
          { label:"CSV",   icon:"M4 4h8l4 4v10H4V4z M12 4v4h4 M8 12h6 M8 15h4", onClick: onDownloadCSV,   color:"#198754" },
          { label:"Excel", icon:"M4 4h8l4 4v10H4V4z M12 4v4h4 M7 11l4 4m0-4l-4 4", onClick: onDownloadXLSX, color:"#1d6f42" },
        ].map(({label,icon,onClick,color})=>(
          <button key={label} onClick={onClick}
            style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:32,
              border:`1px solid ${color}`,borderRadius:5,background:"#fff",
              cursor:"pointer",color:color,fontSize:13,fontWeight:600,flexShrink:0}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            </svg>
            {label}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 260px)"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:14,
          fontFamily:"'Century Gothic',CenturyGothic,AppleGothic,sans-serif"}}>
          <thead style={{position:"sticky",top:0,zIndex:10}}>
            {/* Row 1 — pier group names */}
            <tr style={{background:"#f1f3f5"}}>
              <th rowSpan={2} onClick={()=>handleSort(0)}
                style={{padding:"10px 16px",textAlign:"center",fontWeight:700,fontSize:13,
                  whiteSpace:"nowrap",verticalAlign:"middle",
                  borderRight:"2px solid #dee2e6",borderBottom:"1px solid #dee2e6",
                  cursor:"pointer",userSelect:"none",minWidth:170,background:P,color:"#fff",
                  position:"sticky",top:0,zIndex:11}}>
                Output Case <SortIco i={0}/>
              </th>
              {piers.map((p,i)=>(
                <th key={i} colSpan={3}
                  style={{padding:"10px 16px",textAlign:"center",fontWeight:700,fontSize:14,
                    color:P,whiteSpace:"nowrap",background:"#f1f3f5",
                    borderLeft:"2px solid #dee2e6",borderBottom:"1px solid #ced4da",
                    letterSpacing:"0.01em"}}>
                  {p}
                </th>
              ))}
            </tr>
            {/* Row 2 — column labels with units */}
            <tr style={{background:"#f8f9fa"}}>
              {piers.flatMap((_,i)=>
                ["P","V2","M3"].map((col,j)=>{
                  const ci = 1+i*3+j;
                  return (
                    <th key={`${i}-${col}`} onClick={()=>handleSort(ci)}
                      style={{padding:"8px 16px",textAlign:"right",fontWeight:600,
                        fontSize:12,color:sortCol===ci?P:"#495057",whiteSpace:"nowrap",
                        background:"#f8f9fa",
                        borderLeft:col==="P"?"2px solid #dee2e6":"none",
                        borderBottom:"2px solid #ced4da",
                        cursor:"pointer",userSelect:"none"}}>
                      {colLabel(col)} <SortIco i={ci}/>
                    </th>
                  );
                })
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row,ri)=>(
              <tr key={ri}
                style={{background:ri%2===0?"#fff":"#f8f9fa"}}
                onMouseEnter={e=>e.currentTarget.style.background="#e8f0fe"}
                onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?"#fff":"#f8f9fa"}>
                {row.map((cell,j)=>(
                  <td key={j} style={{
                    padding:"10px 16px",
                    borderBottom:"1px solid #e9ecef",
                    borderLeft:j>0&&(j-1)%3===0?"2px solid #dee2e6":"none",
                    color:j===0?"#343a40":numColor(cell),
                    whiteSpace:"nowrap",textAlign:j===0?"center":"right",
                    fontWeight:j===0?600:400,fontSize:14,
                  }}>
                    {ct(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length===0&&(
              <tr><td colSpan={1+piers.length*3}
                style={{padding:"36px",textAlign:"center",color:"#adb5bd",fontSize:14}}>
                No matching rows
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:12,
        padding:"10px 16px",borderTop:"1px solid #dee2e6",background:"#f8f9fa",
        fontSize:13,color:"#6c757d"}}>
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
            color:page===1?"#ced4da":"#495057",fontSize:14,display:"flex",
            alignItems:"center",justifyContent:"center"}}>◁</button>
        <button onClick={()=>setPage(p=>p+1)} disabled={start+rpp>=total}
          style={{width:28,height:28,borderRadius:5,border:"1px solid #dee2e6",
            background:start+rpp>=total?"#f1f3f5":"#fff",
            cursor:start+rpp>=total?"not-allowed":"pointer",
            color:start+rpp>=total?"#ced4da":"#495057",fontSize:14,display:"flex",
            alignItems:"center",justifyContent:"center"}}>▷</button>
      </div>
    </div>
  );
}

/* ── Charts ─────────────────────────────────────────────── */
const BASE_LAYOUT = {
  paper_bgcolor:"transparent", plot_bgcolor:"transparent",
  font:{family:"sans-serif",size:11}, showlegend:true,
};

function PlotlyChart({ traces, layout }) {
  const ref = useRef();
  useEffect(()=>{
    if(!ref.current || !traces || !traces.length) return;
    function render() {
      try { window.Plotly.newPlot(ref.current, traces, {...BASE_LAYOUT,...layout}, {responsive:true,displayModeBar:false}); }
      catch(e){ console.error(e); }
    }
    if(window.Plotly){ render(); return; }
    const id = setInterval(()=>{ if(window.Plotly){ clearInterval(id); render(); } }, 100);
    return ()=>clearInterval(id);
  }, [traces]);
  if(!traces||!traces.length) return <div style={{color:C.m,fontSize:13,padding:16}}>No data</div>;
  return <div ref={ref} style={{width:"100%"}} />;
}

const CARD = {background:C.card,border:"1px solid "+C.b,borderRadius:10,padding:16};
const STORY_LINE_LAYOUT = (xTitle, storyCount) => ({
  height: Math.max(480, storyCount*28+120),
  margin:{t:20,r:30,b:60,l:110},
  xaxis:{title:xTitle,automargin:true,zeroline:true,zerolinecolor:"#e3e6eb"},
  yaxis:{title:"Story",type:"category",automargin:true,tickfont:{size:11}},
  legend:{orientation:"h",y:-0.12,xanchor:"center",x:0.5},
  hovermode:"y unified",
});

function SectionTitle({ children }) {
  return <div style={{fontWeight:700,fontSize:15,color:C.t,marginBottom:16,paddingBottom:8,borderBottom:"2px solid "+C.b}}>{children}</div>;
}
function ChartCard({ title, children }) {
  return (
    <div style={CARD}>
      <div style={{fontWeight:600,fontSize:12,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:12}}>{title}</div>
      {children}
    </div>
  );
}

const PALETTE = ["#274365","#ef4444","#f59e0b","#10b981","#8b5cf6","#3b82f6","#ec4899","#14b8a6","#f97316","#6366f1"];

function StoryFilter({ value, onChange, storyList, label="Filter by story" }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <label style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",whiteSpace:"nowrap"}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{padding:"5px 10px",borderRadius:6,border:"1px solid "+C.b,background:C.card,
          fontSize:13,color:C.t,outline:"none",minWidth:140}}>
        <option value="">All Stories</option>
        {storyList.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

function PierShareCard({ graphs }) {
  const [pieStory, setPieStory] = useState("");
  const storyList = Object.keys(graphs.pier_share_by_story||{});
  const traces = pieStory ? (graphs.pier_share_by_story?.[pieStory]||graphs.pier_share) : graphs.pier_share;
  return (
    <ChartCard title={`V2 Pier Share — ${pieStory||"All Stories"}`}>
      <StoryFilter value={pieStory} onChange={setPieStory} storyList={storyList} />
      <PlotlyChart traces={traces} layout={{height:320,margin:{t:10,r:100,b:30,l:100},
        legend:{orientation:"h",y:-0.1,xanchor:"center",x:0.5}}} />
    </ChartCard>
  );
}

function ForcePieBarCard({ title, forceKey, forceDist, yLabel }) {
  const [selStory, setSelStory] = useState("");
  const storyList = forceDist?.stories?.length
    ? forceDist.stories
    : Object.keys(forceDist?.by_story || {});
  const src = selStory ? (forceDist?.by_story?.[selStory]?.[forceKey]) : forceDist?.[forceKey];
  const pieTraces = src?.pie || [];
  const gov = src?.governing || {};
  const isP = !!gov.max_cases;
  const tickAngle = (gov.piers||[]).length > 7 ? -45 : 0;

  let barTraces, uniqueCases, caseColor;
  if (isP) {
    const allCases = [...new Set([...(gov.max_cases||[]), ...(gov.min_cases||[])])];
    caseColor = Object.fromEntries(allCases.map((c,i)=>[c, PALETTE[i%PALETTE.length]]));
    uniqueCases = allCases;
    barTraces = [
      {
        name:"Max P (Tension)", type:"bar", x:gov.piers||[], y:gov.max_values||[],
        text:gov.max_cases||[], textposition:"outside",
        marker:{color:(gov.max_cases||[]).map(c=>caseColor[c])},
        hovertemplate:"<b>%{x}</b><br>Max P: %{y} kip<br>Case: %{text}<extra></extra>",
      },
      {
        name:"Min P (Compression)", type:"bar", x:gov.piers||[], y:gov.min_values||[],
        text:gov.min_cases||[], textposition:"outside",
        marker:{color:(gov.min_cases||[]).map(c=>caseColor[c]), opacity:0.65},
        hovertemplate:"<b>%{x}</b><br>Min P: %{y} kip<br>Case: %{text}<extra></extra>",
      },
    ];
  } else {
    uniqueCases = [...new Set(gov.cases||[])];
    caseColor = Object.fromEntries(uniqueCases.map((c,i)=>[c, PALETTE[i%PALETTE.length]]));
    barTraces = [{
      type:"bar", x:gov.piers||[], y:gov.values||[],
      text:gov.cases||[], textposition:"outside",
      marker:{color:(gov.cases||[]).map(c=>caseColor[c])},
      hovertemplate:"<b>%{x}</b><br>"+yLabel+": %{y}<br>Case: %{text}<extra></extra>",
    }];
  }

  return (
    <div style={{...CARD}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:14,paddingBottom:8,borderBottom:"1px solid "+C.b}}>
        <div style={{fontWeight:700,fontSize:13,color:C.t}}>{title}</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <label style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",
            letterSpacing:"0.05em",whiteSpace:"nowrap"}}>Story</label>
          <select value={selStory} onChange={e=>setSelStory(e.target.value)}
            style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+C.b,
              background:"#fff",fontSize:12,color:C.t,outline:"none",minWidth:130}}>
            <option value="">All Stories</option>
            {storyList.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",
            letterSpacing:"0.05em",marginBottom:8}}>Pier Share</div>
          <PlotlyChart traces={pieTraces} layout={{height:280,
            margin:{t:10,r:80,b:30,l:80},
            legend:{orientation:"h",y:-0.1,xanchor:"center",x:0.5}}} />
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",
            letterSpacing:"0.05em",marginBottom:8}}>
            {isP ? "Max (Tension) & Min (Compression) — Governing Case" : "Max Value & Governing Case"}
          </div>
          <PlotlyChart traces={barTraces} layout={{
            height:280, showlegend:isP, barmode:"group",
            margin:{t:30,r:10,b:tickAngle?80:55,l:65},
            xaxis:{title:"Pier",tickangle:tickAngle,automargin:true},
            yaxis:{title:yLabel,automargin:true},
            legend:{orientation:"h",y:-0.25,xanchor:"center",x:0.5},
          }} />
          <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",marginTop:8}}>
            {uniqueCases.map(c=>(
              <div key={c} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.t}}>
                <div style={{width:10,height:10,borderRadius:2,background:caseColor[c],flexShrink:0}}/>
                {c}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EnvelopeCard({ graphs }) {
  const [envStory, setEnvStory] = useState("");
  const env = graphs.envelope||{};
  const storyList = Object.keys(env.by_story||{});
  const d = envStory ? (env.by_story?.[envStory]||env) : env;
  const pierCount = (d.piers||[]).length;
  const tickAngle = pierCount>8 ? -45 : 0;
  const bH = Math.max(240, pierCount*20+80);
  const barLayout = (yTitle) => ({
    height:bH, margin:{t:10,r:20,b:tickAngle?90:55,l:70},
    xaxis:{title:"Pier",automargin:true,tickangle:tickAngle},
    yaxis:{title:yTitle,automargin:true}, showlegend:false,
  });
  const mkTrace = (key,label,color)=>[{name:label,x:d.piers||[],y:d[key]||[],type:"bar",marker:{color}}];
  const pTraces = [
    {name:"Max P",x:d.piers||[],y:d.p_max||[],type:"bar",marker:{color:"#10b981"}},
    {name:"Min P",x:d.piers||[],y:d.p_min||[],type:"bar",marker:{color:"#f59e0b"}},
  ];
  const pLayout = {...barLayout("P (kip)"),barmode:"group",showlegend:true,
    legend:{orientation:"h",y:-0.25,xanchor:"center",x:0.5},
    margin:{...barLayout("P (kip)").margin,b:tickAngle?110:75}};
  return (
    <ChartCard title={`Pier Demand Envelope — ${envStory||"All Stories"}`}>
      <StoryFilter value={envStory} onChange={setEnvStory} storyList={storyList} />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Axial P — Max &amp; Min (kip)</div>
          <PlotlyChart traces={pTraces} layout={pLayout} />
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Shear V2 (kip)</div>
          <PlotlyChart traces={mkTrace("v2","V2","#274365")} layout={barLayout("V2 (kip)")} />
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Moment M3 (kip-ft)</div>
          <PlotlyChart traces={mkTrace("m3","M3","#ef4444")} layout={{...barLayout("M3 (kip-ft)"),height:Math.max(200,pierCount*16+70)}} />
        </div>
      </div>
    </ChartCard>
  );
}

function PMScatterCard({ graphs }) {
  const traces = graphs.pm_scatter||[];
  return (
    <ChartCard title="P–M Interaction — Axial Force vs Moment (All Load Cases)">
      <PlotlyChart traces={traces} layout={{
        height:400, hovermode:"closest",
        margin:{t:20,r:30,b:70,l:80},
        xaxis:{title:"M3 (kip-ft)",zeroline:true,zerolinecolor:"#e3e6eb",zerolinewidth:1.5},
        yaxis:{title:"P (kip)",zeroline:true,zerolinecolor:"#e3e6eb",zerolinewidth:1.5},
        legend:{orientation:"h",y:-0.18,xanchor:"center",x:0.5},
      }} />
      <div style={{fontSize:11,color:C.m,marginTop:6}}>Each dot = one load case. Hover to see case name.</div>
    </ChartCard>
  );
}

function ProfileCard({ title, traces, xTitle }) {
  const allStories = traces?.[0]?.y || [];
  const [fromStory, setFromStory] = useState("");
  const [toStory,   setToStory]   = useState("");

  const iFrom = fromStory ? allStories.indexOf(fromStory) : 0;
  const iTo   = toStory   ? allStories.indexOf(toStory)   : allStories.length - 1;
  const lo = Math.min(iFrom, iTo);
  const hi = Math.max(iFrom, iTo);

  const filtered = (traces||[]).map(tr => ({
    ...tr,
    x: tr.x.slice(lo, hi+1),
    y: tr.y.slice(lo, hi+1),
  }));

  const storyCount = hi - lo + 1;
  const layout = {
    height: Math.max(360, storyCount*22+100),
    paper_bgcolor:"transparent", plot_bgcolor:"transparent",
    font:{family:"sans-serif",size:10},
    margin:{t:10,r:10,b:50,l:90},
    xaxis:{title:xTitle,automargin:true,zeroline:true,zerolinecolor:"#e3e6eb"},
    yaxis:{title:"Story",type:"category",automargin:true,tickfont:{size:10}},
    legend:{orientation:"h",y:-0.14,xanchor:"center",x:0.5},
    hovermode:"y unified",
  };

  return (
    <ChartCard title={title}>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        {[
          {label:"From", val:fromStory, set:setFromStory},
          {label:"To",   val:toStory,   set:setToStory},
        ].map(({label,val,set})=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:11,fontWeight:600,color:C.m,textTransform:"uppercase",
              letterSpacing:"0.05em"}}>{label}</span>
            <select value={val} onChange={e=>set(e.target.value)}
              style={{padding:"3px 7px",borderRadius:5,border:"1px solid "+C.b,
                fontSize:12,color:C.t,background:"#fff",outline:"none",minWidth:110}}>
              <option value="">{label==="From"?"Bottom":"Top"}</option>
              {allStories.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
        {(fromStory||toStory)&&(
          <button onClick={()=>{setFromStory("");setToStory("");}}
            style={{fontSize:11,color:C.d,border:"none",background:"none",cursor:"pointer",padding:0}}>
            Clear
          </button>
        )}
      </div>
      <PlotlyChart traces={filtered} layout={layout} />
    </ChartCard>
  );
}

function OverviewGraphs({ graphs }) {
  if(!graphs) return null;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* Section 1 — Pier Demand */}
      <SectionTitle>Pier Demand — Distribution &amp; Governing Load Case</SectionTitle>
      <ForcePieBarCard title="Shear Force V2"        forceKey="v2" forceDist={graphs.force_dist} yLabel="Max |V2| (kip)" />
      <ForcePieBarCard title="Overturning Moment M3"  forceKey="m3" forceDist={graphs.force_dist} yLabel="Max |M3| (kip-ft)" />
      <ForcePieBarCard title="Axial Force P"           forceKey="p"  forceDist={graphs.force_dist} yLabel="Max |P| (kip)" />

      {/* Section 2 — P-M Interaction */}
      <SectionTitle>P–M Interaction</SectionTitle>
      <PMScatterCard graphs={graphs} />

      {/* Section 3 — Story Profiles */}
      <SectionTitle>Story Force Profiles</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        <ProfileCard title="Shear V2 by Story"    traces={graphs.v2_profile} xTitle="Max |V2| (kip)" />
        <ProfileCard title="Moment M3 by Story"   traces={graphs.m3_profile} xTitle="Max |M3| (kip-ft)" />
        <ProfileCard title="Axial Force P by Story" traces={graphs.p_profile} xTitle="Max |P| (kip)" />
      </div>

    </div>
  );
}

/* ── Sidebar helpers ────────────────────────────────────── */
function SbLabel({ children }) {
  return <div style={{fontSize:14,fontWeight:600,color:P,marginBottom:6}}>{children}</div>;
}
function Divider() {
  return <div style={{borderTop:"1px solid "+C.b,margin:"14px 0"}} />;
}

/* ── App ────────────────────────────────────────────────── */
export default function App() {
  const [projName, setProjName] = useState("");
  const [engineer, setEngineer] = useState("");
  const today = new Date().toLocaleDateString();

  const [file, setFile]           = useState(null);
  const [fileKey, setFileKey]     = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [options, setOptions]     = useState(null);
  const [result, setResult]       = useState(null);

  const [shape, setShape]               = useState("");
  const [story, setStory]               = useState("");
  const [selectedPiers, setSelectedPiers] = useState([]);
  const [tab, setTab]                   = useState("table");
  const [helpOpen, setHelpOpen]         = useState(false);

  const requiredPiers = SHAPES.find(s=>s.key===shape)?.piers||0;
  const pierOpts = story ? (options?.story_piers?.[story]||[]) : (options?.pier_options||[]);
  const canApply = story && requiredPiers>0 && selectedPiers.length===requiredPiers;

  useEffect(()=>{
    if(window.Plotly) return;
    const s = document.createElement("script");
    s.src = "https://cdn.plot.ly/plotly-2.27.0.min.js";
    s.async = true;
    document.head.appendChild(s);
  },[]);

  const uploadFile = useCallback(async f=>{
    setLoading(true); setError(null);
    const form = new FormData();
    form.append("lateral_loads_file",f);
    try {
      const res = await fetch(API_URL,{method:"POST",body:form});
      const json = await res.json();
      if(!res.ok) throw new Error(json.detail||"Upload failed");
      setOptions(json);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  },[]);

  const applySelection = useCallback(async()=>{
    if(!canApply||!file) return;
    setLoading(true); setError(null);
    const form = new FormData();
    form.append("lateral_loads_file",file);
    form.append("story",story);
    form.append("piers",JSON.stringify(selectedPiers));
    try {
      const res = await fetch(API_URL,{method:"POST",body:form});
      const json = await res.json();
      if(!res.ok) throw new Error(json.detail||"Error");
      setResult(json); setTab("table");
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  },[canApply,file,story,selectedPiers]);

  const handleFile = useCallback(f=>{
    setFile(f); setOptions(null); setResult(null);
    setShape(""); setStory(""); setSelectedPiers([]);
    uploadFile(f);
  },[uploadFile]);

  const handleShapeChange = s=>{
    setShape(s); setSelectedPiers([]); setResult(null);
  };
  const handleStoryChange = s=>{
    setStory(s); setSelectedPiers([]); setResult(null);
  };

  const download = useCallback(async fmt=>{
    if(!file||!story||!selectedPiers.length) return;
    const form = new FormData();
    form.append("lateral_loads_file",file);
    form.append("story",story);
    form.append("piers",JSON.stringify(selectedPiers));
    form.append("format",fmt);
    try {
      const res = await fetch("/api/export/",{method:"POST",body:form});
      if(!res.ok){ const j=await res.json(); setError(j.detail||"Export failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href=url; a.download=`pier_forces_${story}.${fmt==="csv"?"csv":"xlsx"}`; a.click();
      URL.revokeObjectURL(url);
    } catch(e){ setError(e.message); }
  },[file,story,selectedPiers]);

  const infoInput = {
    border:"none", borderBottom:"1px solid #ccc", padding:"3px 4px",
    fontSize:13, color:C.t, background:"transparent", outline:"none", width:"100%",
  };

  return (
    <>
      <style>{`
        *{box-sizing:border-box}
        body{font-family:'Century Gothic',CenturyGothic,AppleGothic,sans-serif;background:${C.bg};margin:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:#b0bac6;border-radius:3px}
        @media print{
          body>*{display:none!important}
          .scon-print-area{display:block!important;border:none!important;box-shadow:none!important}
          .scon-print-area button,.scon-print-area input,.scon-print-area select{display:none!important}
          .scon-print-area thead tr:first-child th:first-child,.scon-print-area thead tr:last-child th{font-size:11px}
          .scon-print-area td,.scon-print-area th{padding:6px 10px!important;font-size:11px!important}
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{height:80,background:P,display:"flex",alignItems:"center",
        justifyContent:"space-between",padding:"0 28px",position:"sticky",top:0,zIndex:100,
        boxShadow:"0 2px 8px rgba(0,0,0,0.18)"}}>
        <div />
        <div style={{position:"relative"}} onMouseEnter={()=>setHelpOpen(true)} onMouseLeave={()=>setHelpOpen(false)}>
          <span style={{color:"#fff",cursor:"default",fontSize:15,fontWeight:500,letterSpacing:"0.03em"}}>
            Help
          </span>
          {helpOpen&&(
            <div style={{position:"absolute",right:0,top:40,width:360,background:"#fff",
              border:"1px solid "+C.b,borderRadius:8,boxShadow:"0 6px 20px rgba(0,0,0,0.15)",
              padding:16,fontSize:13,color:P,zIndex:300}}>
              <div style={{position:"absolute",right:12,top:-8,width:14,height:14,
                background:"#fff",border:"1px solid "+C.b,transform:"rotate(45deg)",
                borderBottom:"none",borderRight:"none"}} />
              <ul style={{margin:0,paddingLeft:20,lineHeight:2.2,color:P,fontWeight:500}}>
                <li>Compatible with ETABS Pier Forces export (.xlsx)</li>
                <li>Database Units should be Kip – Ft</li>
                <li>Select story, shape and piers, then click <b>Generate Scon Input Loads</b></li>
                <li>
                  Download sample file:&nbsp;
                  <a href="/static/sample_pier_forces.xlsx" download
                    style={{color:P,fontWeight:700}}>
                    Click to Download
                  </a>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{display:"flex",minHeight:"calc(100vh - 80px)",width:"100vw"}}>

        {/* ── Sidebar ── */}
        <div style={{width:265,background:C.card,borderRight:"1px solid "+C.b,
          padding:"20px 0",overflowY:"auto",flexShrink:0,
          boxShadow:"3px 0 8px rgba(0,0,0,0.06)"}}>

          <div style={{textAlign:"center",fontWeight:700,fontSize:22,color:P,marginBottom:20,
            letterSpacing:"-0.01em"}}>
            ETABS PIER VIEWER
          </div>

          {/* Project info */}
          <div style={{padding:"0 18px"}}>
            {[
              {label:"Project Name:", val:projName, set:setProjName, ph:"Enter Project Name"},
              {label:"Engineer:",     val:engineer, set:setEngineer, ph:"Enter Engineer Name"},
            ].map(({label,val,set,ph})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:600,color:P,minWidth:95,flexShrink:0}}>{label}</span>
                <input value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                  style={{...infoInput,fontSize:12}} />
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:600,color:P,minWidth:95,flexShrink:0}}>Date:</span>
              <input value={today} disabled style={{...infoInput,color:C.m,fontSize:12}} />
            </div>
          </div>

          <Divider/>

          {/* File upload */}
          <div style={{padding:"0 18px",marginBottom:4}}>
            <SbLabel>Upload Pier Forces from ETABS</SbLabel>
            <input key={fileKey} type="file" accept=".xlsx"
              onChange={e=>{if(e.target.files[0]) handleFile(e.target.files[0]);}}
              style={{fontSize:12,width:"100%",cursor:"pointer"}} />
          </div>

          {loading&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",color:C.m,fontSize:12}}>
              <div style={{width:13,height:13,border:"2px solid "+C.b,borderTop:"2px solid "+P,
                borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}} />
              Processing…
            </div>
          )}
          {error&&(
            <div style={{margin:"8px 18px",background:"#fef2f2",border:"1px solid #fca5a5",
              borderRadius:6,padding:"8px 10px",color:C.d,fontSize:12}}>
              {error}
            </div>
          )}

          {options&&!loading&&(
            <>
              <Divider/>

              {/* Select Story */}
              <div style={{padding:"0 18px",marginBottom:4}}>
                <SbLabel>Select Story</SbLabel>
                <div style={{height:200,overflowY:"auto",border:"1px solid "+C.b,borderRadius:4,background:C.card}}>
                  {(options.story_options||[]).map(s=>(
                    <label key={s} style={{display:"flex",alignItems:"center",gap:8,
                      padding:"4px 10px",cursor:"pointer",fontSize:13,
                      background:story===s?"#27436514":"transparent",
                      color:story===s?P:C.t}}>
                      <input type="checkbox" checked={story===s}
                        onChange={()=>handleStoryChange(story===s?"":s)}
                        style={{accentColor:P,cursor:"pointer",margin:0}} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <Divider/>

              {/* Select Wall Shape */}
              <div style={{padding:"0 18px",marginBottom:4}}>
                <SbLabel>Select Wall Shape</SbLabel>
                <div style={{display:"flex",gap:4}}>
                  {SHAPES.map(s=>(
                    <button key={s.key} onClick={()=>handleShapeChange(s.key)}
                      style={{flex:1,padding:"7px 0",border:"1px solid "+(shape===s.key?P:C.b),
                        borderRadius:4,background:shape===s.key?P:C.card,
                        color:shape===s.key?"#fff":C.t,fontSize:14,fontWeight:700,cursor:"pointer",
                        transition:"all 0.1s"}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pier multi-select */}
              {shape&&requiredPiers>0&&(
                <>
                  <Divider/>
                  <div style={{padding:"0 18px"}}>
                    <SbLabel>Select Piers — {shape} shape</SbLabel>
                    <div style={{height:200,overflowY:"auto",border:"1px solid "+
                      (selectedPiers.length===requiredPiers?"#16a34a":C.b),
                      borderRadius:4,background:C.card}}>
                      {pierOpts.map(p=>{
                        const checked = selectedPiers.includes(p);
                        const atMax = selectedPiers.length===requiredPiers && !checked;
                        return (
                          <label key={p} style={{display:"flex",alignItems:"center",gap:8,
                            padding:"4px 10px",cursor:atMax?"not-allowed":"pointer",fontSize:13,
                            background:checked?"#27436514":"transparent",
                            color:atMax?C.m:checked?P:C.t,opacity:atMax?0.5:1}}>
                            <input type="checkbox" checked={checked} disabled={atMax}
                              onChange={()=>{
                                if(checked) setSelectedPiers(selectedPiers.filter(x=>x!==p));
                                else if(!atMax) setSelectedPiers([...selectedPiers, p]);
                              }}
                              style={{accentColor:P,cursor:atMax?"not-allowed":"pointer",margin:0}} />
                            {p}
                          </label>
                        );
                      })}
                    </div>
                    <div style={{fontSize:11,marginTop:5,
                      color:selectedPiers.length===requiredPiers?"#16a34a":C.m}}>
                      {selectedPiers.length}/{requiredPiers} selected
                      {selectedPiers.length<requiredPiers
                        ? ` — select ${requiredPiers - selectedPiers.length} more`
                        : " ✓ ready"}
                    </div>
                  </div>

                  <Divider/>

                  {/* Load Combinations button */}
                  <div style={{padding:"0 18px"}}>
                    <button onClick={applySelection} disabled={!canApply||loading}
                      style={{width:"100%",padding:"11px 0",borderRadius:28,
                        background:canApply&&!loading?P:"#aab0ba",
                        color:"#fff",border:"none",fontSize:15,fontWeight:700,
                        cursor:canApply&&!loading?"pointer":"not-allowed",
                        letterSpacing:"0.01em",boxShadow:canApply?"0 2px 8px rgba(39,67,101,0.3)":"none",
                        transition:"all 0.15s"}}>
                      Generate Scon Input Loads
                    </button>
                  </div>

                  {/* Reset */}
                  <div style={{padding:"8px 18px 0"}}>
                    <button onClick={()=>{
                        setFile(null); setFileKey(k=>k+1);
                        setOptions(null); setResult(null);
                        setShape(""); setStory(""); setSelectedPiers([]);
                        setError(null);
                      }}
                      style={{width:"100%",padding:"7px 0",borderRadius:28,
                        background:"transparent",color:C.m,border:"1px solid "+C.b,
                        fontSize:13,cursor:"pointer"}}>
                      Reset
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Main content ── */}
        <div style={{flex:1,padding:24,overflowY:"auto",minWidth:0}}>
          {!file&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",
              height:"60vh",flexDirection:"column",gap:16,color:C.m}}>
              <div style={{fontSize:52}}>📂</div>
              <div style={{fontSize:15,fontWeight:500}}>Upload an ETABS Pier Forces Excel file to get started</div>
              <div style={{fontSize:13}}>Use the panel on the left</div>
            </div>
          )}

          {result&&(
            <>
              {/* Tab bar */}
              <div style={{display:"flex",alignItems:"center",borderBottom:"2px solid "+C.b,marginBottom:16}}>
                {[{key:"table",label:"Scon Table"},{key:"graphs",label:"Graphs"}].map(t=>(
                  <button key={t.key} onClick={()=>setTab(t.key)}
                    style={{padding:"10px 22px",fontSize:14,fontWeight:tab===t.key?700:400,
                      border:"none",background:"none",cursor:"pointer",
                      borderBottom:tab===t.key?"2px solid "+P:"2px solid transparent",
                      color:tab===t.key?P:C.m,marginBottom:-2,transition:"all 0.1s"}}>
                    {t.label}
                  </button>
                ))}
              </div>

              {tab==="table"&&<Table data={result.table}
                onDownloadCSV={()=>download("csv")}
                onDownloadXLSX={()=>download("xlsx")} />}
              {tab==="graphs"&&<OverviewGraphs graphs={options.overview_graphs} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
