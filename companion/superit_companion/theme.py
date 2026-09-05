"""Tema visual mengikuti web app SuperIT (Dark Blue Metallic)."""

from tkinter import ttk

BG = "#131a29"
SURFACE = "#1b2334"
CARD = "#222c40"
FG = "#f1f4fa"
MUTED = "#9fabbd"
BORDER = "#35415a"
PRIMARY = "#3f7fd0"
PRIMARY_HOVER = "#4d8ee0"
PRIMARY_FG = "#ffffff"
SECONDARY = "#2b3549"
ACCENT = "#86c2e3"
SUCCESS = "#3ecfae"
DANGER = "#e2606a"

FONT = ("Segoe UI", 10)
FONT_BOLD = ("Segoe UI", 10, "bold")
FONT_TITLE = ("Segoe UI", 15, "bold")
FONT_MONO = ("Consolas", 9)


def apply_theme(root) -> ttk.Style:
    """Terapkan palet gelap web app ke seluruh widget ttk."""
    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except Exception:  # noqa: BLE001
        pass

    root.configure(bg=BG)

    style.configure(".", background=BG, foreground=FG, font=FONT, borderwidth=0)
    style.configure("TFrame", background=BG)
    style.configure("Card.TFrame", background=CARD)
    style.configure("TLabel", background=BG, foreground=FG, font=FONT)
    style.configure("Card.TLabel", background=CARD, foreground=FG)
    style.configure("Title.TLabel", background=BG, foreground=FG, font=FONT_TITLE)
    style.configure("Muted.TLabel", background=BG, foreground=MUTED)
    style.configure("CardMuted.TLabel", background=CARD, foreground=MUTED)
    style.configure("Accent.TLabel", background=BG, foreground=ACCENT, font=FONT_BOLD)

    style.configure(
        "TNotebook", background=BG, borderwidth=0, tabmargins=(6, 6, 6, 0)
    )
    style.configure(
        "TNotebook.Tab",
        background=SURFACE,
        foreground=MUTED,
        padding=(16, 9),
        font=FONT_BOLD,
        borderwidth=0,
    )
    style.map(
        "TNotebook.Tab",
        background=[("selected", PRIMARY), ("active", SECONDARY)],
        foreground=[("selected", PRIMARY_FG), ("active", FG)],
    )

    style.configure(
        "TEntry",
        fieldbackground=SURFACE,
        background=SURFACE,
        foreground=FG,
        insertcolor=FG,
        bordercolor=BORDER,
        lightcolor=BORDER,
        darkcolor=BORDER,
        borderwidth=1,
        padding=7,
    )
    style.map("TEntry", bordercolor=[("focus", PRIMARY)])

    style.configure(
        "TSpinbox",
        fieldbackground=SURFACE,
        background=SURFACE,
        foreground=FG,
        arrowcolor=FG,
        bordercolor=BORDER,
        borderwidth=1,
        padding=5,
    )
    style.configure(
        "TCombobox",
        fieldbackground=SURFACE,
        background=SURFACE,
        foreground=FG,
        arrowcolor=FG,
        bordercolor=BORDER,
        borderwidth=1,
        padding=6,
    )
    style.map(
        "TCombobox",
        fieldbackground=[("readonly", SURFACE)],
        foreground=[("readonly", FG)],
        bordercolor=[("focus", PRIMARY)],
    )
    root.option_add("*TCombobox*Listbox.background", SURFACE)
    root.option_add("*TCombobox*Listbox.foreground", FG)
    root.option_add("*TCombobox*Listbox.selectBackground", PRIMARY)
    root.option_add("*TCombobox*Listbox.selectForeground", PRIMARY_FG)

    style.configure(
        "TButton",
        background=SECONDARY,
        foreground=FG,
        font=FONT_BOLD,
        padding=(14, 8),
        borderwidth=0,
        focusthickness=0,
    )
    style.map("TButton", background=[("active", BORDER)])

    style.configure(
        "Primary.TButton",
        background=PRIMARY,
        foreground=PRIMARY_FG,
        font=FONT_BOLD,
        padding=(16, 9),
        borderwidth=0,
    )
    style.map("Primary.TButton", background=[("active", PRIMARY_HOVER)])

    style.configure(
        "Danger.TButton", background=DANGER, foreground="#ffffff", padding=(14, 8), borderwidth=0
    )
    style.map("Danger.TButton", background=[("active", "#f0757e")])

    style.configure(
        "TProgressbar",
        background=PRIMARY,
        troughcolor=SURFACE,
        bordercolor=SURFACE,
        lightcolor=PRIMARY,
        darkcolor=PRIMARY,
        thickness=8,
    )
    style.configure("TSeparator", background=BORDER)
    return style
