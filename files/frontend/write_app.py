code = r'''import { useState, useCallback, useRef, useEffect } from "react";

const API_URL = "/api/upload/";
const EXPORT_URL = "/api/export/";
const C = { a:"#1a6ef5", bg:"#f7f8fa", card:"#ffffff", b:"#e3e6eb", t:"#1a1d23", m:"#6b7280", d:"#dc2626" };
const SHAPES = [
  { key:"C", label:"C Shape", piers:3, desc:"3 piers - 9 columns" },
  { key:"L", label:"L Shape", piers:2, desc:"2 piers - 6 columns" },
  { key:"I", label:"I Shape", piers:1, desc:"1 pier - 3 columns" },
];

function ct(cell) {
  if (cell === null || cell === undefined) return "--";
  if (typeof cell === "object") return JSON.stringify(cell);
  if (typeof cell === "number") return Number.isInteger(cell) ? cell : parseFloat(cell.toFixed(3));
  return String(cell);
}

function Spinner() {
  return <div style={{display:"flex",alignItems:"center",gap:10,color:C.m,fontSize:14,padding:"24px 0"}}><div style={{width:16,height:16,border:"2px solid "+C.b,borderTop:"2px solid "+C.a,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>Processing...</div>;
}

function Upload({ onFile }) {
  const ref = useRef();
  const [drag, setDrag] = useState(false);
  return (
    <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)onFile(f);}}
      onClick={()=>ref.current.click()}
      style={{border:"2px dashed "+(drag?C.a:C.b),borderRadius:10,padding:"48px 24px",textAlign:"center",cursor:"pointer",background:drag?"#1a6ef508":C.card,transition:"all 0.15s"}}>
      <input ref={ref} type="file" accept=".xlsx" style={{display:"none"}} onChange={e=>e.target.files[0]&&onFile(e.target.files[0])}/>
      <div style={{fontSize:36,marginBottom:12}}>📂</div>
      <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>Drop your Pier Forces Excel file here</div>
      <div style={{color:C.m,fontSize:13}}>or click to browse - .xlsx only (Pier Forces sheet)</div>
    </div>
  );
}

function ShapeSelector({ value, onChange }) {
  return (
    <div style={{marginBottom:24}}>
      <div style={{fontSize:12,fontWeight:500,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>1. Select pier shape</div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        {SHAPES.map(s=>(
          <div key={s.key} onClick={()=>onChange(s.key)}
            style={{flex:1,minWidth:120,padding:"16px 20px",borderRadius:8,border:"2px solid "+(value===s.key?C.a:C.b),
              background:value===s.key?"#1a6ef508":C.card,cursor:"pointer",transition:"all 0.15s",textAlign:"center"}}>
            <div style={{fontWeight:800,fontSize:24,color:value===s.key?C.a:C.t,marginBottom:4}}>{s.key}</div>
            <div style={{fontWeight:600,fontSize:13,color:C.t,marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:11,color:C.m}}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StorySelect({ options, value, onChange }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
      <label style={{fontSize:12,fontWeight:500,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em"}}>2. Story</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{padding:"8px 12px",borderRadius:6,border:"1px solid "+C.b,background:C.card,fontSize:14,color:C.t,outline:"none"}}>
        <option value="">-- select --</option>
        {options.map((o,i)=><option key={i} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function PierSelect({ options, value, onChange, required }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:180}}>
      <label style={{fontSize:12,fontWeight:500,color:C.m,textTransform:"uppercase",letterSpacing:"0.05em"}}>
        3. Select {required} pier{required>1?"s":""} <span style={{color:value.length===required?C.a:C.m}}>({value.length}/{required})</span>
      </label>
      <select multiple size={Math.min(options.length+1,8)} value={value}
        onChange={e=>onChange(Array.from(e.target.selectedOptions).map(o=>o.value))}
        style={{padding:"4px",borderRadius:6,border:"1px solid "+C.b,background:C.card,fontSize:13,color:C.t,outline:"none"}}>
        {options.map((o,i)=><option key={i} value={o}>{o}</option>)}
      </select>
      <div style={{fontSize:11,color:C.m}}>Hold Ctrl to select multiple</div>
    </div>
  );
}

function Table({ data }) {
  if (!data||!data.columns||!data.columns.length)
    return <div style={{color:C.m,padding:24,fontSize:14}}>Select shape, story and piers, then click Apply.</div>;
  const {columns,data:rows}=data;
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"monospace"}}>
        <thead><tr>{columns.map((c,i)=>(
          <th key={i} style={{padding:"8px 10px",background:C.bg,borderBottom:"2px solid "+C.b,textAlign:"left",fontWeight:600,fontSize:11,color:C.m,whiteSpace:"nowrap",position:"sticky",top:0}}>
            {String(c)}
          </th>
        ))}</tr></thead>
        <tbody>{rows.map((row,i)=>(
          <tr key={i} style={{background:i%2===0?C.card:C.bg}}>
            {(Array.isArray(row)?row:[row]).map((cell,j)=>(
              <td key={j} style={{padding:"6px 10px",borderBottom:"1px solid "+C.b,color:C.t,whiteSpace:"nowrap"}}>{ct(cell)}</td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function PlotlyChart({ graphData }) {
  const ref = useRef();
  useEffect(()=>{
    if(!ref.current||!graphData||!window.Plotly) return;
    try {
      window.Plotly.newPlot(ref.current, graphData.data||[], {
        ...(graphData.layout||{}),
        margin:{t:50,r:20,b:80,l:100},
        paper_bgcolor:"transparent",
        plot_bgcolor:"transparent",
        font:{family:"sans-serif",size:11},
        height:400,
        legend:{orientation:"h",y:-0.35},
      }, {responsive:true,displayModeBar:true,modeBarButtonsToRemove:["lasso2d","select2d"]});
    } catch(e){console.error(e);}
  },[graphData]);
  if(!graphData||!graphData.data||!graphData.data.length)
    return <div style={{color:C.m,fontSize:13,padding:16}}>No data</div>;
  return <div ref={ref} style={{width:"100%"}}/>;
}

function GraphCard({ title, graphData }) {
  return (
    <div style={{background:C.card,border:"1px solid "+C.b,borderRadius:10,padding:16,marginBottom:20}}>
      <div style={{fontWeight:600,fontSize:13,color:C.t,marginBottom:4}}>{title}</div>
      <PlotlyChart graphData={graphData}/>
    </div>
  );
}

function Graphs({ graphs }) {
  if(!graphs) return <div style={{color:C.m,padding:24}}>Select piers and click Apply to view graphs.</div>;
  return (
    <div>
      <GraphCard title="Axial Force P - Max per Story (Stacked by Pier)" graphData={graphs.p_stacked}/>
      <GraphCard title="Shear V2 - Max per Story (Grouped by Pier)" graphData={graphs.v2_grouped}/>
      <GraphCard title="Overturning Moment M3 - Max per Story (Grouped by Pier)" graphData={graphs.m3_grouped}/>
      <GraphCard title="Envelope - Max/Min Forces at Selected Story" graphData={graphs.envelope}/>
      <GraphCard title="Shear-Moment Interaction (V2 vs M3) at Selected Story" graphData={graphs.scatter_vm}/>
    </div>
  );
}

function DownloadButtons({ file, story, piers }) {
  const download = async(fmt) => {
    const form = new FormData();
    form.append("lateral_loads_file", file);
    form.append("story", story);
    form.append("piers", JSON.stringify(piers));
    form.append("format", fmt);
    try {
      const res = await fetch(EXPORT_URL, {method:"POST",body:form});
      if(!res.ok){alert("Export failed");return;}
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href=url;
      a.download=fmt==="csv"?"pier_forces_"+story+".csv":"pier_forces_"+story+".xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch(e){alert("Export error: "+e.message);}
  };
  return (
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <button onClick={()=>download("csv")} style={{padding:"7px 16px",borderRadius:6,border:"1px solid "+C.b,background:C.card,color:C.t,fontSize:13,cursor:"pointer"}}>
        Download CSV
      </button>
      <button onClick={()=>download("xlsx")} style={{padding:"7px 16px",borderRadius:6,border:"1px solid "+C.b,background:C.card,color:C.t,fontSize:13,cursor:"pointer"}}>
        Download Excel
      </button>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState(null);
  const [pierOptions, setPierOptions] = useState([]);
  const [shape, setShape] = useState("");
  const [story, setStory] = useState("");
  const [selectedPiers, setSelectedPiers] = useState([]);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("table");

  const requiredPiers = SHAPES.find(s=>s.key===shape)?.piers||0;

  const doUpload = useCallback(async(f, storyVal, piersVal) => {
    setLoading(true); setError(null);
    const form = new FormData();
    form.append("lateral_loads_file", f);
    if(storyVal) form.append("story", storyVal);
    if(piersVal&&piersVal.length) form.append("piers", JSON.stringify(piersVal));
    try {
      const res = await fetch(API_URL, {method:"POST",body:form});
      const json = await res.json();
      if(!res.ok) throw new Error(json.detail||"Error");
      return json;
    } catch(e) { setError(e.message); return null; }
    finally { setLoading(false); }
  }, []);

  const handleFile = useCallback(async f => {
    setFile(f); setOptions(null); setResult(null);
    setShape(""); setStory(""); setSelectedPiers([]);
    const json = await doUpload(f);
    if(json){ setOptions(json); setPierOptions(json.pier_options||[]); }
  }, [doUpload]);

  const handleStoryChange = useCallback(async s => {
    setStory(s); setSelectedPiers([]); setResult(null);
    if(!file||!s) return;
    const json = await doUpload(file, s);
    if(json) setPierOptions(json.pier_options||[]);
  }, [file, doUpload]);

  const handleApply = useCallback(async() => {
    if(!file||!story||selectedPiers.length!==requiredPiers) return;
    const json = await doUpload(file, story, selectedPiers);
    if(json) setResult(json);
  }, [file, story, selectedPiers, requiredPiers, doUpload]);

  const ts = a=>({padding:"8px 20px",fontSize:14,fontWeight:a?600:400,border:"none",background:"none",cursor:"pointer",borderBottom:a?"2px solid "+C.a:"2px solid transparent",color:a?C.a:C.m});
  const canApply = story&&selectedPiers.length===requiredPiers&&requiredPiers>0;

  return (
    <>
      <style>{"body{font-family:sans-serif;background:#f7f8fa;margin:0}@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
      <div style={{background:C.card,borderBottom:"1px solid "+C.b,padding:"0 32px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",height:56,gap:12}}>
          <span style={{fontWeight:700,fontSize:16}}>SCON</span>
          <span style={{fontSize:11,padding:"2px 8px",background:"#1a6ef518",color:C.a,borderRadius:4,border:"1px solid #1a6ef533"}}>Pier Forces</span>
          {file&&<span style={{fontSize:12,color:C.m,marginLeft:"auto"}}>{file.name}</span>}
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:32}}>
        {!file&&<Upload onFile={handleFile}/>}
        {error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"12px 16px",color:C.d,fontSize:14,marginTop:16}}>{error}</div>}
        {loading&&<Spinner/>}

        {options&&!loading&&(
          <>
            <ShapeSelector value={shape} onChange={s=>{setShape(s);setSelectedPiers([]);setResult(null);}}/>

            {shape&&(
              <div style={{display:"flex",gap:20,alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",background:C.card,padding:20,borderRadius:10,border:"1px solid "+C.b}}>
                <StorySelect options={options.story_options||[]} value={story} onChange={handleStoryChange}/>
                {story&&pierOptions.length>0&&(
                  <PierSelect options={pierOptions} value={selectedPiers} onChange={setSelectedPiers} required={requiredPiers}/>
                )}
                {story&&pierOptions.length===0&&(
                  <div style={{color:C.m,fontSize:13,paddingTop:20}}>No piers found for this story.</div>
                )}
                <div style={{display:"flex",flexDirection:"column",gap:8,justifyContent:"flex-end",paddingTop:20}}>
                  <button onClick={handleApply} disabled={!canApply}
                    style={{padding:"9px 24px",borderRadius:6,border:"none",background:canApply?C.a:"#ccc",color:"#fff",fontWeight:600,fontSize:14,cursor:canApply?"pointer":"not-allowed"}}>
                    Apply
                  </button>
                  <button onClick={()=>{setFile(null);setOptions(null);setResult(null);setPierOptions([]);setStory("");setShape("");setSelectedPiers([]);}}
                    style={{padding:"9px 16px",borderRadius:6,border:"1px solid "+C.b,background:C.card,color:C.m,fontSize:14,cursor:"pointer"}}>
                    Change file
                  </button>
                </div>
              </div>
            )}

            {result&&(
              <>
                <div style={{borderBottom:"1px solid "+C.b,marginBottom:16,display:"flex"}}>
                  <button style={ts(tab==="table")} onClick={()=>setTab("table")}>Table</button>
                  <button style={ts(tab==="graphs")} onClick={()=>setTab("graphs")}>Graphs</button>
                </div>
                {tab==="table"&&(
                  <>
                    <DownloadButtons file={file} story={story} piers={selectedPiers}/>
                    <Table data={result.table}/>
                  </>
                )}
                {tab==="graphs"&&<Graphs graphs={result.graphs}/>}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
'''

with open("src/App.jsx", "w", encoding="utf-8") as f:
    f.write(code)
print("Done")
