// --- CONFIGURATION ---
const CLIENT_ID =
  '737883056091-ff3rblo4uhc0n7k7mvd9u47einnknmp9.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAapEDaEj1QWFB_vpC-U8m0mQ4wVUwP31c';
// NEW: Specify the email domain that is allowed to use this tool.
const ALLOWED_DOMAIN = 'greatlakes.edu.in';
// --- END CONFIGURATION ---

const CALENDAR_ID = 'primary';
// MODIFIED: Added 'email' and 'profile' scopes to get user info
const SCOPES =
  'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

// Get references to all HTML elements
const authMessage = document.getElementById('auth_message');
const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const syncSection = document.getElementById('sync_section');
const syncButton = document.getElementById('sync_button');
const jsonInput = document.getElementById('json_input');
const logOutput = document.getElementById('log_output');

let tokenClient;

window.onload = () => {
  initializeApp();
};

function initializeApp() {
  logMessage('Page loaded. Initializing Google API client...');
  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [
          'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
        ],
      });
      logMessage('Google API client initialized.');
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: tokenCallback,
      });
      logMessage('Google Sign-In client initialized.');
      authMessage.style.display = 'none';
      authorizeButton.style.display = 'block';
      logMessage('Ready. Please sign in.');
    } catch (error) {
      logMessage(`Error during initialization: ${error.message}`);
      authMessage.innerText =
        'Initialization Failed. Check API Key and Console for errors.';
      console.error('Initialization Error:', error);
    }
  });
}

// MODIFIED: This function now checks the user's domain.
async function tokenCallback(tokenResponse) {
  if (tokenResponse.error) {
    logMessage(`Authentication Error: ${tokenResponse.error}`);
    throw tokenResponse;
  }

  // 1. Get user's profile information using the access token
  const accessToken = gapi.client.getToken().access_token;
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const userInfo = await response.json();

  // 2. Check if the user's email domain is allowed
  if (userInfo.email && userInfo.email.endsWith(ALLOWED_DOMAIN)) {
    logMessage(`Access granted for ${userInfo.email}.`);
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
    syncSection.classList.remove('hidden');
  } else {
    // 3. If domain does not match, block access
    logMessage(
      `Access denied. User ${userInfo.email} is not from an allowed domain.`
    );
    authMessage.innerText = `Access Denied. You must sign in with a @${ALLOWED_DOMAIN} email address.`;
    authMessage.style.display = 'block';
    gapi.client.setToken(null); // Sign the user out
  }
}

// Assign click handlers
authorizeButton.onclick = () =>
  tokenClient.requestAccessToken({ prompt: 'consent' });
signoutButton.onclick = () => {
  gapi.client.setToken(null);
  authorizeButton.style.display = 'block';
  signoutButton.style.display = 'none';
  syncSection.classList.add('hidden');
  authMessage.style.display = 'none';
  logMessage('Signed out. Please sign in to sync.');
};
syncButton.onclick = handleSync;

// --- The handleSync function and log helpers remain the same ---
// (No changes needed for the code below this line)
async function handleSync() {
  // ... (This function is unchanged)
}
function logMessage(message) {
  // ... (This function is unchanged)
}
function clearLog() {
  // ... (This function is unchanged)
}
