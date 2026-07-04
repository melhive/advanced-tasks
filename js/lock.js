/* lock.js — optional local passcode gate. The passcode itself is never
   stored; only a salted SHA-256 hash sits in IndexedDB, and everything
   happens on-device. There is no recovery path other than clearing the
   app's local data — the UI says so explicitly when setting it up. */

async function sha256Hex(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSaltHex() {
  const arr = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getLockSettings() {
  const rec = await DB.get('settings', 'lock');
  return rec ? rec.value : { enabled: false };
}

async function setPasscode(passcode) {
  const salt = randomSaltHex();
  const hash = await sha256Hex(salt + passcode);
  await DB.put('settings', { key: 'lock', value: { enabled: true, hash, salt } });
}

async function disablePasscode() {
  await DB.put('settings', { key: 'lock', value: { enabled: false } });
}

async function verifyPasscode(passcode) {
  const settings = await getLockSettings();
  if (!settings.enabled) return true;
  const hash = await sha256Hex(settings.salt + passcode);
  return hash === settings.hash;
}

function showLockScreen(onUnlock) {
  const screen = document.getElementById('lock-screen');
  screen.classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
  const input = document.getElementById('lock-passcode-input');
  const err = document.getElementById('lock-error');
  input.value = '';
  err.textContent = '';
  input.focus();

  const attempt = async () => {
    const ok = await verifyPasscode(input.value);
    if (ok) {
      screen.classList.add('hidden');
      document.getElementById('app').style.display = '';
      onUnlock();
    } else {
      err.textContent = 'Incorrect passcode';
      input.value = '';
      input.focus();
    }
  };

  document.getElementById('lock-unlock-btn').onclick = attempt;
  input.onkeydown = (e) => { if (e.key === 'Enter') attempt(); };
}

function lockNow() {
  location.reload();
}
