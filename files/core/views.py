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
from .scontable import get_stories_and_piers, build_table, build_overview_graphs, read_units

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
            stories, all_piers, story_piers = get_stories_and_piers(file_path)
            story = request.POST.get("story")
            piers_selected_raw = request.POST.get("piers")
            piers_selected = json.loads(piers_selected_raw) if piers_selected_raw else []

            overview = build_overview_graphs(file_path)
            units = read_units(file_path)

            table_piers, table_data = [], []

            if story and piers_selected:
                table_piers, table_data, _ = build_table(file_path, story, piers_selected)

            return Response({
                "story_options": stories,
                "pier_options": all_piers,
                "story_piers": story_piers,
                "overview_graphs": overview,
                "table": {"piers": table_piers, "data": table_data, "units": units} if table_piers else None,
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
        piers_selected_raw = request.POST.get("piers")
        piers_selected = json.loads(piers_selected_raw) if piers_selected_raw else []

        if not file or not story or not piers_selected:
            return Response({"detail": "Missing file, story, or piers."}, status=status.HTTP_400_BAD_REQUEST)

        file_path, storage_name = save_upload(file)
        try:
            _, _, df = build_table(file_path, story, piers_selected)
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


upload_view = UploadView.as_view()
export_view = ExportView.as_view()
