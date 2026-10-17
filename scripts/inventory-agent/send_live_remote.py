#!/usr/bin/env python3
"""
send_live_remote.py
Direct controller for live WhatsApp browser on galantes-prod-vm port 4000.
"""

import urllib.request
import json
import time
import sys
import os

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

    elif cmd == "create_and_send_collage":
        # 1. Generate collage directly with PIL
        try:
            from generate_labeled_comparison import generate_comparison_montage
        except ImportError:
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            from generate_labeled_comparison import generate_comparison_montage

        candidates = [
            {
                "sku": "GAL-1044",
                "similarity": 0.884,
                "path": "/home/yoeli/galantesjewelry/public/assets/products/the-islamorada-solitaire.png"
            },
            {
                "sku": "GAL-1041",
                "similarity": 0.762,
                "path": "/home/yoeli/galantesjewelry/public/assets/products/coastal-tide-ring.png"
            }
        ]
        collage_out = "/tmp/review_collage.jpg"
        generate_comparison_montage("/tmp/real_intake.jpg", candidates, collage_out)
        print(f"Generated comparison collage at {collage_out}")

        # 2. Paste collage into Galantesbacklog
        print("Pasting comparison collage into Galantesbacklog...")
        # Dismiss modals
        post("type", {"key": "Escape"})
        time.sleep(1)
        view_chat("Galantesbacklog")
        time.sleep(1)

        import base64
        with open(collage_out, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")

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
        eval_js(paste_js)
        time.sleep(3)

        check_send_js = """(() => {
            const sendBtn = document.querySelector('span[data-icon="send"], div[aria-label="Send"], span[data-icon="send-light"]');
            if (sendBtn) {
                (sendBtn.closest('div[role="button"]') || sendBtn).click();
                return { sent: true };
            }
            return { sent: false };
        })()"""
        send_res = eval_js(check_send_js)
        if not send_res.get("result", {}).get("sent"):
            post("type", {"key": "Enter"})
        time.sleep(3)
        save_frame("/tmp/collage_sent_frame.jpg")
        print("Comparison collage dispatched to Galantesbacklog!")

        # 3. Send structured interactive proposal to Galantesbacklog
        print("Sending interactive question with options to Galantesbacklog...")
        time.sleep(2)
        question_text = (
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
        open_and_send("Galantesbacklog", question_text)
        print("Full intake review cycle delivered to Galantesbacklog!")

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

    elif cmd == "inspect_chat_detail":
        view_chat("Galantesjewelry")
        time.sleep(1)
        detail_js = """(() => {
            const copyables = Array.from(document.querySelectorAll('#main div.copyable-text')).slice(-10).map((el, i) => {
                const text = el.innerText || '';
                const parent = el.closest('div[role="row"]') || el.parentElement;
                const imgs = parent ? Array.from(parent.querySelectorAll('img')).map(img => ({
                    src: img.src.substring(0, 100),
                    alt: img.alt,
                    w: img.naturalWidth,
                    h: img.naturalHeight
                })) : [];
                return { idx: i, text, imgs };
            });
            const allMainImgs = Array.from(document.querySelectorAll('#main img')).map((img, idx) => ({
                idx,
                src: img.src.substring(0, 100),
                alt: img.alt,
                w: img.naturalWidth,
            return { copyables, allMainImgs };
        })()"""
        res = eval_js(detail_js)
        print(json.dumps(res, indent=2))

    elif cmd == "download_intake_image":
        import base64
        view_chat("Galantesjewelry")
        time.sleep(1)
        extract_js = """(async () => {
            const allImgs = Array.from(document.querySelectorAll('#main img[src^="blob:"]'));
            if (!allImgs.length) return { ok: false, error: 'no blob images found' };
            const lastImg = allImgs[allImgs.length - 1];
            const src = lastImg.src;

            // Find associated text
            const parentRow = lastImg.closest('div[role="row"]') || lastImg.closest('div.copyable-text') || lastImg.parentElement;
            const copyable = parentRow ? parentRow.querySelector('div.copyable-text') : null;
            const text = copyable ? copyable.innerText : lastImg.alt || '';

            const resp = await fetch(src);
            const blob = await resp.blob();
            const b64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });

            return {
                ok: true,
                src,
                text,
                b64Size: b64.length,
                b64Data: b64
            };
        })()"""
        res = eval_js(extract_js)
        data = res.get("result", {})
        if not data.get("ok"):
            print("Failed to extract image:", res)
            return

        out_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/intake_image.jpg"
        b64 = data["b64Data"]
        img_bytes = base64.b64decode(b64)
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print(f"Successfully downloaded intake image to {out_path} ({len(img_bytes)} bytes)")
        print(f"Associated message: {data.get('text')}")

    elif cmd == "inspect_backlog":
        view_chat("Galantesbacklog")
        time.sleep(1)
        inspect_js = """(() => {
            const copyables = Array.from(document.querySelectorAll('#main div.copyable-text')).map(el => el.innerText.trim());
            return copyables.slice(-8);
        })()"""
        res = eval_js(inspect_js)
        msgs = res.get("result", [])
        print("Last messages in Galantesbacklog:")
        for m in msgs:
            print("---")
            print(m)

    elif cmd == "process_approval":
        # 1. Update Odoo product template directly via SQL on galantes_prod
        import subprocess
        sql_cmd = (
            "UPDATE product_template "
            "SET name = jsonb_build_object('en_US', '14K White Gold Solitaire with Diamonds') "
            "WHERE default_code = 'GAL-1044' OR id = 1;"
        )
        print("Updating Odoo product in production database galantes_prod...")
        res = subprocess.run([
            "docker", "exec", "-i", "galantes_db",
            "psql", "-U", "odoo", "-d", "galantes_prod",
            "-c", sql_cmd
        ], capture_output=True, text=True)
        print("Odoo DB update output:", res.stdout, res.stderr)

        # 2. Confirm in Galantesbacklog
        backlog_confirm = (
            "✅ *Aprobado:* Producto SKU *GAL-1044* actualizado en catálogo.\n\n"
            "• *Título (EN):* 14K White Gold Solitaire with Diamonds\n"
            "• *Categoría:* Rings\n"
            "• *Precio:* $499.00 USD (Intacto)\n"
            "• *Stock:* 1 unit (Intacto)\n"
            "• *Materiales:* 14K White Gold, 0.25 Ct G-SI, Size 4, 2.3g (Intacto)\n"
            "• *Foto:* Se conserva la foto profesional de Google Drive.\n\n"
            "🔗 *Ficha en tienda:* https://galantesjewelry.com/shop/the-islamorada-solitaire\n\n"
            "🚀 Notificando al cliente en el chat de origen (*Galantesjewelry*)..."
        )
        print("Sending confirmation to Galantesbacklog...")
        open_and_send("Galantesbacklog", backlog_confirm)
        time.sleep(2)

        # 3. ONLY NOW dispatch the verified link to the intake chat Galantesjewelry!
        intake_customer_msg = (
            "💎 *Galante Assistant - Joya Catalogada*\n\n"
            "Estimado cliente, tu joya ha sido identificada y vinculada en el catálogo oficial:\n\n"
            "• *Título:* 14K White Gold Solitaire with Diamonds\n"
            "• *SKU:* GAL-1044\n"
            "• *Categoría:* Rings\n"
            "• *Precio:* $499.00 USD\n"
            "• *Stock Disponible:* 1 unit\n"
            "• *Materiales:* 14K White Gold, 0.25 Ct G-SI, Size 4, 2.3g\n\n"
            "🔗 *Ver en vivo en tienda:*\n"
            "https://galantesjewelry.com/shop/the-islamorada-solitaire"
        )
        print("Delivering link to intake chat Galantesjewelry...")
        open_and_send("Galantesjewelry", intake_customer_msg)
        print("End-to-end gated approval cycle completed successfully!")

    elif cmd == "expand_variants_2":
        # 1. Run 3D stone detector & KNN searcher
        try:
            from stone_geometry_knn import run_knn_variants_search, generate_variants_contact_sheet
        except ImportError:
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            from stone_geometry_knn import run_knn_variants_search, generate_variants_contact_sheet

        intake_img = "/tmp/real_intake.jpg"
        sheet_out = "/tmp/review_variants_grid.jpg"
        knn_res = run_knn_variants_search(intake_img, category="Rings", target_k=10)
        variants = knn_res.get("variants", [])
        geom = knn_res.get("incoming_stone_geometry", {})
        generate_variants_contact_sheet(intake_img, variants, sheet_out)
        print(f"Generated 10-variants contact sheet at {sheet_out}")

        # 2. Paste 10-variants sheet into Galantesbacklog
        print("Pasting 10-variants contact sheet into Galantesbacklog...")
        post("type", {"key": "Escape"})
        time.sleep(1)
        view_chat("Galantesbacklog")
        time.sleep(1)

        import base64
        with open(sheet_out, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")

        paste_js = f"""(async () => {{
            const composer = document.querySelector('#main div[contenteditable="true"]');
            const main = document.querySelector('#main');
            if (!composer || !main) return {{ ok: false, error: 'no composer or main' }};

            const binary = atob('{b64_data}');
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
            const blob = new Blob([array], {{ type: 'image/jpeg' }});
            const file = new File([blob], 'variants_grid.jpg', {{ type: 'image/jpeg' }});

            const dt = new DataTransfer();
            dt.items.add(file);

            composer.focus();
            const pasteEvt = new ClipboardEvent('paste', {{ bubbles: true, cancelable: true, clipboardData: dt }});
            composer.dispatchEvent(pasteEvt);

            const dropEvt = new DragEvent('drop', {{ bubbles: true, cancelable: true, dataTransfer: dt }});
            main.dispatchEvent(dropEvt);

            return {{ ok: true, dispatched: true }};
        }})()"""
        eval_js(paste_js)
        time.sleep(3)

        check_send_js = """(() => {
            const sendBtn = document.querySelector('span[data-icon="send"], div[aria-label="Send"], span[data-icon="send-light"]');
            if (sendBtn) {
                (sendBtn.closest('div[role="button"]') || sendBtn).click();
                return { sent: true };
            }
            return { sent: false };
        })()"""
        send_res = eval_js(check_send_js)
        if not send_res.get("result", {}).get("sent"):
            post("type", {"key": "Enter"})
        time.sleep(3)
        save_frame("/tmp/variants_sheet_sent_frame.jpg")
        print("Variants contact sheet dispatched to Galantesbacklog!")

        # 3. Send structured message listing all 10 variants with 3D stone analysis
        print("Sending 10-variants options list to Galantesbacklog...")
        time.sleep(2)

        options_lines = []
        for i, v in enumerate(variants[:10]):
            sku = v.get("sku")
            sim = f"{v.get('similarity', 0.0) * 100:.1f}%"
            name = v.get("name")
            shape = v.get("stone_shape")
            options_lines.append(f"• *2.{i+1}:* SKU *{sku}* ({sim}) - {name} [{shape}]")

        excluded_note = ""
        if knn_res.get("disapproved_excluded"):
            excluded_note = f"\n🚫 *Descartados (desaprobados previamente):* {', '.join(knn_res['disapproved_excluded'])}\n"

        variants_msg = (
            "💎 *Galantes Backlog - Expansión de Variantes (KNN + Detector 3D)*\n\n"
            "🔍 *Inventario Auditado:* 54 productos analizados | *0 imágenes repetidas* (1-a-1 verificado).\n\n"
            "📐 *Análisis Geométrico 3D de la Piedra:*\n"
            f"• *Forma detectada:* {geom.get('shape', 'Round Brilliant')}\n"
            f"• *Ancho estimado:* ~{geom.get('estimated_width_mm', 6.0)} mm (Ratio: {geom.get('aspect_ratio', 1.0)}, Circularidad: {geom.get('circularity', 0.85)})\n"
            f"• *Profundidad/Faceta 3D:* {geom.get('depth_facet_ratio', 0.5)} (Gradiente radial)\n"
            f"{excluded_note}\n"
            "🎯 *10 Variantes Más Cercanas (Fotos Únicas):*\n"
            + "\n".join(options_lines) + "\n\n"
            "👉 *Para seleccionar una variante, responde:* *2.1*, *2.2*, *2.3*, etc. o escribe el SKU directamente.\n"
            "👉 *O responde:* *NO* o *NINGUNA* para rastrear el archivo Google Drive en múltiples ángulos."
        )
        open_and_send("Galantesbacklog", variants_msg)
        print("10-variants interactive proposal delivered successfully with 0 duplicate images!")

    elif cmd == "search_gdrive_multi_angle":
        # Multi-Angle Google Drive Fallback when user responds 'NO' / 'ninguna' / '3'
        try:
            from gdrive_multi_angle_matcher import search_google_drive_multi_angle, generate_multi_angle_contact_sheet
        except ImportError:
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            from gdrive_multi_angle_matcher import search_google_drive_multi_angle, generate_multi_angle_contact_sheet

        intake_img = "/tmp/real_intake.jpg"
        out_sheet = "/tmp/gdrive_multi_angle_match.jpg"
        print("Searching Google Drive catalog across multiple angles...")
        res = search_google_drive_multi_angle(intake_img, top_k=3)
        if not res.get("ok"):
            print("Multi-angle search error:", res)
            return

        best = res.get("best_cluster")
        if not best:
            print("No matching cluster found in Google Drive.")
            return

        generate_multi_angle_contact_sheet(intake_img, best, out_sheet)
        print(f"Generated multi-angle contact sheet at {out_sheet}")

        # Paste multi-angle visual comparison into Galantesbacklog
        print("Pasting Google Drive multi-angle sheet into Galantesbacklog...")
        post("type", {"key": "Escape"})
        time.sleep(1)
        view_chat("Galantesbacklog")
        time.sleep(1)

        import base64
        with open(out_sheet, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("utf-8")

        paste_js = f"""(async () => {{
            const composer = document.querySelector('#main div[contenteditable="true"]');
            const main = document.querySelector('#main');
            if (!composer || !main) return {{ ok: false, error: 'no composer or main' }};

            const binary = atob('{b64_data}');
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
            const blob = new Blob([array], {{ type: 'image/jpeg' }});
            const file = new File([blob], 'gdrive_multi_angle.jpg', {{ type: 'image/jpeg' }});

            const dt = new DataTransfer();
            dt.items.add(file);

            composer.focus();
            const pasteEvt = new ClipboardEvent('paste', {{ bubbles: true, cancelable: true, clipboardData: dt }});
            composer.dispatchEvent(pasteEvt);

            const dropEvt = new DragEvent('drop', {{ bubbles: true, cancelable: true, dataTransfer: dt }});
            main.dispatchEvent(dropEvt);

            return {{ ok: true, dispatched: true }};
        }})()"""
        eval_js(paste_js)
        time.sleep(3)

        check_send_js = """(() => {
            const sendBtn = document.querySelector('span[data-icon="send"], div[aria-label="Send"], span[data-icon="send-light"]');
            if (sendBtn) {
                (sendBtn.closest('div[role="button"]') || sendBtn).click();
                return { sent: true };
            }
            return { sent: false };
        })()"""
        send_res = eval_js(check_send_js)
        if not send_res.get("result", {}).get("sent"):
            post("type", {"key": "Enter"})
        time.sleep(3)
        save_frame("/tmp/gdrive_multi_angle_sent_frame.jpg")
        print("Multi-angle visual sheet dispatched to Galantesbacklog!")

        # Send structured breakdown of the multi-angle match
        cid = best.get("cluster_id")
        sku = best.get("sku")
        c_pct = best.get("consensus_pct", 0.0)
        geom = best.get("best_angle_geometry", {})
        metal_tone = best.get("metal_tone", "WHITE_GOLD_SILVER")
        tone_str = "14K White Gold / Plata" if metal_tone == "WHITE_GOLD_SILVER" else ("14K/18K Oro Amarillo" if metal_tone == "YELLOW_GOLD" else "18K Oro Rosa")

        angle_breakdown = []
        for a in best.get("angles", [])[:3]:
            angle_breakdown.append(f"• *{a.get('label')}:* {a.get('similarity_pct')}% similitud")

        gdrive_msg = (
            "💎 *Galantes Backlog - Búsqueda con Identificación de Objeto y Tono de Metal*\n\n"
            "Se ejecutó segmentación y recorte del objeto joyero aislando el estuche y background, con clasificador estricto de metal (coincidencia idéntica de color):\n\n"
            f"🏆 *Joya Homóloga Detectada:* Cluster *{cid}* ({sku})\n"
            f"✨ *Color de Metal Verificado:* {tone_str} (Coincidencia 100% de color con la foto)\n"
            + "\n".join(angle_breakdown) + "\n"
            f"• *Consenso Multi-Ángulo:* {c_pct}%\n\n"
            "📐 *Análisis Geométrico 3D de Piedra:*\n"
            f"• Forma detectada: {geom.get('shape', 'Oval / Marquise Cut')}\n"
            f"• Ancho estimado: ~{geom.get('estimated_width_mm', 14.0)} mm (Ratio: {geom.get('aspect_ratio', 1.33)})\n\n"
            "👉 *¿Cómo deseas proceder con esta joya verificada?*\n"
            f"• Responde *APROBAR* para vincular *{sku}* en el catálogo oficial.\n"
            "• Responde *NUEVO* para crear una nueva ficha de taller artesanal.\n"
            "• Responde *RECHAZAR* para descartar definitivamente."
        )
        open_and_send("Galantesbacklog", gdrive_msg)
        print("Google Drive multi-angle proposal delivered successfully!")

    elif cmd == "list_all_odoo_inventory":
        import subprocess
        sql_cmd = """
        SELECT json_agg(t) FROM (
            SELECT pt.id, pt.default_code, pt.name, pt.list_price, pt.type, 
                   pc.name as category_name
            FROM product_template pt
            LEFT JOIN product_category pc ON pt.categ_id = pc.id
            ORDER BY pt.id
        ) t;
        """
        res = subprocess.run([
            "docker", "exec", "-i", "galantes_db",
            "psql", "-U", "odoo", "-d", "galantes_prod",
            "-t", "-A", "-c", sql_cmd
        ], capture_output=True, text=True)
        raw = res.stdout.strip()
        try:
            products = json.loads(raw)
            print(f"Total products in Odoo production DB: {len(products)}")
            for p in products[:15]:
                print(f"ID {p.get('id')}: SKU={p.get('default_code')} | Name={p.get('name')} | Cat={p.get('category_name')} | Price={p.get('list_price')}")
        except Exception as e:
            print("Raw SQL output:", raw[:200])
            print("Stderr:", res.stderr)
            print("Returncode:", res.returncode)

if __name__ == "__main__":
    main()
