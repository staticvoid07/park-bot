const NTFY_SERVER = 'https://ntfy.sh';

async function sendNtfyPush(topic, title, message) {
  if (!topic) return;
  try {
    const res = await fetch(`${NTFY_SERVER}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      body: message,
      headers: {
        Title: title,
        Priority: 'urgent',
        Tags: 'tent',
      },
    });
    if (!res.ok) {
      console.error(`[notify] ntfy push failed: HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`[notify] ntfy push error: ${e.message}`);
  }
}

module.exports = { sendNtfyPush };
