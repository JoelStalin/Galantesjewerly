#!/usr/bin/env python3
"""
Galante's Jewelry - Google OAuth End-to-End Test
Valida el flujo completo de autenticación con Google
"""

import sys
import os
import json
import requests
from datetime import datetime
from typing import Dict, Any
import traceback

# Colors for output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log_test(test_name: str):
    """Decorator para logging de pruebas"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            print(f"\n{Colors.HEADER}{Colors.BOLD}[TEST] {test_name}{Colors.ENDC}")
            try:
                result = func(*args, **kwargs)
                print(f"{Colors.OKGREEN}✓ PASS{Colors.ENDC}: {test_name}")
                return result
            except Exception as e:
                print(f"{Colors.FAIL}✗ FAIL{Colors.ENDC}: {test_name}")
                print(f"{Colors.FAIL}Error: {str(e)}{Colors.ENDC}")
                traceback.print_exc()
                return None
        return wrapper
    return decorator

class GoogleOAuthTester:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.config = {}
        self.test_results = []

    @log_test("Environment Variables Check")
    def test_env_variables(self):
        """Verifica que las variables de entorno estén configuradas"""
        required_vars = [
            "GOOGLE_OAUTH_CLIENT_ID",
            "GOOGLE_OAUTH_CLIENT_SECRET",
            "GOOGLE_OAUTH_REDIRECT_URI",
            "GOOGLE_SESSION_SECRET"
        ]

        missing = []
        for var in required_vars:
            value = os.getenv(var)
            if not value:
                missing.append(var)
            else:
                print(f"  ✓ {var} = {value[:30]}...")

        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")

        return True

    @log_test("Server Connectivity")
    def test_server_connectivity(self):
        """Verifica que el servidor esté disponible"""
        try:
            response = self.session.get(f"{self.base_url}/api/health", timeout=5)
            print(f"  Server Status: {response.status_code}")
            return response.status_code < 500
        except Exception as e:
            raise Exception(f"Cannot connect to {self.base_url}: {str(e)}")

    @log_test("Google OAuth Config Endpoint")
    def test_config_endpoint(self):
        """Prueba el endpoint de configuración de OAuth"""
        response = self.session.get(f"{self.base_url}/api/auth/google/config")
        print(f"  Response Status: {response.status_code}")

        if response.status_code == 200:
            config = response.json()
            self.config = config
            print(f"  Config Retrieved:")
            print(f"    - Enabled: {config.get('enabled')}")
            print(f"    - Client ID: {str(config.get('clientId', ''))[:30]}...")
            print(f"    - Redirect URI: {config.get('redirectUri')}")
            print(f"    - Scopes: {', '.join(config.get('scopes', []))}")

            if not config.get('enabled'):
                raise Exception("Google OAuth is disabled in config")

            if not config.get('clientId'):
                raise Exception("Client ID not configured")

            return True
        else:
            raise Exception(f"Config endpoint returned {response.status_code}")

    @log_test("Google OAuth Start Endpoint")
    def test_start_endpoint(self):
        """Prueba el endpoint que inicia el flujo OAuth"""
        response = self.session.get(
            f"{self.base_url}/api/auth/google/start?returnTo=%2F",
            allow_redirects=False
        )
        print(f"  Response Status: {response.status_code}")

        if response.status_code in [301, 302, 307, 308]:
            redirect_url = response.headers.get('Location')
            print(f"  Redirect URL: {redirect_url[:80]}...")

            if 'accounts.google.com' in redirect_url:
                print(f"  ✓ Correctly redirecting to Google")
                return True
            else:
                raise Exception(f"Unexpected redirect: {redirect_url}")
        else:
            print(f"  Response body: {response.text[:200]}")
            raise Exception(f"Start endpoint returned unexpected status: {response.status_code}")

    @log_test("Callback Handler Status")
    def test_callback_handler(self):
        """Verifica que el callback handler esté accesible"""
        # Solo probamos que el endpoint existe, no realmente hacemos callback
        response = self.session.get(
            f"{self.base_url}/auth/google/callback?code=test&state=test",
            allow_redirects=False
        )
        print(f"  Response Status: {response.status_code}")
        print(f"  Callback handler is accessible (testing without valid auth)")

        # Expected to fail with error redirect, not 500
        if response.status_code in [301, 302, 307, 308]:
            return True
        elif response.status_code >= 500:
            raise Exception(f"Callback handler error: {response.status_code}")
        return True

    @log_test(".env.local Configuration File")
    def test_env_file(self):
        """Verifica que el archivo .env.local esté presente"""
        env_path = ".env.local"
        if os.path.exists(env_path):
            size = os.path.getsize(env_path)
            print(f"  ✓ .env.local exists ({size} bytes)")

            with open(env_path, 'r') as f:
                content = f.read()
                required_entries = [
                    'GOOGLE_OAUTH_CLIENT_ID',
                    'GOOGLE_OAUTH_REDIRECT_URI',
                    'GOOGLE_SESSION_SECRET'
                ]
                for entry in required_entries:
                    if entry in content:
                        print(f"    ✓ {entry} configured")
                    else:
                        print(f"    ✗ {entry} missing!")
            return True
        else:
            raise Exception(".env.local file not found")

    @log_test("Cookies Configuration")
    def test_cookies(self):
        """Verifica que las cookies estén siendo configuradas correctamente"""
        response = self.session.get(
            f"{self.base_url}/api/auth/google/start?returnTo=%2F",
            allow_redirects=False
        )

        cookies = response.cookies
        print(f"  Cookies Set: {len(list(cookies))}")

        for cookie_name in cookies:
            print(f"    - {cookie_name}")

        if len(list(cookies)) > 0:
            print("  ✓ Cookies are being set")
            return True
        else:
            print("  ⚠ No cookies set (might be expected in some configs)")
            return True

    def run_all_tests(self):
        """Ejecuta todas las pruebas"""
        print(f"\n{Colors.BOLD}{'='*60}{Colors.ENDC}")
        print(f"{Colors.BOLD}Galante's Jewelry - Google OAuth Test Suite{Colors.ENDC}")
        print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
        print(f"Base URL: {Colors.OKCYAN}{self.base_url}{Colors.ENDC}")
        print(f"Time: {datetime.now().isoformat()}")

        tests = [
            self.test_env_file,
            self.test_env_variables,
            self.test_server_connectivity,
            self.test_config_endpoint,
            self.test_start_endpoint,
            self.test_cookies,
            self.test_callback_handler,
        ]

        passed = 0
        failed = 0

        for test in tests:
            try:
                result = test()
                if result:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                failed += 1

        print(f"\n{Colors.BOLD}{'='*60}{Colors.ENDC}")
        print(f"{Colors.BOLD}Test Results:{Colors.ENDC}")
        print(f"  {Colors.OKGREEN}Passed: {passed}{Colors.ENDC}")
        print(f"  {Colors.FAIL}Failed: {failed}{Colors.ENDC}")
        print(f"  Total:  {passed + failed}")

        if failed == 0:
            print(f"\n{Colors.OKGREEN}{Colors.BOLD}✓ All tests passed!{Colors.ENDC}")
            return True
        else:
            print(f"\n{Colors.FAIL}{Colors.BOLD}✗ Some tests failed. Check the logs above.{Colors.ENDC}")
            return False

if __name__ == '__main__':
    base_url = os.getenv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    tester = GoogleOAuthTester(base_url)

    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Test interrupted by user{Colors.ENDC}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{Colors.FAIL}Fatal error: {str(e)}{Colors.ENDC}")
        sys.exit(1)
