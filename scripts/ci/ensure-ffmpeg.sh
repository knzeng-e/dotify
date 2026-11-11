#!/usr/bin/env bash
# Official Ubuntu packages only; no downloaded fallback binary or skipped codec test.
set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  # The workflow pins Ubuntu 24.04. Bound each repository operation as well as
  # the whole Actions step, so DNS/mirror failures cannot stall dependent jobs.
  apt_options=(
    -o Acquire::Retries=2
    -o Acquire::http::Timeout=20
    -o Acquire::https::Timeout=20
    -o Acquire::ForceIPv4=true
    -o APT::Update::Error-Mode=any
  )
  timeout --kill-after=10s 90s sudo env DEBIAN_FRONTEND=noninteractive \
    apt-get "${apt_options[@]}" update
  timeout --kill-after=10s 180s sudo env DEBIAN_FRONTEND=noninteractive \
    apt-get "${apt_options[@]}" install --no-install-recommends -y ffmpeg
fi

# A present but unusable binary must fail. Actual AAC encode/decode coverage
# follows in the existing test steps; presence is not codec acceptance.
ffmpeg -version
ffmpeg -L
