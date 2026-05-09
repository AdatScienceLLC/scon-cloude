import os
import json
import traceback
import io
from django.core.files.storage import default_storage
from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .scontable import (read_pier_forces, get_stories_and_piers_from_df,
    build_table_from_df, build_table_I_from_df, I_COLS,
    build_overview_graphs_from_df, read_units_from_df, read_pier_forces_light)

ALLOWED_EXTENSIONS = {".xlsx"}


def save_upload(file):
    name = default_storage.save(file.name, file)
    return os.path.join(settings.MEDIA_ROOT, name), name


def delete_upload(storage_name):
    try:
        default_storage.delete(storage_name)
    except Exception:
        pass


def validate_extension(filename):
    return os.path.splitext(filename)[1].lower() in ALLOWED_EXTENSIONS


class UploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("lateral_loads_file")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        if not validate_extension(file.name):
            return Response({"detail": "Only .xlsx files are accepted."}, status=status.HTTP_400_BAD_REQUEST)

        file_path, storage_name = save_upload(file)
        try:
            stories_raw = request.POST.get("stories")
            piers_selected_raw = request.POST.get("piers")
            piers_selected = json.loads(piers_selected_raw) if piers_selected_raw else []
            stories_list = json.loads(stories_raw) if stories_raw else []

            if stories_list and piers_selected:
                shape     = request.POST.get("shape", "")
                load_type = request.POST.get("load_type", "panel")
                df = read_pier_forces(file_path)
                all_stories, all_piers, story_piers = get_stories_and_piers_from_df(df)
                units = read_units_from_df(file_path, df)
                use_sectional = (
                    (shape == "I" and len(piers_selected) == 1) or
                    (shape in ("C", "L") and load_type == "sectional" and len(piers_selected) == 1)
                )
                tables = {}
                for s in stories_list:
                    if use_sectional:
                        pier, table_data, _ = build_table_I_from_df(df, s, piers_selected[0])
                        tables[s] = {"piers": [pier], "columns": I_COLS, "data": table_data, "units": units}
                    else:
                        table_piers, table_data, _ = build_table_from_df(df, s, piers_selected)
                        tables[s] = {"piers": table_piers, "data": table_data, "units": units}
                return Response({
                    "story_options": all_stories,
                    "pier_options": all_piers,
                    "story_piers": story_piers,
                    "tables": tables,
                }, status=status.HTTP_200_OK)

            # Initial upload: use light read (stories/piers only, no heavy graph computation)
            stories, all_piers, story_piers = read_pier_forces_light(file_path)
            return Response({
                "story_options": stories,
                "pier_options": all_piers,
                "story_piers": story_piers,
                "overview_graphs": None,
                "tables": None,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            print(traceback.format_exc())
            return Response({"detail": f"Processing error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            delete_upload(storage_name)


class ExportView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("lateral_loads_file")
        fmt = request.POST.get("format", "csv")
        story = request.POST.get("story")
        shape = request.POST.get("shape", "")
        load_type = request.POST.get("load_type", "panel")
        piers_selected_raw = request.POST.get("piers")
        piers_selected = json.loads(piers_selected_raw) if piers_selected_raw else []

        if not file or not story or not piers_selected:
            return Response({"detail": "Missing file, story, or piers."}, status=status.HTTP_400_BAD_REQUEST)

        file_path, storage_name = save_upload(file)
        try:
            df_full = read_pier_forces(file_path)
            use_sectional = (
                (shape == "I" and len(piers_selected) == 1) or
                (shape in ("C", "L") and load_type == "sectional" and len(piers_selected) == 1)
            )
            if use_sectional:
                _, _, df = build_table_I_from_df(df_full, story, piers_selected[0])
            else:
                _, _, df = build_table_from_df(df_full, story, piers_selected)
            if df is None:
                return Response({"detail": "No data found."}, status=status.HTTP_400_BAD_REQUEST)

            if fmt == "csv":
                response = HttpResponse(content_type="text/csv")
                response["Content-Disposition"] = f'attachment; filename="pier_forces_{story}.csv"'
                df.to_csv(response, index=False)
                return response
            else:
                buffer = io.BytesIO()
                df.to_excel(buffer, index=False, engine="openpyxl")
                buffer.seek(0)
                response = HttpResponse(buffer.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                response["Content-Disposition"] = f'attachment; filename="pier_forces_{story}.xlsx"'
                return response
        except Exception as e:
            print(traceback.format_exc())
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            delete_upload(storage_name)


class OverviewView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("lateral_loads_file")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        if not validate_extension(file.name):
            return Response({"detail": "Only .xlsx files are accepted."}, status=status.HTTP_400_BAD_REQUEST)
        file_path, storage_name = save_upload(file)
        try:
            df = read_pier_forces(file_path)
            overview = build_overview_graphs_from_df(df)
            return Response({"overview_graphs": overview}, status=status.HTTP_200_OK)
        except Exception as e:
            print(traceback.format_exc())
            return Response({"detail": f"Processing error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            delete_upload(storage_name)


upload_view   = UploadView.as_view()
export_view   = ExportView.as_view()
overview_view = OverviewView.as_view()
