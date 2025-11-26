import tkinter as tk
from tkinter import ttk, messagebox
import threading
import psycopg2
import webview
from PIL import Image, ImageTk
import requests
from io import BytesIO
import webbrowser

# ============================================================
#   CONFIG DB
# ============================================================
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "ai_med_db",
    "user": "postgres",
    "password": "root"
}

def db_connect():
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        messagebox.showerror("DB Error", str(e))
        return None


# ============================================================
#   COLORS
# ============================================================
BG1 = "#0b1220"
BG2 = "#0a1730"
CARD = "#1a2333"
TEXT = "#e6f0ff"
MUTED = "#9bb3d1"
PRIMARY = "#52e5ff"
DANGER = "#ff5c7c"


# ============================================================
#   FILE PREVIEW
# ============================================================
def open_preview(url, tipo):
    modal = tk.Toplevel()
    modal.title("Vista de archivo")
    modal.geometry("700x600")
    modal.configure(bg=BG2)

    tk.Label(modal, text=tipo, fg=TEXT, bg=BG2,
             font=("Segoe UI", 18, "bold")).pack(pady=10)

    if tipo.lower() in ["imagen", "jpg", "png", "jpeg"]:
        try:
            img_data = requests.get(url).content
            img = Image.open(BytesIO(img_data))
            img = img.resize((650, 500))
            img_tk = ImageTk.PhotoImage(img)

            label = tk.Label(modal, image=img_tk, bg=BG2)
            label.image = img_tk
            label.pack()
        except:
            tk.Label(modal, text="No se pudo cargar la imagen.",
                     fg=TEXT, bg=BG2).pack(pady=30)

    else:
        tk.Label(modal, text="No se puede renderizar PDF aquí.\nAbriré el archivo en el navegador.",
                 fg=TEXT, bg=BG2, font=("Segoe UI", 14)).pack(pady=30)
        tk.Button(modal, text="Abrir PDF", bg=PRIMARY, fg="black",
                  command=lambda: webbrowser.open(url),
                  padx=20, pady=10).pack()


# ============================================================
#   LOGIN
# ============================================================
def validate_user(username, password):
    conn = db_connect()
    if not conn:
        return None, "No se pudo conectar a la base de datos."

    cur = conn.cursor()

    cur.execute("""
        SELECT id, username, rol_id FROM usuario
        WHERE username = %s AND password_hash = %s
    """, (username, password))

    row = cur.fetchone()
    conn.close()

    if not row:
        return None, "Usuario o contraseña incorrectos."

    return {"id": row[0], "username": row[1], "rol": row[2]}, None


def get_patient_by_user(user_id):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, fecha_nacimiento, sexo, altura, peso,
               estilo_vida, id_tipo_sangre, id_ocupacion,
               id_estado_civil, id_medico_gen
        FROM paciente
        WHERE usuario_id = %s
    """, (user_id,))

    row = cur.fetchone()
    conn.close()

    if not row:
        return None
    return {
        "id": row[0],
        "fecha_nac": str(row[1]),
        "sexo": row[2],
        "altura": str(row[3]),
        "peso": str(row[4]),
        "estilo": row[5],
        "tipo_sangre": row[6],
        "ocupacion": row[7],
        "estado_civil": row[8],
        "medico_gen": row[9]
    }


def get_general_info(patient_id):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT u.correo, u.telefono
        FROM usuario u 
        JOIN paciente p ON p.usuario_id = u.id
        WHERE p.id = %s
    """, (patient_id,))
    u = cur.fetchone()

    cur.execute("""
        SELECT tipo FROM tipo_sangre WHERE id = (
            SELECT id_tipo_sangre FROM paciente WHERE id = %s
        );
    """, (patient_id,))
    sangre = (cur.fetchone() or ["N/A"])[0]

    cur.execute("""
        SELECT nombre FROM ocupacion WHERE id = (
            SELECT id_ocupacion FROM paciente WHERE id = %s
        );
    """, (patient_id,))
    ocup = (cur.fetchone() or ["N/A"])[0]

    cur.execute("""
        SELECT nombre FROM estado_civil WHERE id = (
            SELECT id_estado_civil FROM paciente WHERE id = %s
        );
    """, (patient_id,))
    civil = (cur.fetchone() or ["N/A"])[0]

    cur.execute("""
        SELECT calle, numero_ext, numero_int
        FROM direccion_paciente
        WHERE paciente_id = %s
    """, (patient_id,))
    d = cur.fetchone()

    conn.close()

    return {
        "Correo": u[0] if u else "N/A",
        "Teléfono": u[1] if u else "N/A",
        "Tipo de Sangre": sangre,
        "Ocupación": ocup,
        "Estado Civil": civil,
        "Dirección": f"{d[0]} #{d[1]} Int:{d[2]}" if d else "N/A"
    }


def get_files(patient_id):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT a.tipo, a.url, aa.descripcion
        FROM archivo_asociacion aa
        JOIN archivo a ON a.id = aa.archivo_id
        WHERE aa.entidad = 'paciente' AND aa.entidad_id = %s
    """, (patient_id,))

    rows = cur.fetchall()
    conn.close()

    return [(desc or "Archivo", tipo, url) for tipo, url, desc in rows]


# ============================================================
#   DASHBOARD
# ============================================================
def show_dashboard(root, user, paciente):

    for w in root.winfo_children():
        w.destroy()

    root.configure(bg=BG1)

    # Avatar stays in main thread, Tkinter is already running here

    # LEFT PANEL w/ scroll
    main_frame = tk.Frame(root, bg=CARD)
    main_frame.pack(fill="both", expand=True)

    canvas = tk.Canvas(main_frame, bg=CARD, highlightthickness=0)
    canvas.pack(side="left", fill="both", expand=True)

    scrollbar = tk.Scrollbar(main_frame, orient="vertical", command=canvas.yview)
    scrollbar.pack(side="right", fill="y")
    canvas.configure(yscrollcommand=scrollbar.set)

    scroll_frame = tk.Frame(canvas, bg=CARD)
    canvas.create_window((0, 0), window=scroll_frame, anchor="nw")

    def update_region(e):
        canvas.configure(scrollregion=canvas.bbox("all"))
    scroll_frame.bind("<Configure>", update_region)

    def wheel(e):
        canvas.yview_scroll(int(-e.delta / 120), "units")
    canvas.bind_all("<MouseWheel>", wheel)

    # TABS
    active_tab = tk.StringVar(value="paciente")

    tab_frame = tk.Frame(scroll_frame, bg=CARD)
    tab_frame.pack(fill="x", pady=10, padx=15)

    def switch(tab):
        active_tab.set(tab)
        draw()

    tk.Button(tab_frame, text="Paciente", fg=TEXT, bg=BG2, relief="flat",
              font=("Segoe UI", 13), padx=20, pady=8,
              command=lambda: switch("paciente")).pack(side="left", padx=5)

    tk.Button(tab_frame, text="Partes", fg=TEXT, bg=BG2, relief="flat",
              font=("Segoe UI", 13), padx=20, pady=8,
              command=lambda: switch("partes")).pack(side="left", padx=5)

    # Content
    content = tk.Frame(scroll_frame, bg=CARD)
    content.pack(fill="both", expand=True)

    def clear():
        for w in content.winfo_children():
            w.destroy()

    def draw():
        clear()

        if active_tab.get() == "paciente":
            # Title
            tk.Label(content, text="Información del Paciente",
                     fg=TEXT, bg=CARD,
                     font=("Segoe UI", 22, "bold")).pack(anchor="w", pady=10)

            # Summary
            card = tk.Frame(content, bg=BG2, bd=1, relief="solid")
            card.pack(fill="x", pady=10)

            tk.Label(card, text=f"Sexo: {paciente['sexo']}",
                     fg=TEXT, bg=BG2, font=("Segoe UI", 13)).pack(anchor="w", pady=3)
            tk.Label(card, text=f"Fecha de Nacimiento: {paciente['fecha_nac']}",
                     fg=TEXT, bg=BG2, font=("Segoe UI", 13)).pack(anchor="w", pady=3)
            tk.Label(card, text=f"Altura: {paciente['altura']} cm",
                     fg=TEXT, bg=BG2, font=("Segoe UI", 13)).pack(anchor="w", pady=3)
            tk.Label(card, text=f"Peso: {paciente['peso']} kg",
                     fg=TEXT, bg=BG2, font=("Segoe UI", 13)).pack(anchor="w", pady=3)

            # General Info
            info = get_general_info(paciente["id"])

            tk.Label(content, text="Información General",
                     fg=TEXT, bg=CARD, font=("Segoe UI", 18, "bold")
                     ).pack(anchor="w", pady=15)

            grid = tk.Frame(content, bg=CARD)
            grid.pack(fill="x")

            r = 0
            for k, v in info.items():
                tk.Label(grid, text=k, fg=MUTED, bg=CARD,
                         font=("Segoe UI", 12)
                         ).grid(row=r, column=0, sticky="w", pady=3)
                tk.Label(grid, text=v, fg=TEXT, bg=CARD,
                         font=("Segoe UI", 14, "bold")
                         ).grid(row=r, column=1, sticky="w", pady=3, padx=20)
                r += 1

        else:
            tk.Label(content, text="Archivos Médicos",
                     fg=TEXT, bg=CARD, font=("Segoe UI", 22, "bold")).pack(anchor="w", pady=10)

            files = get_files(paciente["id"])

            if not files:
                tk.Label(content, text="No hay archivos asociados.",
                         fg=MUTED, bg=CARD, font=("Segoe UI", 13)
                         ).pack(anchor="w", pady=10)
            else:
                for name, tipo, url in files:
                    f = tk.Frame(content, bg=BG2, bd=1, relief="solid")
                    f.pack(fill="x", pady=8)

                    tk.Label(f, text=f"{tipo} – {name}", fg=TEXT, bg=BG2,
                             font=("Segoe UI", 13)).pack(anchor="w", padx=15, pady=8)

                    tk.Button(f, text="Ver archivo", bg=PRIMARY, fg="black",
                              command=lambda u=url, t=tipo: open_preview(u, t),
                              padx=15, pady=8
                              ).pack(anchor="e", padx=15, pady=8)

    draw()


# ============================================================
#   SHOW LOGIN
# ============================================================
def show_login(root):

    for w in root.winfo_children():
        w.destroy()

    root.configure(bg=BG1)

    frame = tk.Frame(root, bg=CARD, bd=2, relief="solid")
    frame.place(relx=0.5, rely=0.5, anchor="center", width=420, height=360)

    tk.Label(frame, text="Iniciar Sesión", fg=TEXT, bg=CARD,
             font=("Segoe UI", 22, "bold")).pack(pady=20)

    tk.Label(frame, text="Usuario:", fg=TEXT, bg=CARD, font=("Segoe UI", 12)).pack()
    e_user = tk.Entry(frame, width=28, font=("Segoe UI", 12))
    e_user.pack()

    tk.Label(frame, text="Contraseña:", fg=TEXT, bg=CARD, font=("Segoe UI", 12)).pack(pady=5)
    e_pass = tk.Entry(frame, width=28, font=("Segoe UI", 12), show="•")
    e_pass.pack()

    def login():
        user, error = validate_user(e_user.get(), e_pass.get())

        if error:
            messagebox.showerror("Error", error)
            return

        paciente = get_patient_by_user(user["id"])
        if not paciente:
            messagebox.showerror("Error", "Este usuario no es un paciente.")
            return

        show_dashboard(root, user, paciente)

    tk.Button(frame, text="Ingresar", bg=PRIMARY, fg="black",
              font=("Segoe UI", 13), pady=6, width=18,
              command=login).pack(pady=25)


# ============================================================
#   TKINTER THREAD + AVATAR MAIN
# ============================================================
def start_tk():
    root = tk.Tk()
    root.title("Portal del Paciente")
    root.geometry("1500x900")
    show_login(root)
    root.mainloop()


AVATAR_URL = "https://stunning-crisp-51ccb2.netlify.app/"

def run_avatar():
    webview.create_window("Avatar Médico", AVATAR_URL,
                          width=600, height=650,
                          background_color="#000000")
    webview.start(gui="edgechromium")


# Start Tkinter in thread
threading.Thread(target=start_tk, daemon=True).start()

# Avatar in main thread
run_avatar()
