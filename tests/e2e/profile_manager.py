from __future__ import annotations

import argparse
import json
from pathlib import Path

from profile_runtime import HOST_USER_DATA_DIR, ensure_testing_profile


def main() -> int:
  parser = argparse.ArgumentParser(
    description='Prepare or validate the persistent Selenium Chrome profile clone.',
  )
  parser.add_argument(
    '--profile',
    default='Default',
    help='Chrome profile directory to clone from the host user-data directory.',
  )
  args = parser.parse_args()

  try:
    user_data_dir, profile_directory = ensure_testing_profile(args.profile)
  except FileNotFoundError as error:
    print(json.dumps({ 'ok': False, 'error': str(error) }, ensure_ascii=False, indent=2))
    return 1
  except RuntimeError:
    print(
      json.dumps(
        {
          'ok': False,
          'error': 'Chrome esta abierto. Por favor cierra Chrome manualmente e intenta de nuevo para poder usar el perfil.',
        },
        ensure_ascii=False,
        indent=2,
      ),
    )
    return 1

  payload = {
    'ok': True,
    'host_user_data_dir': str(HOST_USER_DATA_DIR),
    'host_profile_dir': str(HOST_USER_DATA_DIR / profile_directory),
    'testing_user_data_dir': str(Path(user_data_dir)),
    'profile_directory': profile_directory,
  }
  print(json.dumps(payload, ensure_ascii=False, indent=2))
  return 0


if __name__ == '__main__':
  raise SystemExit(main())
