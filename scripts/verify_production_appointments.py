import subprocess
import json
import time

def run_production_test():
    print("🚀 Inciando prueba funcional de citas en PRODUCCIÓN...")
    
    # Datos de la cita
    appointment_data = {
        "name": "QA Validation Master",
        "email": "qa-master@galantesjewelry.com",
        "phone": "555-9999",
        "inquiryType": "Bespoke Jewelry",
        "appointmentDate": "2026-05-15",
        "appointmentTime": "02:00 PM",
        "message": "Automated 360-degree verification test for Google Calendar & Odoo."
    }
    
    # Escapar el JSON para bash
    json_str = json.dumps(appointment_data).replace('"', '\\"')
    
    # Comando remoto
    cmd = f'gcloud compute ssh yoeli@galantes-prod-vm --zone=us-central1-a --command="curl -s -X POST http://localhost:3000/api/appointments -H \'Content-Type: application/json\' -d \'{json_str}\'"'
    
    try:
        print("1. Enviando petición de cita...")
        result = subprocess.check_output(cmd, shell=True).decode('utf-8')
        print(f"   Respuesta API: {result}")
        
        print("2. Esperando 10 segundos para la sincronización con Google...")
        time.sleep(10)
        
        print("3. Recuperando logs de integración...")
        log_cmd = 'gcloud compute ssh yoeli@galantes-prod-vm --zone=us-central1-a --command="sudo docker logs galantes_web --tail 50"'
        logs = subprocess.check_output(log_cmd, shell=True).decode('utf-8')
        
        if "google_calendar_event_id" in logs or "event_id" in result.lower():
            print("✅ EXITO: Cita creada y sincronizada con Google Calendar.")
        else:
            print("⚠️ ADVERTENCIA: La cita se creó pero no se encontró confirmación de Google en los logs.")
            print("Últimos logs recuperados:")
            print(logs)
            
    except Exception as e:
        print(f"❌ ERROR durante la prueba: {e}")

if __name__ == "__main__":
    run_production_test()
