// --- CONFIGURATION ---
const CLIENT_ID = '737883056091-ff3rblo4uhc0n7k7mvd9u47einnknmp9.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAapEDaEj1QWFB_vpC-U8m0mQ4wVUwP31c';
const ALLOWED_DOMAIN = 'greatlakes.edu.in';
// --- END CONFIGURATION ---

const CALENDAR_ID = 'primary';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

// Get references to all HTML elements
const authMessage = document.getElementById('auth_message');
const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const syncSection = document.getElementById('sync_section');
const syncButton = document.getElementById('sync_button');
const jsonInput = document.getElementById('json_input');
const logOutput = document.getElementById('log_output');
const postAuthButtons = document.getElementById('post_auth_buttons');
const clearButton = document.getElementById('clear_button');

let tokenClient;

/**
 * Main function to initialize and run the application.
 */
async function initializeApp() {
    logMessage('Loading and initializing Google clients...');
    try {
        await new Promise(resolve => gapi.load('client', resolve));
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: tokenCallback,
        });

        logMessage('Clients initialized. Ready to sign in.');
        authMessage.style.display = 'none';
        authorizeButton.style.display = 'block';
    } catch (error) {
        console.error('Initialization failed:', error);
        logMessage(`Error during initialization: ${error.message}`);
        authMessage.innerText = 'Initialization Failed. Check the console for errors.';
    }
}

async function tokenCallback(tokenResponse) {
    if (tokenResponse.error) {
        logMessage(`Authentication Error: ${tokenResponse.error}`);
        return;
    }
    await handleSuccessfulLogin();
}

authorizeButton.onclick = () => {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        logMessage('Error: Token client not initialized.');
    }
};

// Assign click handlers for all buttons
signoutButton.onclick = signOut;
clearButton.onclick = handleClearAllEvents;
syncButton.onclick = () => {
    console.log('Sync button was clicked!');
    handleSync();
};

window.onload = async () => {
    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    try {
        await Promise.all([
            loadScript('https://apis.google.com/js/api.js'),
            loadScript('https://accounts.google.com/gsi/client')
        ]);
        initializeApp();
    } catch (error) {
        logMessage('Failed to load Google API scripts. Check your internet connection.');
        console.error('Script loading error:', error);
    }
};

async function handleSuccessfulLogin() {
    const accessToken = gapi.client.getToken().access_token;
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userInfo = await response.json();

    if (userInfo.email && userInfo.email.endsWith(ALLOWED_DOMAIN)) {
        logMessage(`Access granted for ${userInfo.email}.`);
        authMessage.style.display = 'none';
        authorizeButton.style.display = 'none';
        postAuthButtons.classList.remove('hidden'); // Show the container for signout/clear buttons
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
            postAuthButtons.classList.add('hidden'); // Hide the container
            syncSection.classList.add('hidden');
            authMessage.style.display = 'none';
            logMessage('Signed out. Please sign in to sync.');
        });
    }
}

// ** NEW FUNCTION TO CLEAR ALL SYNCED EVENTS **
async function handleClearAllEvents() {
    if (!confirm("Are you sure you want to delete ALL synced Digicampus events from your Google Calendar? This cannot be undone.")) {
        return;
    }

    clearButton.disabled = true;
    syncButton.disabled = true;
    clearLog();
    logMessage('Starting deletion process...');

    try {
        logMessage('Fetching all synced events from your calendar...');
        const response = await gapi.client.calendar.events.list({
            calendarId: 'primary',
            privateExtendedProperty: 'source=digi-sync',
            maxResults: 2500,
        });

        const eventsToDelete = response.result.items;
        if (!eventsToDelete || eventsToDelete.length === 0) {
            logMessage('No synced events found to delete.');
            return;
        }
        
        logMessage(`Found ${eventsToDelete.length} events. Deleting now...`);

        for (const event of eventsToDelete) {
            await gapi.client.calendar.events.delete({
                calendarId: 'primary',
                eventId: event.id,
            });
        }

        logMessage(`\n  Successfully deleted ${eventsToDelete.length} events.`);

    } catch (err) {
        logMessage(` An error occurred during deletion: ${err.message}`);
        console.error(err);
    } finally {
        clearButton.disabled = false;
        syncButton.disabled = false;
    }
}


async function handleSync() {
    syncButton.disabled = true;
    clearButton.disabled = true;
    syncButton.classList.add('loading');
    syncButton.innerHTML = 'Syncing...';
    clearLog();
    logMessage('Starting the sync process...');
    try {
        let digiEvents;
        try {
            digiEvents = JSON.parse(jsonInput.value);
            if (!Array.isArray(digiEvents)) throw new Error('Input is not a JSON array.');
            logMessage(`  Loaded ${digiEvents.length} events from input.`);
        } catch (err) {
            logMessage(` Error: Invalid JSON. Please check your data. Details: ${err.message}`);
            return;
        }
        
        logMessage('Fetching existing events from Google Calendar...');
        const response = await gapi.client.calendar.events.list({
            calendarId: 'primary',
            privateExtendedProperty: 'source=digi-sync',
            maxResults: 2500,
        });
        const googleEvents = response.result.items;
        const googleEventsMap = new Map(googleEvents ? googleEvents.map(e => [e.extendedProperties.private.digi_id, e]) : []);
        logMessage(`Found ${googleEventsMap.size} existing Digicampus events in your calendar.`);
        const currentDigiIds = new Set();
        for (const event of digiEvents) {
            const digiId = String(event.id);
            currentDigiIds.add(digiId);
            const existingEvent = googleEventsMap.get(digiId);
            if (event.isCancelled && existingEvent) {
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
                        source: 'digi-sync',
                        digi_id: digiId,
                        lastModified: event.lastModified,
                    },
                },
            };
            if (existingEvent) {
                if (event.lastModified > existingEvent.extendedProperties.private.lastModified) {
                    await gapi.client.calendar.events.update({
                        calendarId: 'primary',
                        eventId: existingEvent.id,
                        resource: eventBody,
                    });
                }
            } else {
                await gapi.client.calendar.events.insert({
                    calendarId: 'primary',
                    resource: eventBody,
                });
            }
        }
        for (const [digiId, googleEvent] of googleEventsMap.entries()) {
            if (!currentDigiIds.has(digiId)) {
                await gapi.client.calendar.events.delete({ calendarId: 'primary', eventId: googleEvent.id });
            }
        }
        logMessage('\n Sync complete! Check your Google Calendar.');
    } catch (err) {
        logMessage(` An error occurred during sync: ${err.message}`);
        console.error(err);
    } finally {
        syncButton.disabled = false;
        clearButton.disabled = false;
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
