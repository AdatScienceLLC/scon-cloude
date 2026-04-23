import re
import numpy as np
import pandas as pd

SHAPE_PIER_COUNT = {"C": 3, "L": 2, "I": 1}


def _nsort(s):
    """Natural sort key: 'Story10' sorts after 'Story9', not after 'Story1'."""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r"(\d+)", s)]


REQUIRED_COLS = {"Story", "Pier", "Output Case", "Location", "P", "V2", "M3"}

def read_pier_forces(file_path):
    xl = pd.ExcelFile(file_path)
    # Try every sheet and every likely header row
    for sheet in xl.sheet_names:
        for hdr in range(5):
            try:
                df = pd.read_excel(file_path, sheet_name=sheet, header=hdr, index_col=None, engine="calamine")
                if REQUIRED_COLS.issubset(set(df.columns)):
                    return _clean_pier_df(df)
            except Exception:
                continue
    raise ValueError(
        f"Could not find a sheet with columns {REQUIRED_COLS}. "
        f"Sheets found: {xl.sheet_names}"
    )

EXTRA_COLS = ["T", "V3", "M2"]

def _clean_pier_df(df):
    base = ["Story", "Pier", "Output Case", "Location", "P", "V2", "M3"]
    extra = [c for c in EXTRA_COLS if c in df.columns]
    df = df[base + extra]
    df = df[df["Location"] == "Bottom"].copy()
    df["Story"] = df["Story"].astype(str)
    df["Pier"] = df["Pier"].astype(str)
    for col in ["P", "V2", "M3"] + extra:
        df[col] = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0)
    for col in EXTRA_COLS:
        if col not in df.columns:
            df[col] = 0.0
    return df


def read_pier_forces_light(file_path):
    """Fast metadata-only read: returns (stories, piers, story_piers) without loading P/V2/M3."""
    xl = pd.ExcelFile(file_path)
    for sheet in xl.sheet_names:
        for hdr in range(5):
            try:
                df = pd.read_excel(file_path, sheet_name=sheet, header=hdr,
                                   usecols=lambda c: c in {"Story","Pier","Location"},
                                   engine="calamine", dtype=str)
                if {"Story","Pier","Location"}.issubset(set(df.columns)):
                    df = df[df["Location"]=="Bottom"].copy()
                    return get_stories_and_piers_from_df(df)
            except Exception:
                continue
    raise ValueError("Could not find Story/Pier/Location columns.")

def get_stories_and_piers_from_df(df):
    stories = sorted(df["Story"].dropna().unique().tolist(), key=_nsort, reverse=True)
    piers = sorted(df["Pier"].dropna().unique().tolist())
    story_piers = {
        s: sorted(df[df["Story"] == s]["Pier"].dropna().unique().tolist())
        for s in stories
    }
    return stories, piers, story_piers

def get_stories_and_piers(file_path):
    return get_stories_and_piers_from_df(read_pier_forces(file_path))


def read_units(file_path):
    try:
        xl = pd.ExcelFile(file_path)
        df_raw = None
        for sheet in xl.sheet_names:
            for hdr in range(5):
                try:
                    tmp = pd.read_excel(file_path, sheet_name=sheet, header=hdr, nrows=1)
                    if REQUIRED_COLS.issubset(set(tmp.columns)):
                        df_raw = tmp
                        break
                except Exception:
                    continue
            if df_raw is not None:
                break
        if df_raw is None:
            return {}
        units = {}
        for col in ["P", "V2", "M3"]:
            if col in df_raw.columns:
                val = df_raw[col].iloc[0]
                if pd.notna(val):
                    s = str(val).strip()
                    try:
                        float(s)
                    except ValueError:
                        if s:
                            units[col] = s
        return units
    except Exception:
        return {}


def read_units_from_df(file_path, df):
    try:
        xl = pd.ExcelFile(file_path)
        for sheet in xl.sheet_names:
            for hdr in range(5):
                try:
                    tmp = pd.read_excel(file_path, sheet_name=sheet, header=hdr, nrows=1)
                    if REQUIRED_COLS.issubset(set(tmp.columns)):
                        units = {}
                        for col in ["P", "V2", "M3"]:
                            if col in tmp.columns:
                                val = tmp[col].iloc[0]
                                if pd.notna(val):
                                    s = str(val).strip()
                                    try:
                                        float(s)
                                    except ValueError:
                                        if s:
                                            units[col] = s
                        return units
                except Exception:
                    continue
    except Exception:
        pass
    return {}

def build_table_from_df(df, story, piers):
    df_story = df[df["Story"] == story]
    if not piers:
        return [], [], None
    cases = sorted(df_story["Output Case"].dropna().unique().tolist())
    rows = []
    for case in cases:
        row = [case]
        for pier in piers:
            sub = df_story[(df_story["Pier"] == pier) & (df_story["Output Case"] == case)]
            if not sub.empty:
                row += [round(float(sub["P"].iloc[0]), 3),
                        round(float(sub["V2"].iloc[0]), 3),
                        round(float(sub["M3"].iloc[0]), 3)]
            else:
                row += [0.0, 0.0, 0.0]
        rows.append(row)
    export_cols = ["Output Case"] + [f"{c} ({p})" for p in piers for c in ["P", "V2", "M3"]]
    df_export = pd.DataFrame(rows, columns=export_cols)
    return piers, rows, df_export


I_COLS = ["P", "T", "V3", "M2", "Cmy", "V2", "M3", "Cmz"]

def build_table_I_from_df(df, story, pier):
    """8-column table for I-shape: P, T, V2, M2, Cmy=1, V3, M3, Cmz=1."""
    df_sub = df[(df["Story"] == story) & (df["Pier"] == pier)]
    cases = sorted(df_sub["Output Case"].dropna().unique().tolist())
    rows = []
    for case in cases:
        sub = df_sub[df_sub["Output Case"] == case]
        if sub.empty:
            rows.append([case, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0])
        else:
            r = sub.iloc[0]
            rows.append([case,
                round(float(r["P"]),  3),
                round(float(r["T"]),  3),
                round(float(r["V3"]), 3),
                round(float(r["M2"]), 3),
                1.0,
                round(float(r["V2"]), 3),
                round(float(r["M3"]), 3),
                1.0,
            ])
    export_cols = ["Output Case"] + I_COLS
    df_export = pd.DataFrame(rows, columns=export_cols)
    return pier, rows, df_export


def _rnd(v):
    try:
        f = float(v)
        return round(f, 1) if f == f else 0.0
    except (TypeError, ValueError):
        return 0.0

def _vec_governing(df_sub, col, use_abs=True):
    """Vectorized: find governing case per pier for a force column."""
    work = df_sub[["Pier", "Output Case", col]].copy()
    work["_v"] = work[col].abs() if use_abs else work[col]
    idx = work.groupby("Pier")["_v"].idxmax()
    res = work.loc[idx].sort_values("Pier").reset_index(drop=True)
    return {
        "piers":  res["Pier"].tolist(),
        "cases":  res["Output Case"].tolist(),
        "values": [_rnd(v) for v in res["_v"].tolist()],
    }

def _vec_governing_p(df_sub):
    """Vectorized: find max tension and max compression case per pier."""
    work = df_sub[["Pier", "Output Case", "P"]]
    idx_max = work.groupby("Pier")["P"].idxmax()
    idx_min = work.groupby("Pier")["P"].idxmin()
    rmax = work.loc[idx_max].sort_values("Pier").reset_index(drop=True)
    rmin = work.loc[idx_min].sort_values("Pier").reset_index(drop=True)
    return {
        "piers":      rmax["Pier"].tolist(),
        "max_cases":  rmax["Output Case"].tolist(),
        "max_values": [_rnd(v) for v in rmax["P"].tolist()],
        "min_cases":  rmin["Output Case"].tolist(),
        "min_values": [_rnd(v) for v in rmin["P"].tolist()],
    }

def build_overview_graphs_from_df(df_all):
    stories_asc = sorted(
        [s for s in df_all["Story"].unique().tolist() if any(c.isdigit() for c in str(s))],
        key=_nsort
    )
    stories_desc = list(reversed(stories_asc))
    df = df_all[df_all["Story"].isin(stories_asc)].copy()
    piers = sorted(df["Pier"].unique().tolist())

    def _pie(piers_s, vals):
        return [{"values": vals, "labels": piers_s, "type": "pie", "hole": 0.45,
                 "textinfo": "label+percent",
                 "hovertemplate": "%{label}: %{value:.1f} kips (%{percent})<extra></extra>"}]

    # ── Single grouped aggregation replaces all per-pier loops ──
    df["_v2a"] = df["V2"].abs()
    df["_m3a"] = df["M3"].abs()
    grp_pier = df.groupby("Pier").agg(
        v2_max=("_v2a", "max"), m3_max=("_m3a", "max"),
        p_max=("P", "max"),    p_min=("P", "min"),
    ).reindex(piers)

    grp_story_pier = df.groupby(["Story", "Pier"]).agg(
        v2_max=("_v2a", "max"), m3_max=("_m3a", "max"),
        p_max=("P", "max"),    p_min=("P", "min"),
    )

    pier_v2_max = [_rnd(v) for v in grp_pier["v2_max"].tolist()]
    pier_m3_max = [_rnd(v) for v in grp_pier["m3_max"].tolist()]
    pier_p_max  = [_rnd(v) for v in grp_pier["p_max"].tolist()]
    pier_p_min  = [_rnd(v) for v in grp_pier["p_min"].tolist()]

    # Profile traces using pivot
    def make_profile(col):
        pivot = df.groupby(["Pier", "Story"])[col].apply(lambda s: s.abs().max()).unstack("Story").reindex(columns=stories_asc).fillna(0)
        return [
            {"name": p, "x": [_rnd(v) for v in pivot.loc[p].tolist()], "y": stories_asc,
             "type": "scatter", "mode": "lines+markers", "marker": {"size": 6}}
            for p in piers if p in pivot.index
        ]

    # Per-story envelope using grouped data
    pier_share_by_story = {}
    envelope_by_story   = {}
    for s in stories_desc:
        try:
            sg = grp_story_pier.loc[s].reset_index()
        except KeyError:
            continue
        piers_s = sorted(sg["Pier"].tolist())
        sg = sg.set_index("Pier").reindex(piers_s)
        pier_share_by_story[s] = _pie(piers_s, [_rnd(v) for v in sg["v2_max"].tolist()])
        envelope_by_story[s] = {
            "piers": piers_s,
            "p_max": [_rnd(v) for v in sg["p_max"].tolist()],
            "p_min": [_rnd(v) for v in sg["p_min"].tolist()],
            "v2":    [_rnd(v) for v in sg["v2_max"].tolist()],
            "m3":    [_rnd(v) for v in sg["m3_max"].tolist()],
        }

    # P-M scatter — sample to max 5000 points per pier to avoid huge payloads
    def make_pm_scatter():
        traces = []
        for p in piers:
            dp = df[df["Pier"] == p]
            if len(dp) > 5000:
                dp = dp.sample(5000, random_state=42)
            traces.append({
                "name": p,
                "x": [_rnd(v) for v in dp["M3"].tolist()],
                "y": [_rnd(v) for v in dp["P"].tolist()],
                "text": dp["Output Case"].tolist(),
                "type": "scatter", "mode": "markers",
                "marker": {"size": 9, "opacity": 0.8},
                "hovertemplate": "<b>%{text}</b><br>P: %{y} kip<br>M3: %{x} kip-ft<extra>" + p + "</extra>",
            })
        return traces

    def make_force_dist(df_sub):
        piers_sub = sorted(df_sub["Pier"].unique().tolist())
        gs = df_sub.groupby("Pier").agg(
            v2_max=(("V2"), lambda x: x.abs().max()),
            m3_max=(("M3"), lambda x: x.abs().max()),
            p_max=("P", "max"), p_min=("P", "min"),
        ).reindex(piers_sub)
        p_abs = [_rnd(max(abs(_rnd(mx)), abs(_rnd(mn)))) for mx, mn in zip(gs["p_max"], gs["p_min"])]
        return {
            "v2": {"pie": _pie(piers_sub, [_rnd(v) for v in gs["v2_max"].tolist()]),
                   "governing": _vec_governing(df_sub, "V2")},
            "m3": {"pie": _pie(piers_sub, [_rnd(v) for v in gs["m3_max"].tolist()]),
                   "governing": _vec_governing(df_sub, "M3")},
            "p":  {"pie": _pie(piers_sub, p_abs),
                   "governing": _vec_governing_p(df_sub)},
        }

    force_dist_global   = make_force_dist(df_all)
    force_dist_by_story = {s: make_force_dist(df[df["Story"] == s]) for s in stories_desc}

    pier_p_abs = [_rnd(max(abs(mx), abs(mn))) for mx, mn in zip(pier_p_max, pier_p_min)]

    return {
        "pier_share": _pie(piers, pier_v2_max),
        "pier_share_by_story": pier_share_by_story,
        "envelope": {
            "piers": piers, "p_max": pier_p_max, "p_min": pier_p_min,
            "v2": pier_v2_max, "m3": pier_m3_max, "by_story": envelope_by_story,
        },
        "force_dist": {**force_dist_global, "by_story": force_dist_by_story, "stories": stories_desc},
        "v2_profile": make_profile("V2"),
        "m3_profile": make_profile("M3"),
        "p_profile":  make_profile("P"),
        "pm_scatter": make_pm_scatter(),
    }


def build_graphs(file_path, story, piers):
    df = read_pier_forces(file_path)
    df_filtered = df[df["Pier"].isin(piers)].copy()
    stories_ordered = sorted(df_filtered["Story"].unique().tolist(), reverse=True)

    def make_traces(col):
        return [
            {
                "name": p,
                "x": df_filtered[df_filtered["Pier"] == p].groupby("Story")[col].max().reindex(stories_ordered).fillna(0).tolist(),
                "y": stories_ordered,
                "type": "bar",
                "orientation": "h",
            }
            for p in piers
        ]

    return {
        "p": make_traces("P"),
        "v2": make_traces("V2"),
        "m3": make_traces("M3"),
    }
