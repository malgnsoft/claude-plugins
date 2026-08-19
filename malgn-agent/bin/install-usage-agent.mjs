#!/usr/bin/env node
/**
 * install-usage-agent.mjs
 *
 * report-usage.mjs 가 매시간 자동 실행되도록 OS 스케줄러에 등록하는 설치 스크립트.
 *  - macOS:   launchd (~/Library/LaunchAgents/com.malgnsoft.usage-agent.plist, StartInterval 3600초)
 *  - Windows: schtasks (1시간 간격 반복 트리거)
 *  - Linux:   이번 범위에서 자동 설치는 지원하지 않는다 (맑은소프트 직원 PC는 macOS/Windows만 대상).
 *             수동 cron 등록 안내만 출력한다.
 *
 * 페어링이 안 되어 있으면 먼저 pair-usage-device.mjs 를 실행해 페어링부터 진행한다
 * (브라우저를 열어 사람의 승인 클릭이 필요하므로 TTY가 있는 상태에서 실행해야 한다).
 *
 * 순수 Node 내장모듈만 사용.
 *
 * 사용법:
 *   node install-usage-agent.mjs [--uninstall]
 *
 *   --uninstall  등록 해제 (macOS: launchd unload+plist 삭제 / Windows: schtasks 삭제)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { readCredentials } from './usage-agent-lib.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPORT_SCRIPT = path.join(SCRIPT_DIR, 'report-usage.mjs');
const PAIR_SCRIPT = path.join(SCRIPT_DIR, 'pair-usage-device.mjs');

const PLIST_LABEL = 'com.malgnsoft.usage-agent';
const PLIST_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${PLIST_LABEL}.plist`);
const WIN_TASK_NAME = 'MalgnsoftUsageAgent';
const HUB_LOG_DIR = path.join(os.homedir(), '.claude', 'malgnai-hub');

function printHelp() {
  console.log(`사용법: node install-usage-agent.mjs [--uninstall]

옵션 없이 실행: report-usage.mjs 를 매시간 자동 실행하도록 OS 스케줄러에 등록합니다.
              디바이스 페어링이 안 되어 있으면 먼저 pair-usage-device.mjs 를 실행합니다
              (브라우저 승인이 필요하므로 사람이 있는 터미널에서 실행해야 합니다).

  --uninstall  등록 해제
               macOS:   launchctl unload 후 plist 삭제
               Windows: schtasks /delete

macOS/Windows만 자동 설치를 지원합니다. Linux는 수동 cron 등록 안내만 출력합니다.`);
}

function ensurePaired() {
  const creds = readCredentials();
  if (creds && creds.device_token) {
    console.log(`이미 페어링되어 있습니다 (device_id=${creds.device_id}).`);
    return;
  }
  console.log('디바이스 페어링이 되어 있지 않습니다. pair-usage-device.mjs 를 먼저 실행합니다...');
  const result = spawnSync(process.execPath, [PAIR_SCRIPT], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error('디바이스 페어링에 실패했습니다. 설치를 중단합니다.');
    process.exit(1);
  }
  const after = readCredentials();
  if (!after || !after.device_token) {
    console.error('페어링 완료 후에도 device_token을 확인할 수 없습니다. 설치를 중단합니다.');
    process.exit(1);
  }
}

function buildPlistXml() {
  const node = process.execPath;
  const outLog = path.join(HUB_LOG_DIR, 'usage-agent.out.log');
  const errLog = path.join(HUB_LOG_DIR, 'usage-agent.err.log');
  fs.mkdirSync(HUB_LOG_DIR, { recursive: true });
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(node)}</string>
    <string>${esc(REPORT_SCRIPT)}</string>
  </array>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${esc(outLog)}</string>
  <key>StandardErrorPath</key>
  <string>${esc(errLog)}</string>
</dict>
</plist>
`;
}

function installMac() {
  ensurePaired();
  const xml = buildPlistXml();
  fs.mkdirSync(path.dirname(PLIST_PATH), { recursive: true });
  fs.writeFileSync(PLIST_PATH, xml, 'utf8');
  console.log(`launchd plist 작성: ${PLIST_PATH}`);

  // 기존 등록이 있을 수 있으니 unload는 실패해도 무시하고 재등록을 진행한다.
  spawnSync('launchctl', ['unload', PLIST_PATH], { stdio: 'ignore' });
  const load = spawnSync('launchctl', ['load', '-w', PLIST_PATH], { stdio: 'inherit' });
  if (load.status !== 0) {
    console.error(`launchctl load 실패. 수동으로 확인해주세요: ${PLIST_PATH}`);
    process.exit(1);
  }
  console.log('설치 완료: 매시간(StartInterval 3600초) report-usage.mjs 가 자동 실행됩니다.');
  console.log(`로그: ${path.join(HUB_LOG_DIR, 'usage-agent.out.log')} / usage-agent.err.log`);
}

function uninstallMac() {
  if (!fs.existsSync(PLIST_PATH)) {
    console.log('등록된 launchd 작업이 없습니다.');
    return;
  }
  spawnSync('launchctl', ['unload', '-w', PLIST_PATH], { stdio: 'inherit' });
  fs.rmSync(PLIST_PATH, { force: true });
  console.log(`launchd 작업을 해제하고 plist를 삭제했습니다: ${PLIST_PATH}`);
}

function installWindows() {
  ensurePaired();
  fs.mkdirSync(HUB_LOG_DIR, { recursive: true });
  const node = process.execPath;
  const outLog = path.join(HUB_LOG_DIR, 'usage-agent.out.log');
  const errLog = path.join(HUB_LOG_DIR, 'usage-agent.err.log');
  // schtasks /tr는 자체 리다이렉션 문법이 없어 cmd.exe로 감싸 stdout/stderr를 로그 파일로 보낸다
  // (reviewer 지적 F-01, 2026-08-19 — 리다이렉션 없으면 정상흐름 밖 크래시 시 진단 채널이 사라짐).
  const cmd = `cmd /c ""${node}" "${REPORT_SCRIPT}" >> "${outLog}" 2>> "${errLog}""`;
  const result = spawnSync(
    'schtasks',
    ['/create', '/tn', WIN_TASK_NAME, '/tr', cmd, '/sc', 'HOURLY', '/mo', '1', '/f'],
    { stdio: 'inherit' }
  );
  if (result.status !== 0) {
    console.error('schtasks 등록 실패. 관리자 권한이 필요할 수 있습니다.');
    process.exit(1);
  }
  console.log(`설치 완료: Windows 작업 스케줄러에 "${WIN_TASK_NAME}" 작업을 매시간 등록했습니다.`);
  console.log(`로그: ${outLog} / ${errLog}`);
}

function uninstallWindows() {
  const result = spawnSync('schtasks', ['/delete', '/tn', WIN_TASK_NAME, '/f'], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.log(`"${WIN_TASK_NAME}" 작업을 찾지 못했거나 이미 삭제되었습니다.`);
    return;
  }
  console.log(`Windows 작업 스케줄러에서 "${WIN_TASK_NAME}" 작업을 삭제했습니다.`);
}

function unsupportedLinux() {
  console.log('Linux는 이 스크립트의 자동 설치 범위에서 제외됩니다 (맑은소프트 직원 PC는 macOS/Windows 대상).');
  console.log('아래처럼 수동으로 cron에 등록해주세요 (crontab -e):');
  console.log('');
  console.log(`0 * * * * ${process.execPath} ${REPORT_SCRIPT} >> ${path.join(HUB_LOG_DIR, 'usage-agent.log')} 2>&1`);
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  const uninstall = args.includes('--uninstall');
  const platform = process.platform;

  if (platform === 'darwin') {
    if (uninstall) uninstallMac();
    else installMac();
  } else if (platform === 'win32') {
    if (uninstall) uninstallWindows();
    else installWindows();
  } else {
    unsupportedLinux();
  }
}

main();
