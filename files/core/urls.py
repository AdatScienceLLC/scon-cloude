from django.urls import path
from .views import upload_view, export_view, overview_view

app_name = "core"

urlpatterns = [
    path("api/upload/", upload_view, name="upload"),
    path("api/export/", export_view, name="export"),
    path("api/overview/", overview_view, name="overview"),
]
