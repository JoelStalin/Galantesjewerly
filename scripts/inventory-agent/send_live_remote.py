#!/usr/bin/env python3
"""
send_live_remote.py
Direct controller for live WhatsApp browser on galantes-prod-vm port 4000.
"""

import urllib.request
import json
import time
import sys

BASE_URL = "http://127.0.0.1:4000"

def post(endpoint, data):
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/{endpoint}",
        data=payload,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": str(len(payload))
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTPError {e.code}: {body}")
        raise

def get(endpoint):
    with urllib.request.urlopen(f"{BASE_URL}/{endpoint}", timeout=20) as resp:
        return resp.read()

def save_frame(out_path="/tmp/live_frame.jpg"):
    frame = get("frame")
    with open(out_path, "wb") as f:
        f.write(frame)
    print(f"Saved frame: {len(frame)} bytes")

def eval_js(js_code):
    return post("action", {"action": "eval", "code": js_code})

def open_and_send(target_query, message_text):
    print(f"Finding coordinates for '{target_query}'...")
    # Scroll chat into view and get visible coordinates
    find_js = f"""(() => {{
        const spans = Array.from(document.querySelectorAll('#pane-side span[title]'));
        const s = spans.find(el => el.getAttribute('title') && el.getAttribute('title').toLowerCase().includes('{target_query.lower()}'));
        if (!s) return {{ found: false }};
        const row = s.closest('div[role="listitem"]') || s.closest('div[role="row"]') || s.closest('div[tabindex="-1"]') || s;
        row.scrollIntoView({{ behavior: 'instant', block: 'center' }});
        row.click();
        const r = row.getBoundingClientRect();
        return {{
            found: true,
            title: s.getAttribute('title'),
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2)
        }};
    }})()"""
    res = eval_js(find_js)
    print("Find result:", json.dumps(res, indent=2))
    item = res.get("result", {})
    if not item.get("found"):
        raise RuntimeError(f"Chat '{target_query}' not found in active list")

    x, y = item["x"], item["y"]
    print(f"Clicking at ({x}, {y}) to open chat '{item.get('title')}'...")
    post("click", {"x": x, "y": y})
    time.sleep(2)

    # If composer not found yet, try searching chat in search bar
    check_main_js = """(() => {
        const editable = document.querySelector('#main div[contenteditable="true"], footer div[contenteditable="true"], div[data-testid="conversation-compose-box-input"]');
        return Boolean(editable);
    })()"""
    has_comp = eval_js(check_main_js).get("result", False)
    if not has_comp:
        print("Composer not immediately found. Searching chat name in search input...")
        search_js = f"""(() => {{
            const searchInput = document.querySelector('div[contenteditable="true"][data-tab="3"], input[data-tab="3"], #side div[contenteditable="true"]');
            if (searchInput) {{
                searchInput.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                document.execCommand('insertText', false, '{target_query}');
                return true;
            }}
            return false;
        }})()"""
        eval_js(search_js)
        time.sleep(1.5)
        post("type", {"key": "Enter"})
        time.sleep(2)

    # Inspect composer in #main or footer
    comp_js = """(() => {
        const editable = document.querySelector('#main div[contenteditable="true"], footer div[contenteditable="true"], div[data-testid="conversation-compose-box-input"], div[contenteditable="true"][data-tab="10"]');
        if (!editable) {
            const allEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]')).map(e => ({
                tab: e.getAttribute('data-tab'),
                parent: e.parentElement ? e.parentElement.tagName : null
            }));
            return { found: false, editables: allEditables };
        }
        const r = editable.getBoundingClientRect();
        editable.focus();
        return {
            found: true,
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2)
        };
    })()"""
    comp_res = eval_js(comp_js)
    print("Composer check:", json.dumps(comp_res, indent=2))
    comp_info = comp_res.get("result", {})
    if not comp_info.get("found"):
        raise RuntimeError("Composer not found after clicking chat")

    # Click composer
    cx, cy = comp_info["x"], comp_info["y"]
    print(f"Clicking composer at ({cx}, {cy})...")
    post("click", {"x": cx, "y": cy})
    time.sleep(0.5)

    # Insert text into composer via execCommand insertText and insertLineBreak
    escaped_text = json.dumps(message_text)
    type_js = f"""(() => {{
        const editable = document.querySelector('#main div[contenteditable="true"], footer div[contenteditable="true"], div[data-testid="conversation-compose-box-input"], div[contenteditable="true"][data-tab="10"]');
        if (!editable) return false;
        editable.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        const lines = {escaped_text}.split('\\n');
        for (let i = 0; i < lines.length; i++) {{
            if (lines[i]) document.execCommand('insertText', false, lines[i]);
            if (i < lines.length - 1) {{
                document.execCommand('insertLineBreak');
            }}
        }}
        return true;
    }})()"""
    eval_js(type_js)
    time.sleep(1)

    # Press Enter to send
    print("Pressing Enter to send message...")
    post("type", {"key": "Enter"})
    time.sleep(2)

    save_frame()
    print("Message dispatched successfully!")
    return True

def view_chat(target_query):
    print(f"Viewing chat '{target_query}'...")
    find_js = f"""(() => {{
        const spans = Array.from(document.querySelectorAll('#pane-side span[title]'));
        const s = spans.find(el => el.getAttribute('title') && el.getAttribute('title').toLowerCase().includes('{target_query.lower()}'));
        if (!s) return {{ found: false }};
        const row = s.closest('div[role="listitem"]') || s.closest('div[role="row"]') || s.closest('div[tabindex="-1"]') || s;
        row.scrollIntoView({{ behavior: 'instant', block: 'center' }});
        row.click();
        const r = row.getBoundingClientRect();
        return {{
            found: true,
            title: s.getAttribute('title'),
            x: Math.round(r.left + r.width / 2),
            y: Math.round(r.top + r.height / 2)
        }};
    }})()"""
    res = eval_js(find_js)
    item = res.get("result", {})
    if not item.get("found"):
        raise RuntimeError(f"Chat '{target_query}' not found")
    post("click", {"x": item["x"], "y": item["y"]})
    time.sleep(2)
    save_frame()
    print("Frame saved successfully for chat:", target_query)

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "send_backlog"

    if cmd == "send_backlog":
        target = "Galantesbacklog"
        text = (
            "👑 *Galantes Backlog - Nueva Joya para Revision*\n\n"
            "• *Titulo:* 14K White Gold Solitaire Ring with Diamonds\n"
            "• *SKU:* GAL-1044\n"
            "• *Precio:* $499.00 USD (Intacto)\n"
            "• *Stock:* 1 unit (Intacto)\n"
            "• *Materiales:* 14K White Gold, 0.25 Ct G-SI, Size 4, 2.3g (Intacto)\n"
            "• *Categoria:* Rings (Actualizado)\n\n"
            "🔗 *Link en Tienda:*\n"
            "https://galantesjewelry.com/shop/the-islamorada-solitaire\n\n"
            "👉 *Accion requerida:* Responde *1* para Confirmar y Actualizar, *2* para Asignar a otra variante, o *3* para Descartar."
        )
        open_and_send(target, text)

    elif cmd == "send_customer":
        target = "Galante Danielo"
        text = (
            "💎 *Galante Assistant - Inventario Actualizado*\n\n"
            "Estimado cliente, la joya ha sido identificada y actualizada en el catalogo online:\n\n"
            "• *Titulo:* 14K White Gold Solitaire Ring with Diamonds\n"
            "• *SKU:* GAL-1044\n"
            "• *Precio:* $499.00 USD\n"
            "• *Stock Disponible:* 1 unit\n"
            "• *Materiales:* 14K White Gold, 0.25 Ct G-SI, Size 4, 2.3g\n"
            "• *Categoria:* Rings\n\n"
            "🔗 *Ver producto en vivo en tienda:*\n"
            "https://galantesjewelry.com/shop/the-islamorada-solitaire"
        )
        open_and_send(target, text)

    elif cmd == "view_backlog":
        view_chat("Galantesbacklog")

    elif cmd == "view_galantesjewelry":
        view_chat("Galantesjewelry")

    elif cmd == "view_danielo":
        view_chat("Galante Danielo")

    elif cmd == "inspect_danielo":
        view_chat("Galante Danielo")
        info_js = """(() => {
            const h = document.querySelector('#main header');
            const title = h ? h.querySelector('span[title]') : null;
            const subtitle = h ? h.querySelectorAll('span') : [];
            const textLines = Array.from(subtitle).map(s => s.innerText).filter(Boolean);
            return {
                title: title ? title.getAttribute('title') : null,
                textLines
            };
        })()"""
        print(json.dumps(eval_js(info_js), indent=2))

    elif cmd == "paste_image_backlog":
        # 1. Dismiss any open modal
        post("type", {"key": "Escape"})
        time.sleep(1)
        post("type", {"key": "Escape"})
        time.sleep(1)

        # 2. Open chat
        view_chat("Galantesbacklog")
        time.sleep(1)

        # 3. Read image as base64
        import base64
        with open("/tmp/review_collage.jpg", "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")

        # 4. Inject Paste & Drop event
        paste_js = f"""(async () => {{
            const composer = document.querySelector('#main div[contenteditable="true"]');
            const main = document.querySelector('#main');
            if (!composer || !main) return {{ ok: false, error: 'no composer or main' }};

            const binary = atob('{b64_data}');
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
            const blob = new Blob([array], {{ type: 'image/jpeg' }});
            const file = new File([blob], 'similarities_review.jpg', {{ type: 'image/jpeg' }});

            const dt = new DataTransfer();
            dt.items.add(file);

            composer.focus();
            const pasteEvt = new ClipboardEvent('paste', {{
                bubbles: true,
                cancelable: true,
                clipboardData: dt
            }});
            composer.dispatchEvent(pasteEvt);

            const dropEvt = new DragEvent('drop', {{
                bubbles: true,
                cancelable: true,
                dataTransfer: dt
            }});
            main.dispatchEvent(dropEvt);

            return {{ ok: true, dispatched: true }};
        }})()"""
        print("Dispatching paste/drop event...")
        res = eval_js(paste_js)
        print("Paste result:", json.dumps(res, indent=2))
        time.sleep(3)
        save_frame()

        # Check if media preview opened
        check_send_js = """(() => {
            const sendBtn = document.querySelector('span[data-icon="send"], div[aria-label="Send"], span[data-icon="send-light"]');
            if (sendBtn) {
                (sendBtn.closest('div[role="button"]') || sendBtn).click();
                return { sent: true };
            }
            return { sent: false };
        })()"""
        send_res = eval_js(check_send_js)
        print("Send check:", json.dumps(send_res, indent=2))
        if not send_res.get("result", {}).get("sent"):
            print("Pressing Enter to send...")
            post("type", {"key": "Enter"})
        time.sleep(3)
        save_frame()

    elif cmd == "send_interactive_backlog_question":
        # Dismiss any open modal first
        post("type", {"key": "Escape"})
        time.sleep(1)
        post("type", {"key": "Escape"})
        time.sleep(1)

        target = "Galantesbacklog"
        text = (
            "👑 *Galantes Backlog - Verificación de Joya Detectada*\n\n"
            "📸 *Foto analizada:* Sortija de compromiso en oro blanco 14K con diamante solitario\n"
            "🔍 *Coincidencia visual:* 88.4% con SKU *GAL-1044*\n"
            "🔗 *Ficha actual en tienda:*\n"
            "https://galantesjewelry.com/shop/the-islamorada-solitaire\n\n"
            "*Propuesta de actualización de inventario:*\n"
            "• *Título (EN):* 14K White Gold Solitaire Ring with Diamonds (A actualizar)\n"
            "• *Categoría:* Rings (A actualizar)\n"
            "• *Precio:* $499.00 USD (Intacto - No modificar)\n"
            "• *Stock disponible:* 1 unit (Intacto - No modificar)\n"
            "• *Materiales:* 14K White Gold, 0.25 Ct G-SI, Size 4, 2.3g (Intacto)\n"
            "• *Imagen de catálogo:* Se conserva la foto profesional de Google Drive (no se crea producto vacío ni sin imagen).\n\n"
            "¿Cómo deseas proceder con este producto?\n\n"
            "1️⃣ *Opción 1: Confirmar y Actualizar*\n"
            "   Modificar únicamente el título y la categoría del producto existente GAL-1044 y notificar al cliente.\n\n"
            "2️⃣ *Opción 2: Asignar a otra variante*\n"
            "   Vincular como variante al SKU alternativo *GAL-1041* (76.2% similitud).\n\n"
            "3️⃣ *Opción 3: Descartar subida*\n"
            "   No aplicar ningún cambio a este producto.\n\n"
            "✍️ *Opción personalizada:*\n"
            "   Escribe directamente tu instrucción (ej: *\"Asignar a SKU GAL-1080\"* o *\"Ajustar categoría a Fine Rings\"*)."
        )
        open_and_send(target, text)

    elif cmd == "open_attach_menu":
        view_chat("Galantesbacklog")
        click_attach = """(() => {
            const btn = document.querySelector('button[aria-label="Attach"], button[title="Attach"], span[data-icon="plus"]');
            if (btn) {
                (btn.closest('button') || btn).click();
                return { clicked: true };
            }
            return { clicked: false };
        })()"""
        res = eval_js(click_attach)
        print("Attach click result:", json.dumps(res, indent=2))
        time.sleep(1.5)
        inspect_menu = """(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]')).map((i, idx) => ({
                idx,
                accept: i.getAttribute('accept'),
                style: i.getAttribute('style'),
                className: i.className,
                parentTag: i.parentElement ? i.parentElement.tagName : null
            }));
            const menuItems = Array.from(document.querySelectorAll('ul li, div[role="menuitem"], li span')).map(el => el.innerText).filter(Boolean);
            return { inputs, menuItems };
        })()"""
        menu_res = eval_js(inspect_menu)
        print("Menu inspect:", json.dumps(menu_res, indent=2))
        save_frame()

    elif cmd == "inspect_galantesjewelry":
        view_chat("Galantesjewelry")
        info_js = """(() => {
            const h = document.querySelector('#main header');
            const title = h ? h.querySelector('span[title]') : null;
            const subtitle = h ? h.querySelectorAll('span') : [];
            const textLines = Array.from(subtitle).map(s => s.innerText).filter(Boolean);
            const messages = Array.from(document.querySelectorAll('#main div.copyable-text')).slice(-5).map(m => m.innerText);
            return {
                title: title ? title.getAttribute('title') : null,
                textLines,
                messages
            };
        })()"""
        print(json.dumps(eval_js(info_js), indent=2))

    elif cmd == "get_chats":
        res = post("action", {"action": "get_chats"})
        print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
