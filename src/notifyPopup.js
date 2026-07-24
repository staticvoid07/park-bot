const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function escapeForPowerShellSingleQuotes(str) {
  return String(str).replace(/'/g, "''");
}

function escapeForVbsQuotedString(str) {
  return String(str).replace(/"/g, '""');
}

function runDetachedScript({ scriptPath, contents, encoding, command, args, label, onSpawnError }) {
  try {
    fs.writeFileSync(scriptPath, contents, encoding);
  } catch (e) {
    console.error(`[notify] could not write ${label} script: ${e.message}`);
    return;
  }

  const child = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  let stderr = '';
  let stdout = '';
  if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString(); });
  if (child.stderr) child.stderr.on('data', (d) => { stderr += d.toString(); });

  let spawnFailed = false;
  child.on('error', (e) => {
    spawnFailed = true;
    console.error(`[notify] failed to launch the popup window (${label}): ${e.message}`);
    fs.unlink(scriptPath, () => {});
    if (onSpawnError) onSpawnError();
  });
  child.on('exit', (code) => {
    if (spawnFailed) return;
    // Log on a non-zero exit OR if anything landed on stderr/stdout - a script can throw an
    // internal error and still exit 0, so a clean exit code alone doesn't mean it worked.
    if (code !== 0 || stderr.trim() || stdout.trim()) {
      console.error(
        `[notify] ${label} popup script exit code ${code}` +
          `${stderr.trim() ? ` | stderr: ${stderr.trim()}` : ''}` +
          `${stdout.trim() ? ` | stdout: ${stdout.trim()}` : ''}`
      );
    }
    fs.unlink(scriptPath, () => {});
  });
  child.unref();
}

// Primary: VBScript MsgBox via wscript.exe. Deliberately as simple as possible - no .NET, no
// WinForms, no STA threading requirement - since those were suspected culprits behind a silent
// failure to display. vbSystemModal (4096) forces it above every other window on the system,
// a more reliable "can't miss it" guarantee than anything WinForms offers here. wscript.exe
// ships on every Windows edition, including Home.
function showWindowsPopupViaVbs(title, message, onSpawnError) {
  const vbs = `MsgBox "${escapeForVbsQuotedString(message)}", vbOKOnly + vbInformation + vbSystemModal, "${escapeForVbsQuotedString(title)}"`;
  const scriptPath = path.join(os.tmpdir(), `park-bot-alert-${Date.now()}-${Math.random().toString(36).slice(2)}.vbs`);

  // WSH reliably reads .vbs files as UTF-16LE when a BOM is present - the standard, well-supported
  // way to give it non-ASCII text (site names can contain accents, e.g. French "Pagwa" -> "Pagwà").
  const bom = Buffer.from([0xff, 0xfe]);
  const contents = Buffer.concat([bom, Buffer.from(vbs, 'utf16le')]);

  runDetachedScript({
    scriptPath,
    contents,
    encoding: undefined, // contents is already a Buffer
    command: 'wscript.exe',
    args: ['//Nologo', scriptPath],
    label: 'vbs',
    onSpawnError,
  });
}

// Fallback if wscript.exe itself can't be launched for some reason.
function showWindowsPopupViaPowerShell(title, message) {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$form = New-Object System.Windows.Forms.Form',
    '$form.TopMost = $true',
    '$form.StartPosition = "CenterScreen"',
    `[System.Windows.Forms.MessageBox]::Show($form, '${escapeForPowerShellSingleQuotes(message)}', '${escapeForPowerShellSingleQuotes(title)}', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null`,
  ].join('\r\n');

  const scriptPath = path.join(os.tmpdir(), `park-bot-alert-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
  const bom = '﻿'; // classic Windows PowerShell 5.1 needs this to reliably read the file as UTF-8.

  runDetachedScript({
    scriptPath,
    contents: bom + script,
    encoding: 'utf8',
    command: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
    label: 'powershell',
  });
}

function showWindowsPopup(title, message) {
  showWindowsPopupViaVbs(title, message, () => {
    console.error('[notify] wscript.exe failed to launch, falling back to PowerShell for the popup.');
    showWindowsPopupViaPowerShell(title, message);
  });
}

function showLinuxPopup(title, message) {
  const tryTools = [
    { cmd: 'zenity', args: ['--info', '--title', title, '--text', message, '--width=400', '--ok-label=Got it'] },
    { cmd: 'xmessage', args: ['-center', `${title}\n\n${message}`] },
    { cmd: 'notify-send', args: [title, message] },
  ];

  function attempt(index) {
    if (index >= tryTools.length) {
      console.error('[notify] No popup tool (zenity/xmessage/notify-send) found on this system.');
      return;
    }
    const { cmd, args } = tryTools[index];
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => attempt(index + 1));
    child.unref();
  }

  attempt(0);
}

function showPopup(title, message) {
  console.log(`[notify] ${title}: ${message}`);
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      showWindowsPopup(title, message);
    } else {
      showLinuxPopup(title, message);
    }
  } catch (e) {
    console.error(`[notify] showPopup failed: ${e.message}`);
  }
}

module.exports = { showPopup };
