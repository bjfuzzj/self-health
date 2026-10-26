#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
  echo "需要 Python 3.10 或更高版本，请参阅 INSTALL.md。"
  read -r -p "按回车退出"
  exit 1
fi
exec python3 server.py
