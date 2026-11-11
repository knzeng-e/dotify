#!/usr/bin/env bash
# Only the disposable GitHub-hosted Ubuntu 24.04 job is modified.
set -euo pipefail
if [[ ${GITHUB_ACTIONS:-} != true || ${RUNNER_OS:-} != Linux ]]; then
  printf '%s\n' 'Ubuntu mirror setup is restricted to Linux GitHub Actions.' >&2
  exit 1
fi
# shellcheck disable=SC1091
source /etc/os-release
if [[ $ID != ubuntu || $VERSION_ID != 24.04 || ! -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'Unexpected runner image or Ubuntu mirror-list contract.' >&2
  exit 1
fi
# Replace the failing Azure delivery mirror, not Ubuntu's archive trust keys.
# Existing noble suites/components and Signed-By entries remain authoritative.
printf '%s\n' 'https://mirrors.kernel.org/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
sudo tee /etc/apt/apt.conf.d/90dotify-ci-network >/dev/null <<'APT'
Acquire::Retries "2";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::ForceIPv4 "true";
APT::Update::Error-Mode "any";
APT
