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
# Both Azure and the single Kernel Archives endpoint have timed out in CI.
# APT's mirror transport tries the next lower-preference endpoint on failure;
# it still verifies the existing noble suites/components and Signed-By keys.
printf '%s\tpriority:%s\n' \
  'https://archive.ubuntu.com/ubuntu/' 1 \
  'https://security.ubuntu.com/ubuntu/' 2 \
  | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
sudo tee /etc/apt/apt.conf.d/90dotify-ci-network >/dev/null <<'APT'
Acquire::Retries "2";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::ForceIPv4 "true";
APT::Update::Error-Mode "any";
APT
