PAGE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bumpy call</title>
<style>
  body { font-family: sans-serif; font-size: 18px; margin: 24px; max-width: 28rem; }
  label { display: block; margin-top: 16px; }
  input { font: inherit; width: 100%; box-sizing: border-box; margin-top: 8px; padding: 10px; }
  button { font: inherit; padding: 16px 24px; margin: 20px 8px 0 0; }
  #caption { margin-top: 28px; white-space: pre-wrap; }
</style>
</head>
<body>
<label for="token">Call token</label>
<input id="token" type="password" autocomplete="off">
<button id="call" type="button">Call</button>
<button id="hangup" type="button" hidden>Hang up</button>
<p id="status">Ready</p>
<p id="caption"></p>
<audio id="remote" autoplay></audio>
<script>
const callButton = document.querySelector('#call');
const hangupButton = document.querySelector('#hangup');
const tokenInput = document.querySelector('#token');
const status = document.querySelector('#status');
const caption = document.querySelector('#caption');
const remote = document.querySelector('#remote');
const saved = sessionStorage.getItem('bumpy-call-token');
if (saved) tokenInput.value = saved;

let peer = null;
let localStream = null;
let captionTimer = 0;

function secret() {
  return tokenInput.value.trim();
}

function waitForIce(connection) {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 2000);
    connection.addEventListener('icegatheringstatechange', () => {
      if (connection.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

async function refreshCaption() {
  const value = secret();
  if (!value) return;
  try {
    const response = await fetch('/call/caption', {
      headers: { Authorization: 'Bearer ' + value },
    });
    if (!response.ok) return;
    const body = await response.json();
    caption.textContent = typeof body.text === 'string' ? body.text : '';
  } catch (error) {
    status.textContent = 'The caption could not be read.';
  }
}

function stopMedia() {
  if (captionTimer) clearInterval(captionTimer);
  captionTimer = 0;
  if (localStream) {
    for (const track of localStream.getTracks()) track.stop();
  }
  localStream = null;
  if (peer) peer.close();
  peer = null;
  remote.srcObject = null;
  callButton.hidden = false;
  hangupButton.hidden = true;
}

async function hangUp() {
  const value = secret();
  stopMedia();
  status.textContent = 'Hung up';
  if (!value) return;
  await fetch('/call/hangup', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + value },
  }).catch(() => {});
}

callButton.addEventListener('click', async () => {
  const value = secret();
  if (!value) {
    status.textContent = 'Enter the call token first.';
    return;
  }
  sessionStorage.setItem('bumpy-call-token', value);
  status.textContent = 'Calling…';
  try {
    peer = new RTCPeerConnection({ iceServers: [] });
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of localStream.getTracks()) peer.addTrack(track, localStream);
    peer.ontrack = (event) => {
      remote.srcObject = event.streams[0];
      remote.play().catch(() => {});
    };
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIce(peer);
    const response = await fetch('/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + value,
      },
      body: JSON.stringify({
        sdp: peer.localDescription.sdp,
        type: peer.localDescription.type,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'The call was not answered.');
    await peer.setRemoteDescription(body);
    status.textContent = 'On the call';
    callButton.hidden = true;
    hangupButton.hidden = false;
    captionTimer = setInterval(refreshCaption, 1000);
    refreshCaption();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'The call failed.';
    stopMedia();
  }
});

hangupButton.addEventListener('click', () => {
  hangUp();
});
</script>
</body>
</html>
"""
