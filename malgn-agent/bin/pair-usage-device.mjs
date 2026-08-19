#!/usr/bin/env node
/**
 * pair-usage-device.mjs
 *
 * malgnai-hub와 3-스텝 디바이스 페어링을 수행해 device_token을 발급받아
 * ~/.claude/malgnai-hub/usage-agent-credentials.json 에 저장하는 1회성 설치 스크립트.
 * (POSIX는 chmod 600, Windows는 OS 기본 사용자 권한)
 *
 *   1) POST /api/devices/pair-init            (무인증) → pairing_code / pairing_url / expires_in
 *   2) 사용자가 pairing_url을 브라우저로 열어 로그인 상태에서 승인 (사람 개입 필요)
 *   3) GET  /api/devices/pair-status?code=... (무인증, 폴링) → approved 시 device_token(raw, 1회만 노출)
 *
 * device_id는 이 PC에 고정되는 안정적 해시값을 사용해 재실행해도 디바이스가 계속 늘어나지 않게 한다.
 * 순수 Node 내장모듈만 사용 (fetch 대신 https 내장모듈 기반 usage-agent-lib.mjs 사용).
 *
 * 사용법:
 *   node pair-usage-device.mjs [--force]
 *
 *   --force  이미 device_token이 저장되어 있어도 새로 페어링을 다시 진행한다.
 */

import {
  resolveApiBase,
  readCredentials,
  writeCredentials,
  generateDeviceId,
  generateDeviceName,
  requestJson,
  openUrlInBrowser,
  nowIso,
} from './usage-agent-lib.mjs';

function printHelp() {
  console.log(`사용법: node pair-usage-device.mjs [--force]

malgnai-hub 디바이스 페어링을 진행해 device_token을 발급받아
~/.claude/malgnai-hub/usage-agent-credentials.json 에 저장합니다.

  --force  이미 페어링되어 있어도 새로 다시 진행합니다.

승인은 브라우저에서 malgnai-hub에 로그인한 사람이 직접 클릭해야 합니다 —
이 스크립트가 자동으로 승인하지 않습니다.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  const force = args.includes('--force');

  const apiBase = resolveApiBase();
  const existing = readCredentials();
  if (existing && existing.device_token && !force) {
    console.log(`이미 페어링되어 있습니다 (device_id=${existing.device_id}). 다시 페어링하려면 --force 를 사용하세요.`);
    return;
  }

  const deviceId = (existing && existing.device_id) || generateDeviceId();
  const deviceName = (existing && existing.device_name) || generateDeviceName();

  console.log(`malgnai-hub 디바이스 페어링을 시작합니다 (${apiBase})`);
  console.log(`device_id: ${deviceId}`);
  console.log(`device_name: ${deviceName}`);

  let initRes;
  try {
    initRes = await requestJson('POST', `${apiBase}/api/devices/pair-init`, {
      body: { device_id: deviceId, device_name: deviceName },
    });
  } catch (err) {
    console.error(`페어링 시작 요청 실패: ${err && err.message ? err.message : err}`);
    process.exit(1);
  }
  if (initRes.status !== 200 || !initRes.json || !initRes.json.pairing_code) {
    console.error(`페어링 시작 실패 (status=${initRes.status}): ${initRes.text || '(응답 없음)'}`);
    process.exit(1);
  }
  const { pairing_code: pairingCode, pairing_url: pairingUrl, expires_in: expiresIn } = initRes.json;
  const expiresInSec = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 600;

  console.log('');
  console.log('브라우저에서 아래 URL을 열어 malgnai-hub에 로그인한 상태로 승인해주세요:');
  console.log(pairingUrl);
  console.log(`(페어링 코드: ${pairingCode}, ${expiresInSec}초 내 승인 필요)`);
  console.log('');

  const opened = openUrlInBrowser(pairingUrl);
  console.log(
    opened
      ? '기본 브라우저를 여는 것을 시도했습니다. 자동으로 열리지 않으면 위 URL을 직접 열어주세요.'
      : '브라우저를 자동으로 열지 못했습니다. 위 URL을 직접 열어 진행해주세요.'
  );
  console.log('승인 대기 중...');

  const pollIntervalMs = 3000;
  const deadline = Date.now() + expiresInSec * 1000;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    let statusRes;
    try {
      statusRes = await requestJson(
        'GET',
        `${apiBase}/api/devices/pair-status?code=${encodeURIComponent(pairingCode)}`,
        {}
      );
    } catch (err) {
      continue; // 네트워크 일시 오류는 폴링을 계속한다 (deadline까지)
    }

    const body = statusRes.json;
    if (!body || !body.status) continue;

    if (body.status === 'approved') {
      if (body.device_token) {
        writeCredentials({
          device_id: deviceId,
          device_name: deviceName,
          device_token: body.device_token,
          paired_at: nowIso(),
        });
        console.log('');
        console.log('페어링 완료: device_token을 저장했습니다.');
        console.log('저장 위치: ~/.claude/malgnai-hub/usage-agent-credentials.json (chmod 600)');
        return;
      }
      // raw 토큰은 최초 승인 응답에서 딱 한 번만 온다 — 재폴링으로 여기 도달했다면 이미 소비된 것.
      console.error('승인은 되었지만 device_token이 이 응답에 없습니다(이미 다른 폴링에서 소비됨).');
      console.error('--force 로 처음부터 다시 페어링해주세요.');
      process.exit(1);
    }

    if (body.status === 'expired' || body.status === 'rejected' || body.status === 'denied') {
      console.error(`페어링이 종료되었습니다 (status=${body.status}). 다시 실행해 재시도해주세요.`);
      process.exit(1);
    }
    // 'pending' 등은 계속 대기
  }

  console.error('페어링 대기 시간이 초과되었습니다. 다시 실행해주세요.');
  process.exit(1);
}

run().catch((err) => {
  console.error('페어링 중 예기치 않은 오류가 발생했습니다:', err && err.message ? err.message : err);
  process.exit(1);
});
