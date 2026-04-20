import json

import numpy as np
import pandas as pd
import pyodbc
import math


def load_combinations():
    load_combo = {
        "Type": [
            "Gravity 1",
            "Gravity 2",
            "Wind 1",
            "Wind 2",
            "Seismic 1",
            "Seismic 2",
        ],
        "DL": [1.40, 1.20, 1.20, 0.90, 1.2347, 0.8626],
        "LL": ["N/A", 1.60, 1.00, "N/A", 1.00, "N/A"],
        "W/E": ["N/A", "N/A", 1.60, 1.60, 1.00, 1.00],
    }
    return pd.DataFrame(load_combo, columns=["Type", "DL", "LL", "W/E"])


def read_excel_file1(etabs_file_path,sheet_name="Pier Forces"):
    # Read excel file
    excel1 = pd.read_excel(
        # r"C:\\Users\\dell\\Downloads\\20210302-from v45 model.xlsx",
        etabs_file_path,
        sheet_name=sheet_name,
        index_col=None,
        usecols = "A:L",
        header=0,
        skiprows=1,
    )
    excel1 = excel1[["Story", "Pier", "Output Case", "Location", "P", "V2", "M3"]]
    excel1 = excel1[excel1["Location"] == "Bottom"]
    # Clean numeric columns
    excel1[["P", "V2", "M3"]] = (
        excel1[["P", "V2", "M3"]]
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
    )
    excel1["PierStory"] = excel1["Pier"] + " " + excel1["Story"]
    return excel1

# def read_access_file(etabs_file_path):
#     # etabs_file_path = etabs_file_path.replace("\\", "\\\\")
#     # etabs_file_path = r"C:\\Users\\dell\\Downloads\\20210302-from v45 model.accdb"
    

#     # Connect pyodbc
#     conn = pyodbc.connect(
#         r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=" + etabs_file_path
#     )
#     access_data = pd.read_sql(
#         "select [Story],[Pier],[Output Case],[Location],[P],[V2],[M3] from [Pier Forces] where [Location]='Bottom'",
#         conn,
#     )
#     access_data["PierStory"] = access_data["Pier"] + " " + access_data["Story"]
#     return access_data


def read_excel_file(cltd_file_path):
    # Read excel file
    excel = pd.read_excel(
        # r"C:\\Users\\dell\\Downloads\\20210302-from v45 model.xlsx",
        cltd_file_path,
        usecols="A:E",
        index_col=None,
        header=None,
        skiprows=3,
    )
    excel = excel.rename(columns={0: "Story", 1: "Pier", 2: "Floor", 3: "DL", 4: "LL"})
    excel["Floor.1"] = excel["Floor"].str.replace("F", "Story")
    excel["Story1"] = [
        story.split(" ")[-1] if type(story) == str else story
        for story in excel["Story"]
    ]
    excel["PierStory"] = excel["Pier"] + " " + excel["Story1"]

    return excel


def add_top_column(df, top_col, inplace=False):
    if not inplace:
        df = df.copy()

    df.columns = pd.MultiIndex.from_product([[top_col], df.columns])
    return df


def combinations(i, j):
    if (i.startswith("W") and j.startswith("W")) or (
        i.startswith("EQ") and j.startswith("EQ")
    ):
        return i + " " + j


def retrieve_story_and_pier(ctld_file):
    excel_data = read_excel_file(ctld_file)
    story_options = [{"label": i, "value": i} for i in excel_data["Story1"].unique()]
    pier_options = [{"label": i, "value": i} for i in excel_data["Pier"].unique()]
    return [story_options[:-1], pier_options[:-1]]


def graph_summary_data(cltd_file, etabs_file):
    access_data = read_excel_file1(etabs_file)
    excel_data = read_excel_file(cltd_file)

    access_data["P"] = round(access_data["P"], 1)
    access_data["V2"] = round(access_data["V2"], 1)
    access_data["M3"] = round(access_data["M3"], 1)

    access_data = access_data.replace([np.inf, -np.inf], 0)
    access_data = access_data.fillna(0)
    response = dict()
    response["piercount-CLTD"] = excel_data.Pier.nunique(dropna=True)
    response["piercount-ETABS"] = access_data.Pier.nunique(dropna=True)
    response["maxusedpier-ETABS"] = (
        access_data.groupby(["Pier"])
            .size()
            .sort_values(ascending=False)
            .nlargest(1, keep="all")
            .reset_index()["Pier"]
            .values
    )
    response["maxusedpier-CLTD"] = (
        excel_data.groupby(["Pier"])
            .size()
            .sort_values(ascending=False)
            .nlargest(1, keep="all")
            .reset_index()["Pier"]
            .values
    )
    response["maxp"] = access_data.loc[access_data["P"].idxmax()].to_dict()
    response["maxv"] = access_data.loc[access_data["V2"].idxmax()].to_dict()
    response["maxm"] = access_data.loc[access_data["M3"].idxmax()].to_dict()
    return response


def calculate_cumdl_graph(cltd_file):
    excel_data = read_excel_file(cltd_file)
    excel_data_filter = excel_data.groupby(["Floor.1"]).max().reset_index()
    excel_data_filter = excel_data_filter.iloc[4:]

    excel_data_filter = excel_data_filter.replace([np.inf, -np.inf], 0)
    excel_data_filter = excel_data_filter.fillna(0)
    response = dict()
    response["x-axis"] = round(excel_data_filter["DL"], 5)
    response["y-axis"] = excel_data_filter["Floor.1"]
    return response


def calculate_cumll_graph(cltd_file):
    excel_data = read_excel_file(cltd_file)
    excel_data_filter = excel_data.groupby(["Floor.1"]).max().reset_index()
    excel_data_filter = excel_data_filter.iloc[4:]
    excel_data_filter = excel_data_filter.replace([np.inf, -np.inf], 0)
    excel_data_filter = excel_data_filter.fillna(0)    
    response = dict()
    response["x-axis"] = round(excel_data_filter["LL"], 5)
    response["y-axis"] = excel_data_filter["Floor.1"]
    return response


def calculate_p_graph(etabs_file):
    access_data = read_excel_file1(etabs_file)
    access_data_filter = (
        access_data.groupby("Story").max().reset_index()[["Story", "P"]]
    )
    access_data_filter = access_data_filter.rename(columns={"P": "MaxOfP"})
    min_dataframe = access_data.groupby("Story").min().reset_index()[["Story", "P"]]
    min_dataframe = min_dataframe.rename(columns={"P": "MinOfP"})
    final_data_frame = pd.merge(
        left=access_data_filter, right=min_dataframe, left_on="Story", right_on="Story"
    )
    final_data_frame = final_data_frame.iloc[4:]

    final_data_frame = (
        final_data_frame
        .replace([np.inf, -np.inf], 0)
        .fillna(0)
    )
    response = dict()
    response["Story"] = final_data_frame["Story"].tolist()
    response["MaxOfP"] = final_data_frame["MaxOfP"].tolist()
    response["MinOfP"] = final_data_frame["MinOfP"].tolist()
    return response


def calculate_v_graph(etabs_file):
    access_data = read_excel_file1(etabs_file)
    access_data_filter = (
        access_data.groupby("Story").max().reset_index()[["Story", "V2"]]
    )
    access_data_filter = access_data_filter.rename(columns={"V2": "MaxOfV"})
    min_dataframe = access_data.groupby("Story").min().reset_index()[["Story", "V2"]]
    min_dataframe = min_dataframe.rename(columns={"V2": "MinOfV"})
    final_data_frame = pd.merge(
        left=access_data_filter, right=min_dataframe, left_on="Story", right_on="Story"
    )
    final_data_frame = final_data_frame.iloc[4:]
    final_data_frame = (
        final_data_frame
        .replace([np.inf, -np.inf], 0)
        .fillna(0)
    )
    response = dict()
    response["Story"] = final_data_frame["Story"].tolist()
    response["MaxOfV"] = final_data_frame["MaxOfV"].tolist()
    response["MinOfV"] = final_data_frame["MinOfV"].tolist()

    return response


def calculate_m_graph(etabs_file):
    access_data = read_excel_file1(etabs_file)
    access_data_filter = (
        access_data.groupby("Story").max().reset_index()[["Story", "M3"]]
    )
    access_data_filter = access_data_filter.rename(columns={"M3": "MaxOfM"})
    min_dataframe = access_data.groupby("Story").min().reset_index()[["Story", "M3"]]
    min_dataframe = min_dataframe.rename(columns={"M3": "MinOfM"})
    final_data_frame = pd.merge(
        left=access_data_filter, right=min_dataframe, left_on="Story", right_on="Story"
    )
    final_data_frame = final_data_frame.iloc[4:]
    final_data_frame = (
        final_data_frame
        .replace([np.inf, -np.inf], 0)
        .fillna(0)
    )
    response = dict()
    response["Story"] = final_data_frame["Story"].tolist()
    response["MaxOfM"] = final_data_frame["MaxOfM"].tolist()
    response["MinOfM"] = final_data_frame["MinOfM"].tolist()

    return response


def calculate_bubble_graph(etabs_file):
    access_data = read_excel_file1(etabs_file)
    pier_list = access_data['Pier'].unique().tolist()
    story_list = access_data['Story'].unique().tolist()
    pier_story_pair = access_data.groupby(['Pier', 'Story']).groups.keys()
    story_pier_pair = pier_story_pair = access_data.groupby(['Story', 'Pier']).groups.keys()
    pier_data = []
    story_data = []
    for pier in pier_list:
        pier_story_count = [tup for tup in pier_story_pair if (set([pier]) & set(tup))]
        pier_data.append(len(pier_story_count))

    for story in story_list:
        story_count = [tup for tup in story_pier_pair if (set([story]) & set(tup))]
        story_data.append(len(story_count))

    response = dict()
    response['x_axis'] = story_list
    response['y_axis'] = pier_list
    response['data'] = pier_data
    response['storydata'] = story_data
    return response


def calculate_scon_table(
    p,
    wsc,
    sign,
    load_combination_dataframe,
    excel,
    filtered_access_data,
    pkip_list,
    vkip_list,
    mkip_list,
    other_list,
    wind_seismic_combination_list,
):
    wsc = wsc + " " + sign
    wind_seismic_combination_list.append(wsc)
    wind_seismic_case_split = wsc.split(" ")
    if wind_seismic_case_split[1] == "W1":
        query1 = (
            load_combination_dataframe.iloc[2]["DL"] * (excel["DL"].values[0] * -1)
            + (excel["LL"].values[0] * -1) * load_combination_dataframe.iloc[2]["LL"]
        )

        query2 = (
            filtered_access_data[
                (filtered_access_data["OutputCase"] == wind_seismic_case_split[0])
                & (filtered_access_data["Pier"] == p)
                ]["P"].values[0]
            * load_combination_dataframe.iloc[2]["W/E"]
        )

        query3 = (
            load_combination_dataframe.iloc[2]["DL"] * 0
            + 0 * load_combination_dataframe.iloc[2]["LL"]
        )

        query4 = (
            filtered_access_data[
                (filtered_access_data["OutputCase"] == wind_seismic_case_split[0])
                & (filtered_access_data["Pier"] == p)
                ]["V2"].values[0]
            * load_combination_dataframe.iloc[2]["W/E"]
        )

        query5 = (
            +filtered_access_data[
                (filtered_access_data["OutputCase"] == wind_seismic_case_split[0])
                & (filtered_access_data["Pier"] == p)
                ]["M3"].values[0]
            * load_combination_dataframe.iloc[2]["W/E"]
        )
        if sign == "(+)":
            pkip_list.append(round(query1 + query2))
            vkip_list.append(round(query3 + query4))
            mkip_list.append(round(query3 + query5))

        if sign == "(-)":
            pkip_list.append(round(query1 - query2))
            vkip_list.append(round(query3 - query4))
            mkip_list.append(round(query3 - query5))

        other_list.append("Wind")

    if wind_seismic_case_split[1] == "W2":

        query1 = load_combination_dataframe.iloc[3]["DL"] * (excel["DL"].values[0] * -1)

        query2 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["P"].values[0]
            * load_combination_dataframe.iloc[3]["W/E"]
        )

        query3 = load_combination_dataframe.iloc[3]["DL"] * 0

        query4 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["V2"].values[0]
            * load_combination_dataframe.iloc[3]["W/E"]
        )

        query5 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["M3"].values[0]
            * load_combination_dataframe.iloc[3]["W/E"]
        )

        if sign == "(+)":
            pkip_list.append(round(query1 + query2))
            vkip_list.append(round(query3 + query4))
            mkip_list.append(round(query3 + query5))

        if sign == "(-)":
            pkip_list.append(round(query1 - query2))
            vkip_list.append(round(query3 - query4))
            mkip_list.append(round(query3 - query5))

        other_list.append("Wind")

    if wind_seismic_case_split[1] == "EQ1":

        query1 = (
            load_combination_dataframe.iloc[4]["DL"] * excel["DL"].values[0] * -1
            + excel["LL"].values[0] * -1 * load_combination_dataframe.iloc[4]["LL"]
        )

        query2 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["P"].values[0]
            * load_combination_dataframe.iloc[4]["W/E"]
        )

        query3 = (
            load_combination_dataframe.iloc[4]["DL"] * 0
            + 0 * load_combination_dataframe.iloc[4]["LL"]
        )

        query4 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["V2"].values[0]
            * load_combination_dataframe.iloc[4]["W/E"]
        )

        query5 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["M3"].values[0]
            * load_combination_dataframe.iloc[4]["W/E"]
        )

        if sign == "(+)":
            pkip_list.append(round(query1 + query2))
            vkip_list.append(round(query3 + query4))
            mkip_list.append(round(query3 + query5))

        if sign == "(-)":
            pkip_list.append(round(query1 - query2))
            vkip_list.append(round(query3 - query4))
            mkip_list.append(round(query3 - query5))

        other_list.append("Seismic")

    if wind_seismic_case_split[1] == "EQ2":
        query1 = (
            load_combination_dataframe.iloc[5]["DL"] * (excel["DL"].values[0] * -1)
            + (excel["LL"].values[0] * -1) * 0
        )

        query2 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["P"].values[0]
            * load_combination_dataframe.iloc[5]["W/E"]
        )

        query3 = load_combination_dataframe.iloc[5]["DL"] * 0 + 0 * 0

        query4 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["V2"].values[0]
            * load_combination_dataframe.iloc[5]["W/E"]
        )

        query5 = (
            filtered_access_data[
                filtered_access_data["OutputCase"] == wind_seismic_case_split[0]
                ]["M3"].values[0]
            * load_combination_dataframe.iloc[5]["W/E"]
        )

        if sign == "(+)":
            pkip_list.append(round(query1 + query2))
            vkip_list.append(round(query3 + query4))
            mkip_list.append(round(query3 + query5))

        if sign == "(-)":
            pkip_list.append(round(query1 - query2))
            vkip_list.append(round(query3 - query4))
            mkip_list.append(round(query3 - query5))

        other_list.append("Seismic")

    return [wind_seismic_combination_list, pkip_list, vkip_list, mkip_list, other_list]


def scon_create(
    cltd_file_path,
    etabs_file_path,
    selected_pier,
    selected_story,
    load_combinations_list=None,
):
    story = [selected_story]
    pier = json.loads(selected_pier)
    access_data = read_excel_file1(etabs_file_path)
    excel_data = read_excel_file(cltd_file_path)

    if not load_combinations_list:
        load_combination_dataframe = load_combinations()
    else:
        load_combinations_list = json.loads(load_combinations_list)
        converted_load_combinations = []
        for i in load_combinations_list[1:]:
            sub_list = []
            for j in i:
                try:
                    sub_list.append(float(j))
                except:
                    sub_list.append(j)
            converted_load_combinations.append(sub_list)

        load_combination_dataframe = pd.DataFrame(
            converted_load_combinations, columns=["Type", "DL", "LL", "W/E"]
        )

    filtered_access_data = access_data[
        access_data["Story"].isin(story) & access_data["Pier"].isin(pier)
    ].copy()
    filtered_excel_data = excel_data[
        excel_data["Story1"].isin(story) & excel_data["Pier"].isin(pier)
    ].copy()

    filtered_excel_data.loc[:, "p1"] = round(
        filtered_excel_data["DL"] * load_combination_dataframe.iloc[0]["DL"] * -1
    )

    p2 = (
        filtered_excel_data["DL"] * load_combination_dataframe.iloc[1]["DL"]
        + filtered_excel_data["LL"] * load_combination_dataframe.iloc[1]["LL"]
    )
    filtered_excel_data.loc[:, "p2"] = round(p2 * -1)
    filtered_excel_data.loc[:, "v1"] = 0
    filtered_excel_data.loc[:, "v2"] = 0
    filtered_excel_data.loc[:, "m1"] = 0
    filtered_excel_data.loc[:, "m2"] = 0

    excel = filtered_excel_data[filtered_excel_data["Story"].notna()]
    filtered_access_data = filtered_access_data.rename(
        columns={"Output Case": "OutputCase"}
    )

    output_cases = filtered_access_data.OutputCase.unique()
    wind_seismic_combinations = [
        combinations(i, j) for j in ["W1", "W2", "EQ1", "EQ2"] for i in output_cases
    ]
    wind_seismic_combinations = [i for i in wind_seismic_combinations if i]

    scon_data_frame = pd.DataFrame()
    cltd_data_frame = pd.DataFrame()
    panel_choices = []
    calculation = []

    for i in range(3):
        pkip_list = []
        vkip_list = []
        mkip_list = []
        other_list = []
        wind_seismic_combination_list = []
        panel = pd.DataFrame(columns=["P (Kips)", "V (Kips)", "M (Kip-ft)"])
        cltd_table = pd.DataFrame()

        try:
            p = pier[i]
            excel1 = excel[excel["Pier"] == p]
            cltd_table["P (Kips)"] = [excel1["p1"].values[0], excel1["p2"].values[0], 0]
            cltd_table["V (Kips)"] = 0
            cltd_table["M (Kip-ft)"] = 0
            panel_choices.append("PANEL " + str(i + 1) + " - " + p)

            for sign in ["(+)", "(-)"]:
                for wsc in wind_seismic_combinations:
                    calculation = calculate_scon_table(
                        p,
                        wsc,
                        sign,
                        load_combination_dataframe,
                        excel1,
                        filtered_access_data,
                        pkip_list,
                        vkip_list,
                        mkip_list,
                        other_list,
                        wind_seismic_combination_list,
                    )
            panel["P (Kips)"] = calculation[1]
            panel["V (Kips)"] = calculation[2]
            panel["M (Kip-ft)"] = calculation[3]

        except Exception as e:
            print(f"\u26a0\ufe0f Error in panel {i+1}: {e}")
            panel = pd.DataFrame(columns=["P (Kips)", "V (Kips)", "M (Kip-ft)"])
            cltd_table = pd.DataFrame(columns=["P (Kips)", "V (Kips)", "M (Kip-ft)"])
            panel_choices.append("PANEL " + str(i + 1))

        scon_data_frame = pd.concat([scon_data_frame, panel], axis=1)
        cltd_data_frame = pd.concat([cltd_data_frame, cltd_table], axis=1)

    scon_data_frame = pd.concat([cltd_data_frame, scon_data_frame]).reset_index(drop=True)

    print("\u2705 scon_data_frame shape (raw):", scon_data_frame.shape)
    print("\u2705 panel_choices:", panel_choices)
    print("DATA SAMPLE:", scon_data_frame[:3])
    print("COLUMN COUNT:", scon_data_frame.shape[1] if not scon_data_frame.empty else 0)
    expected_columns = len(panel_choices) * 3
    scon_data_frame = scon_data_frame.iloc[:, :expected_columns]
    expected_columns = scon_data_frame.shape[1]
    expected_panels = expected_columns // 3

    if len(panel_choices) != expected_panels:
        print(f"\u26a0\ufe0f Adjusting panel_choices from {len(panel_choices)} to {expected_panels} to match column count.")
        panel_choices = panel_choices[:expected_panels]

    if not calculation:
        raise ValueError("No calculation results. Check selected piers or input data.")

    scon_data_frame.insert(
        loc=0,
        column="",
        value=["Pu1", "Pu2", ""] + calculation[0],
    )

    scon_data_frame.insert(
        loc=10,
        column="",
        value=["Other", "Other", "Other"] + calculation[4],
        allow_duplicates=True,
    )

    return scon_data_frame.replace(np.nan, "", regex=True)

def calculate_p_graph_from_df(access_data):
    max_df = access_data.groupby("Story")["P"].max().reset_index()
    min_df = access_data.groupby("Story")["P"].min().reset_index()

    final = max_df.merge(min_df, on="Story", suffixes=("_max", "_min"))
    final = final.iloc[4:]
    final = final.replace([np.inf, -np.inf], 0)
    final = final.fillna(0)

    return {
        "Story": final["Story"].tolist(),
        "MaxOfP": final["P_max"].tolist(),
        "MinOfP": final["P_min"].tolist(),
    }


def calculate_v_graph_from_df(access_data):
    max_df = access_data.groupby("Story")["V2"].max().reset_index()
    min_df = access_data.groupby("Story")["V2"].min().reset_index()

    final = max_df.merge(min_df, on="Story", suffixes=("_max", "_min"))
    final = final.iloc[4:]
    final = final.replace([np.inf, -np.inf], 0)
    final = final.fillna(0)
    return {
        "Story": final["Story"].tolist(),
        "MaxOfV": final["V2_max"].tolist(),
        "MinOfV": final["V2_min"].tolist(),
    }


def calculate_m_graph_from_df(access_data):
    max_df = access_data.groupby("Story")["M3"].max().reset_index()
    min_df = access_data.groupby("Story")["M3"].min().reset_index()

    final = max_df.merge(min_df, on="Story", suffixes=("_max", "_min"))
    final = final.iloc[4:]
    final = final.replace([np.inf, -np.inf], 0)
    final = final.fillna(0)
    return {
        "Story": final["Story"].tolist(),
        "MaxOfM": final["M3_max"].tolist(),
        "MinOfM": final["M3_min"].tolist(),
    }




# scon_create("sdf", "sdfs", "gd", "sf")
# calculate_bubble_graph(r"C:\Users\dell\Downloads\20210302-from v45 model.accdb")

