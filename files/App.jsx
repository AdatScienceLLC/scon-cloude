import { useState, useCallback, useRef } from "react";

const API_URL = "/api/upload/";

const COLORS = {
  accent: "#1a6ef5",
  bg: "#f7f8fa",
  card: "#ffffff",
  border: "#e3e6eb",
  text: "#1a1d23",
  muted: "#6b7280",
  danger: "#dc2626",
  success: "#16a34a",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', sans-serif; background: ${COLORS.bg}; color: ${COLORS.text}; min-height: 100vh; }
  button { font-family: inherit; cursor: pointer; }
  input { font-family: inherit; }
`;

function Badge({ children, color = COLORS.accent }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 500,
      padding: "2px 8px", borderRadius: 4,
      background: color + "18", color, border: `1px solid ${color}33`,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>{children}</span>
  );
}

function Select({ label, options, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: "8px 12px", borderRadius: 6, border: `1px solid ${COLORS.border}`,
          background: COLORS.card, fontSize: 14, color: COLORS.text, outline: "none",
        }}
      >
        <option value="">— select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function UploadZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      style={{
        border: `2px dashed ${dragging ? COLORS.accent : COLORS.border}`,
        borderRadius: 10, padding: "48px 24px", textAlign: "center",
        cursor: "pointer", background: dragging ? COLORS.accent + "08" : COLORS.card,
        transition: "all 0.15s",
      }}
    >
      <input ref={inputRef} type="file" accept=".xlsx" style={{ display: "none" }}
        onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
      <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Drop your Lateral Loads file here</div>
      <div style={{ color: COLORS.muted, fontSize: 13 }}>or click to browse — <Badge>.xlsx only</Badge></div>
    </div>
  );
}

function Table({ data }) {
  if (!data) return <div style={{ color: COLORS.muted, padding: 24 }}>Select a pier and story to view the table.</div>;
  const { columns, child_header, data: rows } = data;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{ padding: "6px 10px", background: COLORS.bg, borderBottom: `2px solid ${COLORS.border}`, textAlign: "left", fontWeight: 600, fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
          </tr>
          <tr>
            {child_header.map((c, i) => (
              <th key={i} style={{ padding: "4px 10px", background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, textAlign: "left", fontWeight: 500, fontSize: 12, color: COLORS.text }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? COLORS.card : COLORS.bg }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "6px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text }}>
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GraphPanel({ graphs }) {
  if (!graphs) return <div style={{ color: COLORS.muted, padding: 24 }}>Upload a file to view graphs.</div>;

  const graphKeys = [
    { key: "cum_dl", label: "Cumulative DL" },
    { key: "cum_ll", label: "Cumulative LL" },
    { key: "p", label: "Axial Force (P)" },
    { key: "v", label: "Shear (V)" },
    { key: "m", label: "Moment (M)" },
    { key: "bubble", label: "Bubble Chart" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      {graphKeys.map(({ key, label }) => (
        <div key={key} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: COLORS.text }}>{label}</div>
          <PlotlyChart data={graphs[key]} />
        </div>
      ))}
    </div>
  );
}

function PlotlyChart({ data }) {
  const ref = useRef();

  useState(() => {
    if (!data || !window.Plotly) return;
    window.Plotly.newPlot(ref.current, data.data || [], {
      ...data.layout,
      margin: { t: 10, r: 10, b: 40, l: 40 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { family: "'IBM Plex Sans', sans-serif", size: 12 },
    }, { responsive: true, displayModeBar: false });
  }, [data]);

  if (!data) return <div style={{ color: COLORS.muted, fontSize: 13, padding: 8 }}>No data</div>;
  return <div ref={ref} style={{ width: "100%", height: 240 }} />;
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.muted, fontSize: 14, padding: "20px 0" }}>
      <div style={{
        width: 16, height: 16, border: `2px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.accent}`, borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      Processing file…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pier, setPier] = useState("");
  const [story, setStory] = useState("");
  const [tab, setTab] = useState("table");

  const upload = useCallback(async (f, selectedPier, selectedStory) => {
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("lateral_loads_file", f);
    if (selectedPier) form.append("selected_pier", selectedPier);
    if (selectedStory) form.append("selected_story", selectedStory);

    try {
      const res = await fetch(API_URL, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Upload failed");
      setResult(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback(f => {
    setFile(f);
    setResult(null);
    setPier("");
    setStory("");
    upload(f);
  }, [upload]);

  const handleApply = () => {
    if (file) upload(file, pier, story);
  };

  const tabStyle = active => ({
    padding: "8px 20px", fontSize: 14, fontWeight: active ? 600 : 400,
    border: "none", background: "none", cursor: "pointer",
    borderBottom: active ? `2px solid ${COLORS.accent}` : "2px solid transparent",
    color: active ? COLORS.accent : COLORS.muted,
  });

  return (
    <>
      <style>{css}</style>
      {/* Header */}
      <div style={{ background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "-0.03em" }}>SCON</span>
            <Badge>Lateral Loads</Badge>
          </div>
          {file && <span style={{ fontSize: 12, color: COLORS.muted, fontFamily: "'IBM Plex Mono', monospace" }}>{file.name}</span>}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px" }}>
        {/* Upload */}
        {!file && <UploadZone onFile={handleFile} />}

        {/* Error */}
        {error && (
          <div style={{ background: "#fef2f2", border: `1px solid #fca5a5`, borderRadius: 8, padding: "12px 16px", color: COLORS.danger, fontSize: 14, marginTop: 16 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && <Spinner />}

        {/* Selectors */}
        {result && !loading && (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap" }}>
              <Select label="Story" options={result.story_options} value={story} onChange={setStory} />
              <Select label="Pier" options={result.pier_options} value={pier} onChange={setPier} />
              <button
                onClick={handleApply}
                style={{
                  padding: "9px 20px", borderRadius: 6, border: "none",
                  background: COLORS.accent, color: "#fff", fontWeight: 600, fontSize: 14,
                  flexShrink: 0,
                }}
              >
                Apply
              </button>
              <button
                onClick={() => { setFile(null); setResult(null); setError(null); }}
                style={{
                  padding: "9px 16px", borderRadius: 6, border: `1px solid ${COLORS.border}`,
                  background: COLORS.card, color: COLORS.muted, fontWeight: 500, fontSize: 14,
                  flexShrink: 0,
                }}
              >
                Change file
              </button>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, marginBottom: 24, display: "flex" }}>
              <button style={tabStyle(tab === "table")} onClick={() => setTab("table")}>Table</button>
              <button style={tabStyle(tab === "graphs")} onClick={() => setTab("graphs")}>Graphs</button>
            </div>

            {tab === "table" && <Table data={result.table} />}
            {tab === "graphs" && <GraphPanel graphs={result.graphs} />}
          </>
        )}
      </div>

      {/* Plotly CDN */}
      <script src="https://cdn.plot.ly/plotly-2.27.0.min.js" />
    </>
  );
}
