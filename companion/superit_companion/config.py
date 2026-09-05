import json
import os
from dataclasses import dataclass, asdict, field

from .defaults import DEFAULT_PANEL_URL, DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL

CONFIG_PATH = os.environ.get(
    "SUPERIT_CONFIG",
    os.path.join(os.path.expanduser("~"), ".superit-event-uploader.json"),
)
LEGACY_CONFIG_PATH = os.path.join(os.path.expanduser("~"), ".superit-companion.json")


@dataclass
class Config:
    """Konfigurasi aplikasi.

    URL & anon key Supabase otomatis mengikuti web app (lihat defaults.py),
    jadi user hanya perlu login dengan akun admin panel.
    """

    supabase_url: str = field(default=DEFAULT_SUPABASE_URL)
    supabase_anon_key: str = field(default=DEFAULT_SUPABASE_ANON_KEY)
    admin_email: str = ""
    admin_password: str = ""
    drive_root_folder: str = "SUPER IT DATA"
    match_threshold: float = 0.6
    match_count: int = 5
    panel_url: str = field(default=DEFAULT_PANEL_URL)

    @classmethod
    def _from_raw(cls, raw: dict) -> "Config":
        known = {k: v for k, v in raw.items() if k in cls.__annotations__}
        cfg = cls(**known)
        # Selalu ikuti konfigurasi web app bila kosong.
        if not cfg.supabase_url:
            cfg.supabase_url = DEFAULT_SUPABASE_URL
        if not cfg.supabase_anon_key:
            cfg.supabase_anon_key = DEFAULT_SUPABASE_ANON_KEY
        if not cfg.panel_url:
            cfg.panel_url = DEFAULT_PANEL_URL
        return cfg

    @classmethod
    def load(cls) -> "Config":
        for path in (CONFIG_PATH, LEGACY_CONFIG_PATH):
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as fh:
                        return cls._from_raw(json.load(fh))
                except (OSError, ValueError):
                    continue
        local = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.json")
        if os.path.exists(local):
            try:
                with open(local, "r", encoding="utf-8") as fh:
                    return cls._from_raw(json.load(fh))
            except (OSError, ValueError):
                pass
        return cls()

    def save(self) -> None:
        with open(CONFIG_PATH, "w", encoding="utf-8") as fh:
            json.dump(asdict(self), fh, indent=2)
        try:
            os.chmod(CONFIG_PATH, 0o600)
        except OSError:
            pass
