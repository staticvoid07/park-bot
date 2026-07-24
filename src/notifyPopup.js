const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function escapeForPowerShellSingleQuotes(str) {
  return String(str).replace(/'/g, "''");
}

function showWindowsPopup(title, message) {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$form = New-Object System.Windows.Forms.Form',
    '$form.TopMost = $true',
    '$form.StartPosition = "CenterScreen"',
    `[System.Windows.Forms.MessageBox]::Show($form, '${escapeForPowerShellSingleQuotes(message)}', '${escapeForPowerShellSingleQuotes(title)}', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null`,
  ].join("\r\n");

  // Written to a temp .ps1 file (rather than passed inline via -Command) so this isn't at the
  // mercy of command-line length/quoting limits, and -ExecutionPolicy Bypass makes it run even
  // on machines where PowerShell script execution is locked down by default.
  //
  // The UTF-8 BOM prefix matters: classic Windows PowerShell (5.1, the one preinstalled on every
  // Windows 10/11 machine) does not reliably read .ps1 files as UTF-8 without one - it falls back
  // to the system's codepage. Site/park names here can contain accented characters (e.g. French
  // names like "Pagwa" -> "Pàgwà"), and without the BOM those bytes get misread, which can corrupt
  // the script enough to fail to parse - silently, since we previously ignored stdio entirely.
  let scriptPath;
  try {
    scriptPath = path.join(os.tmpdir(), `park-bot-alert-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
    const BOM = '\uFEFF';
    fs.writeFileSync(scriptPath, BOM + script, 'utf8');
  } catch (e) {
    console.error(`[notify] could not write popup script: ${e.message}`);
    return;
  }

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
    { detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  );

  let stderr = '';
  let stdout = '';
  if (child.stdout) child.stdout.on('data', (d) => { stdout += d.toString(); });
  if (child.stderr) child.stderr.on('data', (d) => { stderr += d.toString(); });

  child.on('error', (e) => {
    console.error(`[notify] failed to launch the popup window: ${e.message}`);
    fs.unlink(scriptPath, () => {});
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[notify] popup script exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}${stdout ? ` (stdout: ${stdout.trim()})` : ''}`);
    }
    fs.unlink(scriptPath, () => {});
  });
  child.unref();
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
