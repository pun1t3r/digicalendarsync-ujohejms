// --- CONFIGURATION ---
const CLIENT_ID =
  '737883056091-ff3rblo4uhc0n7k7mvd9u47einnknmp9.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAapEDaEj1QWFB_vpC-U8m0mQ4wVUwP31c';
// NEW: Specify the email domain that is allowed to use this tool.
const ALLOWED_DOMAIN = 'greatlakes.edu.in';
// --- END CONFIGURATION ---

const CALENDAR_ID = 'primary';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

const authMessage = document.getElementById('auth_message');
const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const syncSection = document.getElementById('sync_section');
const syncButton = document.getElementById('sync_button');
const jsonInput = document.getElementById('json_input');
const logOutput = document.getElementById('log_output');

let gapiInited = false;
let gsiInited = false;

window.gapiLoaded = () => gapi.load('client', () => gapiInited = true);
window.gisLoaded = () => gsiInited = true;

/**
 * Main entry point. Waits for both Google libraries to load.
 */
window.onload = () => {
    const checkGoogleLoaded = setInterval(() => {
        if (gapiInited && gsiInited) {
            clearInterval(checkGoogleLoaded);
            initializeApp();
        }
    }, 100);
};

async function initializeApp() {
    logMessage('Page loaded. Initializing Google API client...');
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    });
    logMessage('Google API client initialized.');

    // This handles the redirect back from Google
    google.accounts.oauth2.getAuthnData(async (authnData) => {
        if (authnData.code) {
            try {
                // Exchange the authorization code for an access token
                const tokenResponse = await gapi.client.getToken({ code: authnData.code });
                handleSuccessfulLogin();
            } catch (error) {
                console.error('Error exchanging code for token', error);
                logMessage(`Error during login: ${error.details || error.message}`);
            }
        } else {
            // If there's no code, show the sign-in button
            authMessage.style.display = 'none';
            authorizeButton.style.display = 'block';
            logMessage('Ready. Please sign in.');
        }
    });
}

// NEW: This function initiates the redirect to Google
function handleGoogleLogin() {
    const client = google.accounts.oauth2.initCodeClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        ux_mode: 'redirect',
    });
    client.requestCode();
}

async function handleSuccessfulLogin() {
    // 1. Get user's profile information
    const accessToken = gapi.client.getToken().access_token;
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userInfo = await response.json();

    // 2. Check if the user's email domain is allowed
    if (userInfo.email && userInfo.email.endsWith(ALLOWED_DOMAIN)) {
        logMessage(`Access granted for ${userInfo.email}.`);
        authMessage.style.display = 'none';
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'block';
        syncSection.classList.remove('hidden');
    } else {
        logMessage(`Access denied. User ${userInfo.email} is not from an allowed domain.`);
        authMessage.innerText = `Access Denied. You must sign in with a @${ALLOWED_DOMAIN} email address.`;
        authMessage.style.display = 'block';
        signOut();
    }
}

function signOut() {
    const token = gapi.client.getToken();
    if (token) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken(null);
            authorizeButton.style.display = 'block';
            signoutButton.style.display = 'none';
            syncSection.classList.add('hidden');
            authMessage.style.display = 'none';
            logMessage('Signed out. Please sign in to sync.');
        });
    }
}

// Assign click handlers
authorizeButton.onclick = handleGoogleLogin;
signoutButton.onclick = signOut;
syncButton.onclick = handleSync;

// The handleSync function and log helpers remain the same
async function handleSync() {
    syncButton.disabled = true;
    syncButton.classList.add('loading');
    syncButton.innerHTML = 'Syncing...';
    clearLog();
    logMessage('Starting the sync process...');
    try {
        let digiEvents;
        try {
            digiEvents = JSON.parse(jsonInput.value);
            if (!Array.isArray(digiEvents)) throw new Error('Input is not a JSON array.');
            logMessage(`✅ Loaded ${digiEvents.length} events from input.`);
        } catch (err) {
            logMessage(`❌ Error: Invalid JSON. Please check your data. Details: ${err.message}`);
            return;
        }
        logMessage('Fetching existing events from Google Calendar...');
        const response = await gapi.client.calendar.events.list({
            calendarId: 'primary',
            privateExtendedProperty: 'source=digicampus-frontend',
            maxResults: 2500,
        });
        const googleEvents = response.result.items;
        const googleEventsMap = new Map(googleEvents.map(e => [e.extendedProperties.private.digicampus_id, e]));
        logMessage(`Found ${googleEventsMap.size} existing Digicampus events in your calendar.`);
        const currentDigiIds = new Set();
        for (const event of digiEvents) {
            const digiId = String(event.id);
            currentDigiIds.add(digiId);
            const existingEvent = googleEventsMap.get(digiId);
            if (event.isCancelled && existingEvent) {
                logMessage(`- [DELETE] Event "${existingEvent.summary}" (${digiId}) is cancelled.`);
                await gapi.client.calendar.events.delete({ calendarId: 'primary', eventId: existingEvent.id });
                continue;
            }
            if (event.isCancelled) continue;
            const faculties = (event.facultyList || []).map(f => f.facultyName).join(', ');
            const eventBody = {
                summary: `${event.classList[0].course_code} - ${event.classList[0].courseName}`,
                description: `<b>Faculty:</b> ${faculties || 'N/A'}\n<b>Batch:</b> ${event.classList[0].batch}\n<b>Type:</b> ${event.classList[0].type}`,
                start: { dateTime: new Date(event.start).toISOString() },
                end: { dateTime: new Date(event.end).toISOString() },
                extendedProperties: {
                    private: {
                        source: 'digicampus-frontend',
                        digicampus_id: digiId,
                        lastModified: event.lastModified,
                    },
                },
            };
            if (existingEvent) {
                if (event.lastModified > existingEvent.extendedProperties.private.lastModified) {
                    logMessage(`- [UPDATE] Event "${eventBody.summary}" (${digiId}) has changed.`);
                    await gapi.client.calendar.events.update({
                        calendarId: 'primary',
                        eventId: existingEvent.id,
                        resource: eventBody,
                    });
                }
            } else {
                logMessage(`- [CREATE] New event "${eventBody.summary}" (${digiId}).`);
                await gapi.client.calendar.events.insert({
                    calendarId: 'primary',
                    resource: eventBody,
                });
            }
        }
        for (const [digiId, googleEvent] of googleEventsMap.entries()) {
            if (!currentDigiIds.has(digiId)) {
                logMessage(`- [CLEANUP] Deleting outdated event "${googleEvent.summary}" (${digiId}).`);
                await gapi.client.calendar.events.delete({ calendarId: 'primary', eventId: googleEvent.id });
            }
        }
        logMessage('\n✅ Sync complete! Check your Google Calendar.');
    } catch (err) {
        logMessage(`❌ An error occurred during sync: ${err.message}`);
        console.error(err);
    } finally {
        syncButton.disabled = false;
        syncButton.classList.remove('loading');
        syncButton.innerHTML = '✨ Sync to Calendar';
    }
}
function logMessage(message) {
    if (logOutput) {
        logOutput.textContent += message + '\n';
        logOutput.scrollTop = logOutput.scrollHeight;
    }
}
function clearLog() {
    if (logOutput) {
        logOutput.textContent = '';
    }
}
