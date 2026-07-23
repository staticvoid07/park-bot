const { spawn } = require('child_process');
const os = require('os');

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
  ].join('; ');

  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
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
  const platform = os.platform();
  if (platform === 'win32') {
    showWindowsPopup(title, message);
  } else {
    showLinuxPopup(title, message);
  }
}

module.exports = { showPopup };
