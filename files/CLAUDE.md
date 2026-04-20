# SCON Project Context

## What this app does
Structural engineering tool that reads ETABS Pier Forces Excel files
and displays shear wall pier force data (P, V2, M3).

## Tech stack
- Backend: Django + Django REST Framework on port 8001
- Frontend: React (Vite) on port 5173
- Key file: Excel with "Pier Forces" sheet, Location=Bottom rows only

## File structure
- core/views.py — single UploadView + ExportView
- core/scontable.py — all data processing logic
- core/urls.py — api/upload/ and api/export/
- frontend/src/App.jsx — full React app

## Current bugs to fix
1. Table rows empty after Apply — data returns 200 but rows not rendering
2. Pier list not filtering when story changes — pierOptions not updating
3. Graphs not rendering — Plotly CDN loads after React mount
4. Download CSV/Excel not working — check ExportView and urls.py

## User flow
1. Upload .xlsx file (Pier Forces sheet)
2. Select shape (C=3 piers, L=2 piers, I=1 pier)
3. Select story — pier list filters to only piers on that floor
4. Select correct number of piers (Ctrl+click)
5. Click Apply — shows Table tab and Graphs tab
6. Download CSV or Excel from Table tab

## Key functions in scontable.py
- get_stories_and_piers(file_path) — all stories and piers
- get_piers_for_story(file_path, story) — filtered piers
- build_table(file_path, story, piers) — merged table per pier
- build_graphs(file_path, story, piers) — 5 Plotly graph dicts