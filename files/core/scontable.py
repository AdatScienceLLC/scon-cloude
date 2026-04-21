import re
import numpy as np
import pandas as pd

SHAPE_PIER_COUNT = {"C": 3, "L": 2, "I": 1}


def _nsort(s):
    """Natural sort key: 'Story10' sorts after 'Story9', not after 'Story1'."""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r"(\d+)", s)]


def read_pier_forces(file_path):
    df = pd.read_excel(file_path, sheet_name="Pier Forces", header=1, index_col=None)
    df = df[["Story", "Pier", "Output Case", "Location", "P", "V2", "M3"]]
    df = df[df["Location"] == "Bottom"].copy()
    df["Story"] = df["Story"].astype(str)
    df["Pier"] = df["Pier"].astype(str)
    for col in ["P", "V2", "M3"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0)
    return df


def get_stories_and_piers(file_path):
    df = read_pier_forces(file_path)
    # Natural sort descending (roof → ground) for dropdowns
    stories = sorted(df["Story"].dropna().unique().tolist(), key=_nsort, reverse=True)
    piers = sorted(df["Pier"].dropna().unique().tolist())
    story_piers = {
        s: sorted(df[df["Story"] == s]["Pier"].dropna().unique().tolist())
        for s in stories
    }
    return stories, piers, story_piers


def get_piers_for_story(file_path, story):
    df = read_pier_forces(file_path)
    piers = sorted(df[df["Story"] == story]["Pier"].dropna().unique().tolist())
    return piers


def read_units(file_path):
    try:
        df_raw = pd.read_excel(file_path, sheet_name="Pier Forces", header=1, nrows=1)
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


def build_table(file_path, story, piers):
    df = read_pier_forces(file_path)
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


def build_overview_graphs(file_path):
    df_all = read_pier_forces(file_path)

    # Exclude non-floor labels (EMR, BKRF, etc.) — keep any story containing a digit or hyphen-number
    stories_asc  = sorted(
        [s for s in df_all["Story"].unique().tolist() if any(c.isdigit() for c in str(s))],
        key=_nsort
    )
    stories_desc = list(reversed(stories_asc))

    # Use only numeric stories for all graph computations
    df = df_all[df_all["Story"].isin(stories_asc)].copy()
    piers = sorted(df["Pier"].unique().tolist())

    def max_abs(s):
        return s.abs().max()

    def _rnd(v):
        try:
            f = float(v)
            return round(f, 1) if f == f else 0.0  # guard NaN
        except (TypeError, ValueError):
            return 0.0

    # Global per-pier maxima (P uses signed max/min; V2/M3 use abs max)
    pier_p_max  = [_rnd(df[df["Pier"] == p]["P"].max())        for p in piers]
    pier_p_min  = [_rnd(df[df["Pier"] == p]["P"].min())        for p in piers]
    pier_v2_max = [_rnd(df[df["Pier"] == p]["V2"].abs().max()) for p in piers]
    pier_m3_max = [_rnd(df[df["Pier"] == p]["M3"].abs().max()) for p in piers]

    # Story profiles — lines, Y axis in ascending order so ground is at bottom
    def make_profile(col):
        return [
            {
                "name": p,
                "x": [_rnd(v) for v in df[df["Pier"] == p].groupby("Story")[col]
                       .apply(max_abs).reindex(stories_asc).fillna(0).tolist()],
                "y": stories_asc,
                "type": "scatter",
                "mode": "lines+markers",
                "marker": {"size": 6},
            }
            for p in piers
        ]

    # Pier share pie — global and per story
    def _pie(piers_s, vals):
        return [{"values": vals, "labels": piers_s, "type": "pie", "hole": 0.45,
                 "textinfo": "label+percent",
                 "hovertemplate": "%{label}: %{value:.1f} kips (%{percent})<extra></extra>"}]

    pier_share_by_story = {}
    envelope_by_story   = {}
    for s in stories_desc:
        df_s    = df[df["Story"] == s]
        piers_s = sorted(df_s["Pier"].unique().tolist())
        pier_share_by_story[s] = _pie(
            piers_s,
            [_rnd(df_s[df_s["Pier"] == p]["V2"].abs().max()) for p in piers_s],
        )
        envelope_by_story[s] = {
            "piers":  piers_s,
            "p_max":  [_rnd(df_s[df_s["Pier"] == p]["P"].max())        for p in piers_s],
            "p_min":  [_rnd(df_s[df_s["Pier"] == p]["P"].min())        for p in piers_s],
            "v2":     [_rnd(df_s[df_s["Pier"] == p]["V2"].abs().max()) for p in piers_s],
            "m3":     [_rnd(df_s[df_s["Pier"] == p]["M3"].abs().max()) for p in piers_s],
        }

    def make_pm_scatter():
        return [
            {
                "name": p,
                "x": [_rnd(v) for v in df[df["Pier"] == p]["M3"].tolist()],
                "y": [_rnd(v) for v in df[df["Pier"] == p]["P"].tolist()],
                "text": df[df["Pier"] == p]["Output Case"].tolist(),
                "type": "scatter",
                "mode": "markers",
                "marker": {"size": 9, "opacity": 0.8},
                "hovertemplate": "<b>%{text}</b><br>P: %{y} kip<br>M3: %{x} kip-ft<extra>" + p + "</extra>",
            }
            for p in piers
        ]

    def make_governing(df_sub, piers_sub, col, use_abs=True):
        rows = []
        for p in piers_sub:
            df_p = df_sub[df_sub["Pier"] == p]
            if df_p.empty:
                continue
            series = df_p[col].abs() if use_abs else df_p[col]
            idx = series.idxmax()
            rows.append({
                "pier":  p,
                "case":  str(df_p.loc[idx, "Output Case"]),
                "value": _rnd(float(series.max())),
            })
        return {
            "piers":  [r["pier"]  for r in rows],
            "cases":  [r["case"]  for r in rows],
            "values": [r["value"] for r in rows],
        }

    def make_governing_p(df_sub, piers_sub):
        rows = []
        for p in piers_sub:
            df_p = df_sub[df_sub["Pier"] == p]
            if df_p.empty:
                continue
            idx_max = df_p["P"].idxmax()
            idx_min = df_p["P"].idxmin()
            rows.append({
                "pier":      p,
                "max_case":  str(df_p.loc[idx_max, "Output Case"]),
                "max_value": _rnd(float(df_p["P"].max())),
                "min_case":  str(df_p.loc[idx_min, "Output Case"]),
                "min_value": _rnd(float(df_p["P"].min())),
            })
        return {
            "piers":      [r["pier"]      for r in rows],
            "max_cases":  [r["max_case"]  for r in rows],
            "max_values": [r["max_value"] for r in rows],
            "min_cases":  [r["min_case"]  for r in rows],
            "min_values": [r["min_value"] for r in rows],
        }

    def make_force_dist(df_sub, piers_sub):
        p_abs = [_rnd(max(abs(_rnd(df_sub[df_sub["Pier"]==p]["P"].max())),
                         abs(_rnd(df_sub[df_sub["Pier"]==p]["P"].min())))) for p in piers_sub]
        return {
            "v2": {
                "pie":       _pie(piers_sub, [_rnd(df_sub[df_sub["Pier"]==p]["V2"].abs().max()) for p in piers_sub]),
                "governing": make_governing(df_sub, piers_sub, "V2"),
            },
            "m3": {
                "pie":       _pie(piers_sub, [_rnd(df_sub[df_sub["Pier"]==p]["M3"].abs().max()) for p in piers_sub]),
                "governing": make_governing(df_sub, piers_sub, "M3"),
            },
            "p": {
                "pie":       _pie(piers_sub, p_abs),
                "governing": make_governing_p(df_sub, piers_sub),
            },
        }

    pier_p_abs = [_rnd(max(abs(mx), abs(mn))) for mx, mn in zip(pier_p_max, pier_p_min)]

    all_piers = sorted(df_all["Pier"].unique().tolist())
    force_dist_global = make_force_dist(df_all, all_piers)
    force_dist_by_story = {s: make_force_dist(df[df["Story"]==s], sorted(df[df["Story"]==s]["Pier"].unique().tolist())) for s in stories_desc}

    return {
        "pier_share": _pie(piers, pier_v2_max),
        "pier_share_by_story": pier_share_by_story,
        "envelope": {
            "piers":  piers,
            "p_max":  pier_p_max,
            "p_min":  pier_p_min,
            "v2":     pier_v2_max,
            "m3":     pier_m3_max,
            "by_story": envelope_by_story,
        },
        "force_dist": {**force_dist_global, "by_story": force_dist_by_story, "stories": stories_desc},
        "v2_profile":  make_profile("V2"),
        "m3_profile":  make_profile("M3"),
        "p_profile":   make_profile("P"),
        "pm_scatter":  make_pm_scatter(),
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
