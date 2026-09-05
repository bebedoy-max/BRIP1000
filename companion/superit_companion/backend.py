"""Akses Supabase memakai akun admin (bukan service role)."""

from typing import Any, Dict, List, Optional

from supabase import create_client, Client

from .config import Config


class Backend:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.client: Client = create_client(cfg.supabase_url, cfg.supabase_anon_key)
        self.user_id: Optional[str] = None
        self.access_token: Optional[str] = None

    # ---------- auth ----------
    def sign_in(self, email: str, password: str) -> str:
        res = self.client.auth.sign_in_with_password({"email": email, "password": password})
        if not res.user:
            raise RuntimeError("Login gagal")
        self.user_id = res.user.id
        self.access_token = res.session.access_token if res.session else None
        return res.user.id

    def token(self, force_refresh: bool = False) -> str:
        """Access token terbaru; diperbarui otomatis sebelum kedaluwarsa."""
        import time as _time

        if force_refresh:
            try:
                res = self.client.auth.refresh_session()
                if res and res.session and res.session.access_token:
                    self.access_token = res.session.access_token
                    return self.access_token
            except Exception:
                pass

        session = None
        try:
            session = self.client.auth.get_session()
        except Exception:
            session = None

        if session and getattr(session, "expires_at", None):
            # Refresh proaktif kalau sisa umur token < 5 menit.
            if float(session.expires_at) - _time.time() < 300:
                try:
                    res = self.client.auth.refresh_session()
                    if res and res.session and res.session.access_token:
                        self.access_token = res.session.access_token
                        return self.access_token
                except Exception:
                    pass

        if session and session.access_token:
            self.access_token = session.access_token
        if not self.access_token:
            raise RuntimeError("Sesi admin belum aktif. Klik Hubungkan lagi.")
        return self.access_token


    # ---------- worker faces ----------
    def pending_faces(self) -> List[Dict[str, Any]]:
        res = (
            self.client.table("worker_faces")
            .select("id,worker_id,personal_number,reference_photo_url,status")
            .in_("status", ["pending", "failed"])
            .execute()
        )
        return res.data or []

    def set_face_indexed(
        self, face_id: str, embedding: List[float], quality: Optional[float] = None
    ) -> None:
        payload: Dict[str, Any] = {"embedding": embedding, "status": "indexed", "note": None}
        if quality is not None:
            payload["quality"] = float(quality)
        try:
            self.client.table("worker_faces").update(payload).eq("id", face_id).execute()
        except Exception:
            payload.pop("quality", None)
            self.client.table("worker_faces").update(payload).eq("id", face_id).execute()

    def set_face_failed(self, face_id: str, note: str) -> None:
        self.client.table("worker_faces").update({"status": "failed", "note": note}).eq(
            "id", face_id
        ).execute()

    def indexed_count(self) -> int:
        res = (
            self.client.table("worker_faces")
            .select("id", count="exact")
            .eq("status", "indexed")
            .execute()
        )
        return res.count or 0

    def face_stats(self) -> Dict[str, int]:
        """Ringkasan jumlah pekerja & status index wajah."""

        def count(table: str, column: Optional[str] = None, value: Optional[str] = None) -> int:
            q = self.client.table(table).select("id", count="exact")
            if column:
                q = q.eq(column, value)
            return q.execute().count or 0

        try:
            workers = count("employees")
        except Exception:
            workers = 0
        faces = count("worker_faces")
        indexed = count("worker_faces", "status", "indexed")
        pending = count("worker_faces", "status", "pending")
        failed = count("worker_faces", "status", "failed")
        return {
            "workers": workers,
            "faces": faces,
            "indexed": indexed,
            "pending": pending,
            "failed": failed,
            "no_photo": max(workers - faces, 0),
        }

    def match(self, embedding: List[float]) -> List[Dict[str, Any]]:
        res = self.client.rpc(
            "match_worker_faces",
            {
                "query_embedding": embedding,
                "match_threshold": float(self.cfg.match_threshold),
                "match_count": int(self.cfg.match_count),
            },
        ).execute()
        return res.data or []

    # ---------- roles ----------
    def my_roles(self) -> List[str]:
        """Daftar role akun yang sedang login (dibaca dari tabel user_roles)."""
        if not self.user_id:
            return []
        res = self.client.table("user_roles").select("role").eq("user_id", self.user_id).execute()
        return [r["role"] for r in (res.data or [])]

    def is_event_admin(self) -> bool:
        return any(r in ("it_admin", "event_admin", "superadmin") for r in self.my_roles())

    def require_event_admin(self) -> None:
        if not self.is_event_admin():
            raise PermissionError(
                "Akun ini belum punya role 'it_admin', 'event_admin', atau 'superadmin', "
                "sehingga Supabase menolak perubahan data event (RLS). "
                "Jalankan sql/event-admin-access.sql di SQL Editor Supabase."
            )

    # ---------- events ----------
    def list_events(self) -> List[Dict[str, Any]]:
        res = (
            self.client.table("events")
            .select("id,nama_event,tanggal_mulai,drive_folder_id")
            .order("tanggal_mulai", desc=True)
            .limit(200)
            .execute()
        )
        return res.data or []

    def upsert_event(
        self, nama: str, deskripsi: str, tanggal: str, event_id: Optional[str] = None
    ) -> Dict[str, Any]:
        self.require_event_admin()
        payload = {"nama_event": nama, "deskripsi": deskripsi or None, "tanggal_mulai": tanggal}
        if event_id:
            res = self.client.table("events").update(payload).eq("id", event_id).select("*").execute()
        else:
            res = self.client.table("events").insert(payload).execute()
        return (res.data or [{}])[0]

    def event_photo_file_ids(self, event_id: str) -> List[str]:
        """Semua drive_file_id foto milik satu event (untuk dihapus di Drive)."""
        res = (
            self.client.table("event_photos")
            .select("drive_file_id")
            .eq("event_id", event_id)
            .limit(5000)
            .execute()
        )
        return [r["drive_file_id"] for r in (res.data or []) if r.get("drive_file_id")]

    def delete_event(self, event_id: str) -> None:
        """Hapus event beserta foto & absensinya (FK ON DELETE CASCADE)."""
        self.require_event_admin()
        self.client.table("events").delete().eq("id", event_id).execute()


    def set_event_folder(self, event_id: str, folder_id: str) -> None:
        self.client.table("events").update({"drive_folder_id": folder_id}).eq(
            "id", event_id
        ).execute()

    def photo_exists(self, drive_file_id: str) -> bool:
        res = (
            self.client.table("event_photos")
            .select("id")
            .eq("drive_file_id", drive_file_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    def insert_photo(
        self,
        event_id: str,
        drive_file_id: str,
        drive_view_link: str,
        file_name: str,
        matched_worker_ids: List[str],
    ) -> None:
        self.client.table("event_photos").insert(
            {
                "event_id": event_id,
                "drive_file_id": drive_file_id,
                "drive_view_link": drive_view_link,
                "file_name": file_name,
                "matched_worker_ids": matched_worker_ids,
                "uploaded_by": self.user_id,
            }
        ).execute()
