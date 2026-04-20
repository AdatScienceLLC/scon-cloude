from django.urls import path
from .views import upload_view

app_name = "scon"

urlpatterns = [
    path("api/upload/", upload_view, name="upload"),
]
