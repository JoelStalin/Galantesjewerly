from __future__ import annotations

import json
import os
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from datetime import datetime
from pathlib import Path

from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from profile_runtime import get_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'http://127.0.0.1:3000').rstrip('/')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'CHANGE_ME_LEGACY_ADMIN_PASSWORD')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Default')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'

SELECTORS = {
    'login_username': "[data-testid='login-username']",
    'login_password': "[data-testid='login-password']",
    'login_submit': "[data-testid='login-submit']",
    'logout_button': "[data-testid='logout-button']",
    'tab_featured': "[data-testid='tab-featured']",
    'add_featured_button': "[data-testid='add-featured-button']",
    'featured_card_prefix': "[data-testid^='featured-card-']",
    'featured_title_prefix': "[data-testid^='featured-title-']",
    'featured_content_prefix': "[data-testid^='featured-content-']",
    'featured_image_input_prefix': "[data-testid^='featured-image-input-']",
    'featured_image_preview_prefix': "[data-testid^='featured-image-preview-']",
    'featured_action_text_prefix': "[data-testid^='featured-action-text-']",
    'featured_action_link_prefix': "[data-testid^='featured-action-link-']",
    'save_featured_prefix': "[data-testid^='save-featured-']",
    'delete_featured_prefix': "[data-testid^='delete-featured-']",
    'admin_notice': "[data-testid='admin-notice']",
    'public_featured_dot_prefix': "[data-testid^='featured-dot-']",
    'public_featured_card_prefix': "[data-testid^='featured-public-card-']",
    'public_featured_image_prefix': "[data-testid^='featured-public-image-']",
}

URLS_TESTED = [
    '/',
    '/admin/login',
    '/admin/dashboard',
    '/api/admin/auth',
    '/api/admin/auth/logout',
    '/api/admin/content',
    '/api/admin/session',
    '/api/admin/upload',
]


def by_test_id(value: str) -> tuple[str, str]:
    return By.CSS_SELECTOR, f"[data-testid='{value}']"


def create_artifact_dir() -> Path:
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    artifact_dir = CURRENT_DIR / 'artifacts' / timestamp
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def save_screenshot(driver, artifact_dir: Path, name: str) -> str:
    file_name = f'{name}.png'
    driver.save_screenshot(str(artifact_dir / file_name))
    return file_name


def launch_driver(report: RunReport):
    driver, profile_dir = get_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        return None, profile_dir

    time.sleep(1)

    try:
        if not driver.window_handles:
            driver.quit()
            driver, profile_dir = get_driver(PROFILE_NAME, headless=HEADLESS)
    except Exception as error:
        report.log(f'Retrying Chrome launch after window bootstrap issue: {error}')
        try:
            driver.quit()
        except Exception:
            pass
        driver, profile_dir = get_driver(PROFILE_NAME, headless=HEADLESS)

    return driver, profile_dir


def write_png(path: Path, rgb: tuple[int, int, int]) -> None:
    width = 8
    height = 8
    rows = []
    for _ in range(height):
        rows.append(b'\x00' + bytes(rgb) * width)
    raw_data = b''.join(rows)
    compressed = zlib.compress(raw_data)

    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + chunk_type
            + data
            + struct.pack('>I', zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        )

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', compressed)
    png += chunk(b'IEND', b'')
    path.write_bytes(png)


def absolute_url(path_or_url: str) -> str:
    if path_or_url.startswith('http://') or path_or_url.startswith('https://'):
        return path_or_url
    return urllib.parse.urljoin(f'{BASE_URL}/', path_or_url.lstrip('/'))


def fetch_status(path_or_url: str) -> int:
    request = urllib.request.Request(absolute_url(path_or_url), method='GET')
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def wait_for_status(path_or_url: str, expected_status: int, timeout_seconds: int = 20) -> int:
    deadline = time.time() + timeout_seconds
    last_status = 0
    while time.time() < deadline:
        last_status = fetch_status(path_or_url)
        if last_status == expected_status:
            return last_status
        time.sleep(0.5)
    raise AssertionError(
        f'Unexpected HTTP status for {path_or_url}: {last_status}, expected {expected_status}',
    )


def browser_request(driver, method: str, path: str, payload: dict | None = None) -> dict:
    return driver.execute_async_script(
        """
        const [method, path, payload, done] = arguments;
        fetch(path, {
          method,
          credentials: 'include',
          headers: payload ? { 'Content-Type': 'application/json' } : undefined,
          body: payload ? JSON.stringify(payload) : undefined,
        })
          .then(async (response) => {
            const text = await response.text();
            let data = null;
            try {
              data = text ? JSON.parse(text) : null;
            } catch {
              data = { raw: text };
            }
            done({ ok: response.ok, status: response.status, data });
          })
          .catch((error) => done({ ok: false, status: 0, error: String(error) }));
        """,
        method,
        path,
        payload,
    )


class RunReport:
    def __init__(self, artifact_dir: Path) -> None:
        self.artifact_dir = artifact_dir
        self.logs: list[str] = []
        self.cases: list[dict] = []
        self.errors: list[str] = []
        self.profile_path = ''
        self.created_item_id = ''
        self.initial_image_url = ''
        self.first_managed_url = ''
        self.second_managed_url = ''
        self.status = 'in_progress'

    def log(self, message: str) -> None:
        timestamped = f'{datetime.now().isoformat()} {message}'
        self.logs.append(timestamped)
        print(message)

    def record_case(
        self,
        name: str,
        status: str,
        details: str,
        evidence: list[str] | None = None,
    ) -> None:
        self.cases.append(
            {
                'name': name,
                'status': status,
                'details': details,
                'evidence': evidence or [],
            },
        )

    def write(self) -> None:
        payload = {
            'status': self.status,
            'base_url': BASE_URL,
            'profile_name': PROFILE_NAME,
            'profile_path': self.profile_path,
            'urls_tested': URLS_TESTED,
            'selectors': SELECTORS,
            'created_item_id': self.created_item_id,
            'initial_image_url': self.initial_image_url,
            'first_managed_url': self.first_managed_url,
            'second_managed_url': self.second_managed_url,
            'cases': self.cases,
            'logs': self.logs,
            'errors': self.errors,
            'timestamp': datetime.now().isoformat(),
        }
        (self.artifact_dir / 'result.json').write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )

        lines = [
            '# Selenium E2E Report',
            '',
            f'- Status: {self.status}',
            f'- Base URL: {BASE_URL}',
            f'- Profile name: {PROFILE_NAME}',
            f'- Profile path: {self.profile_path}',
            f'- Created item id: {self.created_item_id or "n/a"}',
            f'- First managed image: {self.first_managed_url or "n/a"}',
            f'- Second managed image: {self.second_managed_url or "n/a"}',
            '',
            '## Cases',
        ]

        for case in self.cases:
            evidence_text = ', '.join(case['evidence']) if case['evidence'] else 'none'
            lines.extend(
                [
                    f"- {case['name']}: {case['status']}",
                    f"  Details: {case['details']}",
                    f"  Evidence: {evidence_text}",
                ],
            )

        lines.extend(['', '## URLs Tested'])
        lines.extend([f'- {url}' for url in URLS_TESTED])
        lines.extend(['', '## Selectors'])
        lines.extend([f'- {name}: `{selector}`' for name, selector in SELECTORS.items()])
        lines.extend(['', '## Logs'])
        lines.extend([f'- {entry}' for entry in self.logs])

        if self.errors:
            lines.extend(['', '## Errors'])
            lines.extend([f'- {entry}' for entry in self.errors])

        (self.artifact_dir / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

        if self.errors:
            (self.artifact_dir / 'errors.log').write_text('\n'.join(self.errors) + '\n', encoding='utf-8')


def listed_featured_ids(driver) -> set[str]:
    ids = set()
    for element in driver.find_elements(By.CSS_SELECTOR, "[data-testid^='featured-card-']"):
        test_id = element.get_attribute('data-testid') or ''
        if test_id.startswith('featured-card-'):
            ids.add(test_id.replace('featured-card-', '', 1))
    return ids


def current_preview_src(driver, item_id: str) -> str:
    elements = driver.find_elements(*by_test_id(f'featured-image-preview-{item_id}'))
    if not elements:
        return ''
    return elements[0].get_attribute('src') or ''


def current_public_image_url(driver, item_id: str) -> str:
    elements = driver.find_elements(*by_test_id(f'featured-public-image-{item_id}'))
    if not elements:
        return ''
    return elements[0].get_attribute('data-image-url') or ''


def wait_for_notice(wait: WebDriverWait, expected_text: str) -> None:
    wait.until(lambda current: expected_text in current.find_element(*by_test_id('admin-notice')).text)


def set_input_value(driver, test_id: str, value: str) -> None:
    field = driver.find_element(*by_test_id(test_id))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', field)
    field.clear()
    field.send_keys(value)


def login_if_needed(driver, wait: WebDriverWait, report: RunReport) -> None:
    driver.get(f'{BASE_URL}/admin/dashboard')
    wait.until(lambda current: current.current_url.startswith(BASE_URL))

    if '/admin/login' in driver.current_url:
        report.log('Login required. Submitting admin credentials.')
        wait.until(EC.presence_of_element_located(by_test_id('login-username'))).clear()
        driver.find_element(*by_test_id('login-username')).send_keys(ADMIN_USERNAME)
        driver.find_element(*by_test_id('login-password')).clear()
        driver.find_element(*by_test_id('login-password')).send_keys(ADMIN_PASSWORD)
        driver.find_element(*by_test_id('login-submit')).click()

    wait.until(EC.presence_of_element_located(by_test_id('logout-button')))
    wait.until(lambda current: '/admin/dashboard' in current.current_url)


def assert_session_after_refresh(driver, wait: WebDriverWait) -> None:
    driver.refresh()
    wait.until(EC.presence_of_element_located(by_test_id('logout-button')))
    wait.until(lambda current: '/admin/dashboard' in current.current_url)


def assert_session_after_restart(driver, wait: WebDriverWait) -> None:
    driver.get(f'{BASE_URL}/admin/dashboard')
    wait.until(lambda current: current.current_url.startswith(BASE_URL))
    if '/admin/login' in driver.current_url:
        raise AssertionError('Session was lost after reopening the browser with the same Selenium profile.')
    wait.until(EC.presence_of_element_located(by_test_id('logout-button')))


def open_featured_tab(driver, wait: WebDriverWait) -> None:
    tab = wait.until(EC.element_to_be_clickable(by_test_id('tab-featured')))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', tab)
    tab.click()
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid^='featured-card-']")))


def create_featured_item(driver, wait: WebDriverWait) -> str:
    previous_ids = listed_featured_ids(driver)
    add_button = wait.until(EC.element_to_be_clickable(by_test_id('add-featured-button')))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', add_button)
    add_button.click()
    wait.until(lambda current: len(listed_featured_ids(current) - previous_ids) == 1)
    new_ids = listed_featured_ids(driver) - previous_ids
    return next(iter(new_ids))


def upload_image(driver, wait: WebDriverWait, item_id: str, file_path: Path) -> None:
    before = current_preview_src(driver, item_id)
    file_input = wait.until(EC.presence_of_element_located(by_test_id(f'featured-image-input-{item_id}')))
    driver.execute_script(
        "arguments[0].classList.remove('hidden'); arguments[0].style.display = 'block'; arguments[0].style.opacity = 1;",
        file_input,
    )
    file_input.send_keys(str(file_path))
    wait.until(lambda current: current_preview_src(current, item_id) not in {'', before})


def save_featured(driver, wait: WebDriverWait, item_id: str) -> None:
    save_button = wait.until(EC.element_to_be_clickable(by_test_id(f'save-featured-{item_id}')))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', save_button)
    save_button.click()
    wait_for_notice(wait, 'Item destacado actualizado.')


def featured_item_from_api(driver, item_id: str) -> dict:
    response = browser_request(driver, 'GET', '/api/admin/content')
    if not response.get('ok'):
        raise AssertionError(f'Unable to read admin content API: {response}')

    featured_items = response.get('data', {}).get('featured', [])
    for item in featured_items:
        if str(item.get('id')) == str(item_id):
            return item
    raise AssertionError(f'Featured item {item_id} was not returned by /api/admin/content.')


def delete_featured_ui(driver, wait: WebDriverWait, item_id: str) -> None:
    button = wait.until(EC.element_to_be_clickable(by_test_id(f'delete-featured-{item_id}')))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', button)
    button.click()
    wait.until(EC.alert_is_present())
    try:
        driver.switch_to.alert.accept()
    except NoAlertPresentException:
        raise AssertionError('Delete confirmation dialog did not appear.')
    wait.until(lambda current: not current.find_elements(*by_test_id(f'featured-card-{item_id}')))
    wait_for_notice(wait, 'Colecci')


def cleanup_created_item(driver, item_id: str, report: RunReport) -> None:
    if not item_id:
        return
    response = browser_request(
        driver,
        'DELETE',
        '/api/admin/content',
        { 'type': 'featured_delete', 'id': item_id },
    )
    if response.get('ok'):
        report.log(f'Cleanup completed for item {item_id}.')
    else:
        message = f'Cleanup failed for item {item_id}: {response}'
        report.errors.append(message)
        report.log(message)


def prioritize_featured_item(driver, item: dict) -> dict:
    payload = {
        'type': 'featured_update',
        'id': item['id'],
        'updates': {
            'title': item.get('title', ''),
            'content_text': item.get('content_text', ''),
            'image_url': item.get('image_url', ''),
            'action_text': item.get('action_text', ''),
            'action_link': item.get('action_link', ''),
            'is_active': item.get('is_active', True),
            'order_index': -1,
        },
    }
    response = browser_request(driver, 'PUT', '/api/admin/content', payload)
    if not response.get('ok'):
        raise AssertionError(f'Unable to move featured item to the front of the carousel: {response}')
    return response.get('data', {}).get('featured', item)


def assert_public_render(driver, wait: WebDriverWait, item_id: str, expected_image_url: str) -> None:
    driver.get(f'{BASE_URL}/')
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid^='featured-public-card-']")))

    wait.until(lambda current: current.find_elements(*by_test_id(f'featured-public-card-{item_id}')))
    wait.until(lambda current: current_public_image_url(current, item_id) == expected_image_url)


def assert_access_denied_after_logout(driver, wait: WebDriverWait) -> None:
    driver.get(f'{BASE_URL}/admin/dashboard')
    wait.until(lambda current: '/admin/login' in current.current_url)
    response = browser_request(driver, 'GET', '/api/admin/content')
    if response.get('status') != 401:
        raise AssertionError(f'Protected admin API remained reachable after logout: {response}')


def main() -> None:
    artifact_dir = create_artifact_dir()
    report = RunReport(artifact_dir)
    first_fixture = artifact_dir / 'first-upload.png'
    second_fixture = artifact_dir / 'second-upload.png'
    write_png(first_fixture, (182, 137, 75))
    write_png(second_fixture, (77, 121, 180))

    driver = None
    created_item_id = ''
    current_case = 'login_exitoso'

    try:
        report.log(f'Artifacts will be stored in {artifact_dir}')
        driver, profile_dir = launch_driver(report)
        if driver is None:
            report.status = 'blocked'
            report.errors.append('Chrome profile is locked. Close Chrome manually and rerun the suite.')
            report.write()
            return

        report.profile_path = str(profile_dir)
        wait = WebDriverWait(driver, 20)

        login_if_needed(driver, wait, report)
        report.record_case(
            'login_exitoso',
            'pass',
            'Admin credentials unlocked the dashboard successfully.',
            [save_screenshot(driver, artifact_dir, '01_dashboard_authenticated')],
        )

        current_case = 'acceso_admin_autenticado'
        report.record_case(
            'acceso_admin_autenticado',
            'pass',
            'Direct navigation to /admin/dashboard returned the protected dashboard.',
            [],
        )

        current_case = 'refresh_mantiene_sesion'
        assert_session_after_refresh(driver, wait)
        report.record_case(
            'refresh_mantiene_sesion',
            'pass',
            'Refreshing the protected dashboard preserved the authenticated session.',
            [save_screenshot(driver, artifact_dir, '02_session_after_refresh')],
        )

        current_case = 'reinicio_navegador_mantiene_sesion'
        driver.quit()
        driver, profile_dir = launch_driver(report)
        if driver is None:
            raise AssertionError('Chrome profile became unavailable during the browser restart validation.')
        report.profile_path = str(profile_dir)
        wait = WebDriverWait(driver, 20)
        assert_session_after_restart(driver, wait)
        report.record_case(
            'reinicio_navegador_mantiene_sesion',
            'pass',
            'Reopening Chrome with the same persistent test profile kept the admin session active.',
            [save_screenshot(driver, artifact_dir, '03_session_after_browser_restart')],
        )

        current_case = 'creacion_registro_destacado'
        open_featured_tab(driver, wait)
        created_item_id = create_featured_item(driver, wait)
        report.created_item_id = created_item_id
        report.record_case(
            'creacion_registro_destacado',
            'pass',
            f'Created featured record {created_item_id} from the admin dashboard.',
            [save_screenshot(driver, artifact_dir, '04_featured_record_created')],
        )

        timestamp_suffix = datetime.now().strftime('%H%M%S')
        initial_title = f'Automation Featured {timestamp_suffix}'
        updated_title = f'Automation Featured Updated {timestamp_suffix}'
        set_input_value(driver, f'featured-title-{created_item_id}', initial_title)
        set_input_value(
            driver,
            f'featured-content-{created_item_id}',
            'Created by Selenium to verify upload, persistence, and replace flows.',
        )
        set_input_value(driver, f'featured-action-text-{created_item_id}', 'Open Feature')
        set_input_value(driver, f'featured-action-link-{created_item_id}', '/collections')
        upload_image(driver, wait, created_item_id, first_fixture)
        report.record_case(
            'seleccion_imagen_inicial',
            'pass',
            'Selected the first image file and the dashboard rendered the upload preview.',
            [save_screenshot(driver, artifact_dir, '05_first_upload_preview')],
        )

        current_case = 'visualizacion_posterior_imagen'
        save_featured(driver, wait, created_item_id)
        created_item = featured_item_from_api(driver, created_item_id)
        report.first_managed_url = created_item.get('image_url', '')
        if not report.first_managed_url.startswith('/api/image?id='):
            raise AssertionError(f'First persisted image URL is not a managed image: {report.first_managed_url}')
        wait_for_status(report.first_managed_url, 200)
        created_item = prioritize_featured_item(driver, created_item)
        report.record_case(
            'guardado_exitoso_con_imagen',
            'pass',
            'Saved the newly created record and received a managed image URL persisted by the admin API.',
            [save_screenshot(driver, artifact_dir, '06_after_first_save')],
        )
        driver.get(f'{BASE_URL}/admin/dashboard')
        wait.until(EC.presence_of_element_located(by_test_id('logout-button')))
        open_featured_tab(driver, wait)
        wait.until(lambda current: current_preview_src(current, created_item_id).startswith(BASE_URL + '/api/image?id='))
        report.record_case(
            'visualizacion_posterior_imagen',
            'pass',
            'After saving and reloading the dashboard, the created record still rendered the managed image.',
            [save_screenshot(driver, artifact_dir, '07_saved_image_after_reload')],
        )

        assert_public_render(
            driver,
            wait,
            created_item_id,
            report.first_managed_url,
        )
        report.record_case(
            'visualizacion_publica_inicial',
            'pass',
            'The public home rendered the saved managed image for the newly created featured record.',
            [save_screenshot(driver, artifact_dir, '08_public_render_initial')],
        )

        current_case = 'edicion_registro'
        driver.get(f'{BASE_URL}/admin/dashboard')
        wait.until(EC.presence_of_element_located(by_test_id('logout-button')))
        open_featured_tab(driver, wait)
        set_input_value(driver, f'featured-title-{created_item_id}', updated_title)
        set_input_value(
            driver,
            f'featured-content-{created_item_id}',
            'Updated by Selenium to verify edit persistence before image replacement.',
        )
        report.record_case(
            'edicion_registro',
            'pass',
            'Edited the created record title and description before replacing the image.',
            [save_screenshot(driver, artifact_dir, '09_record_updated_before_replace')],
        )

        current_case = 'reemplazo_de_imagen'
        upload_image(driver, wait, created_item_id, second_fixture)
        save_featured(driver, wait, created_item_id)
        updated_item = featured_item_from_api(driver, created_item_id)
        report.second_managed_url = updated_item.get('image_url', '')
        if not report.second_managed_url.startswith('/api/image?id='):
            raise AssertionError(f'Second persisted image URL is not a managed image: {report.second_managed_url}')
        if report.second_managed_url == report.first_managed_url:
            raise AssertionError('The replacement upload did not produce a new managed image URL.')

        wait_for_status(report.first_managed_url, 404)
        wait_for_status(report.second_managed_url, 200)
        updated_item = prioritize_featured_item(driver, updated_item)
        driver.get(f'{BASE_URL}/admin/dashboard')
        wait.until(EC.presence_of_element_located(by_test_id('logout-button')))
        open_featured_tab(driver, wait)
        wait.until(lambda current: updated_title in current.find_element(*by_test_id(f'featured-title-{created_item_id}')).get_attribute('value'))
        report.record_case(
            'reemplazo_de_imagen',
            'pass',
            'The second image replaced the first one, the previous blob returned 404, and the updated record persisted.',
            [save_screenshot(driver, artifact_dir, '10_after_image_replace')],
        )

        assert_public_render(
            driver,
            wait,
            created_item_id,
            report.second_managed_url,
        )
        report.record_case(
            'visualizacion_publica_reemplazo',
            'pass',
            'The public home switched to the replacement managed image after saving the edit.',
            [save_screenshot(driver, artifact_dir, '11_public_render_after_replace')],
        )

        driver.get(f'{BASE_URL}/admin/dashboard')
        wait.until(EC.presence_of_element_located(by_test_id('logout-button')))
        open_featured_tab(driver, wait)
        delete_featured_ui(driver, wait, created_item_id)
        wait_for_status(report.second_managed_url, 404)
        report.record_case(
            'limpieza_registro_creado',
            'pass',
            f'Deleted the temporary record {created_item_id} and confirmed the managed replacement blob was removed.',
            [save_screenshot(driver, artifact_dir, '12_cleanup_created_record')],
        )
        created_item_id = ''

        current_case = 'logout_manual'
        wait.until(EC.element_to_be_clickable(by_test_id('logout-button'))).click()
        wait.until(EC.presence_of_element_located(by_test_id('login-submit')))
        wait.until(lambda current: '/admin/login' in current.current_url)
        report.record_case(
            'logout_manual',
            'pass',
            'The manual logout button invalidated the session and returned the browser to the login screen.',
            [save_screenshot(driver, artifact_dir, '13_logout_confirmed')],
        )

        current_case = 'acceso_denegado_post_logout'
        assert_access_denied_after_logout(driver, wait)
        report.record_case(
            'acceso_denegado_post_logout',
            'pass',
            'After logout, direct dashboard navigation and the protected admin API returned unauthorized responses.',
            [save_screenshot(driver, artifact_dir, '14_access_denied_after_logout')],
        )

        report.status = 'pass'
        report.log('Admin image/session Selenium suite completed successfully.')
    except Exception as error:
        report.status = 'fail'
        message = f'{type(error).__name__}: {error}'
        report.errors.append(message)
        report.log(message)
        failure_shot = ''
        if driver is not None:
            try:
                failure_shot = save_screenshot(driver, artifact_dir, '99_failure')
            except Exception as screenshot_error:
                report.errors.append(f'Unable to capture failure screenshot: {screenshot_error}')
        report.record_case(
            current_case,
            'fail',
            message,
            [failure_shot] if failure_shot else [],
        )
        raise
    finally:
        if driver is not None and created_item_id:
            cleanup_created_item(driver, created_item_id, report)
        if driver is not None:
            try:
                browser_logs = driver.get_log('browser')
                if browser_logs:
                    formatted_logs = [
                        f"{entry.get('level', 'INFO')}: {entry.get('message', '')}"
                        for entry in browser_logs
                    ]
                    (artifact_dir / 'browser-console.log').write_text(
                        '\n'.join(formatted_logs) + '\n',
                        encoding='utf-8',
                    )
            except Exception:
                pass
            driver.quit()
        report.write()


if __name__ == '__main__':
    main()
