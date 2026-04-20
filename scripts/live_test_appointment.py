import http.client
import json

def test_live_appointment():
    print("🚀 Iniciando prueba funcional EXTERNA en https://galantesjewelry.com...")
    
    data = {
        "name": "Live Functional Test",
        "email": "ceo@galantesjewelry.com",
        "phone": "555-1234",
        "inquiryType": "Bespoke Collection",
        "appointmentDate": "2026-11-15",
        "appointmentTime": "03:00 PM",
        "message": "Testing end-to-end flow: Cloudflare -> Nginx -> Next.js -> Odoo -> Google Calendar."
    }

    try:
        conn = http.client.HTTPSConnection("galantesjewelry.com")
        headers = {'Content-Type': 'application/json'}
        conn.request("POST", "/api/appointments", json.dumps(data), headers)
        
        response = conn.getresponse()
        status = response.status
        body = response.read().decode()
        
        print(f"Status: {status}")
        print(f"Response: {body}")
        
        if status == 200:
            print("✅ EXITO: La cita se registró correctamente desde el exterior.")
        else:
            print(f"❌ FALLO: El servidor devolvió un error {status}.")
            
        conn.close()
    except Exception as e:
        print(f"❌ ERROR de conexión: {e}")

if __name__ == "__main__":
    test_live_appointment()
