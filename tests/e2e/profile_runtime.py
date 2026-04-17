from __future__ import annotations

import os
import shutil
from pathlib import Path

from selenium import webdriver

RUNTIME_ROOT = Path(__file__).resolve().parent / '.runtime'
PERSISTENT_USER_DATA_DIR = RUNTIME_ROOT / 'chrome-user-data'
HOST_USER_DATA_DIR = Path(os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\User Data'))
IGNORED_NAMES = {
    'BrowserMetrics',
    'CertificateRevocation',
    'Crashpad',
    'Default',
    'DawnCache',
    'FileTypePolicies',
    'FirstPartySetsPreloaded',
    'GrShaderCache',
    'GraphiteDawnCache',
    'GPUCache',
    'Last Browser',
    'Last Version',
    'NativeMessagingHosts',
    'OptimizationHints',
    'OriginTrials',
    'PKIMetadata',
    'SafetyTips',
    'Safe Browsing',
    'ShaderCache',
    'SingletonCookie',
    'SingletonLock',
    'SingletonSocket',
    'Subresource Filter',
    'Variations',
}
IGNORED_PATTERNS = [
    '*.tmp',
    '*.log',
    '*.lock',
    'Current Session',
    'Current Tabs',
    'Last Session',
    'Last Tabs',
    'LOCK',
    'LOCKFILE',
    'lockfile',
    'DevToolsActivePort',
    'Singleton*',
]


def _copytree(source: Path, destination: Path) -> None:
    shutil.copytree(
        source,
        destination,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(*IGNORED_PATTERNS, *IGNORED_NAMES),
    )


def _is_profile_lock_error(error: BaseException) -> bool:
    lowered = str(error).lower()
    return any(
        fragment in lowered
        for fragment in ('used by another process', 'already in use', 'permission denied', 'winerror 32')
    )


def _remove_lock_artifacts(root: Path) -> None:
    for pattern in ('Singleton*', 'DevToolsActivePort', 'LOCK', 'LOCKFILE', 'lockfile'):
        for path in root.glob(pattern):
            if path.is_file() or path.is_symlink():
                path.unlink(missing_ok=True)


def ensure_testing_profile(profile_name: str = 'Default') -> tuple[Path, str]:
    if not HOST_USER_DATA_DIR.exists():
        raise FileNotFoundError(f'Chrome user data was not found at: {HOST_USER_DATA_DIR}')

    source_profile = HOST_USER_DATA_DIR / profile_name
    if not source_profile.exists():
        raise FileNotFoundError(f'The requested Chrome profile was not found: {source_profile}')

    target_profile = PERSISTENT_USER_DATA_DIR / profile_name
    PERSISTENT_USER_DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not target_profile.exists():
        try:
            local_state = HOST_USER_DATA_DIR / 'Local State'
            if local_state.exists():
                shutil.copy2(local_state, PERSISTENT_USER_DATA_DIR / 'Local State')
            _copytree(source_profile, target_profile)
        except (OSError, shutil.Error) as exc:
            if _is_profile_lock_error(exc):
                if target_profile.exists():
                    _remove_lock_artifacts(PERSISTENT_USER_DATA_DIR)
                    return PERSISTENT_USER_DATA_DIR, profile_name
                raise RuntimeError('Chrome profile is locked') from exc
            raise

    _remove_lock_artifacts(PERSISTENT_USER_DATA_DIR)
    return PERSISTENT_USER_DATA_DIR, profile_name


def get_driver(profile_name: str = 'Default', headless: bool = False):
    try:
        user_data_dir, resolved_profile = ensure_testing_profile(profile_name)
    except RuntimeError as exc:
        if _is_profile_lock_error(exc) or str(exc) == 'Chrome profile is locked':
            print('ERROR: Chrome is open. Close Chrome manually and run the suite again.')
            return None, PERSISTENT_USER_DATA_DIR
        raise

    options = webdriver.ChromeOptions()
    options.add_argument(f'user-data-dir={user_data_dir}')
    options.add_argument(f'profile-directory={resolved_profile}')
    options.add_argument('--start-maximized')
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_argument('--no-default-browser-check')
    options.add_argument('--disable-search-engine-choice-screen')
    options.add_experimental_option('excludeSwitches', ['enable-automation'])
    options.add_experimental_option('useAutomationExtension', False)
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

    if headless:
        options.add_argument('--headless=new')

    try:
        driver = webdriver.Chrome(options=options)
        return driver, user_data_dir
    except Exception as exc:
        if _is_profile_lock_error(exc):
            print('ERROR: Chrome is open. Close Chrome manually and run the suite again.')
            return None, user_data_dir
        raise
