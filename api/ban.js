import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb', // Optional: Increase body size limit if needed
        },
    },
};

export default async function handler(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Check for POST method
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        // Parse request body manually
        let body;
        try {
            body = req.body ? req.body : JSON.parse(await streamToString(req)); // Handle JSON parsing for raw body
        } catch (err) {
            console.error('Failed to parse request body:', err.message);
            return res.status(400).json({ error: 'Invalid JSON in request body' });
        }

        const { customId } = body;
        if (!customId) {
            console.error('Missing customId in request body');
            return res.status(400).json({ error: 'Missing customId' });
        }

        console.log('Received customId:', customId);

        // Step 1: Search for PlayFabId by customId using GetAllUsers
        let foundPlayFabId = null;
        let continuationToken = null;

        do {
            const getAllUsersUrl = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetAllUsers`;
            const getAllUsersBody = {
                StartPosition: continuationToken,
                MaxResultsCount: 100, // Fetch up to 100 users per call
            };

            const usersResponse = await fetch(getAllUsersUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY,
                },
                body: JSON.stringify(getAllUsersBody),
            });

            // Log raw response from PlayFab
            const rawUsersResult = await usersResponse.text();
            console.log('Raw PlayFab GetAllUsers Response:', rawUsersResult);

            let usersResult;
            try {
                usersResult = JSON.parse(rawUsersResult);
            } catch (err) {
                console.error('Failed to parse PlayFab GetAllUsers response:', err.message);
                return res.status(500).json({ error: 'Invalid response from PlayFab' });
            }

            if (!usersResponse.ok) {
                console.error('Error fetching users:', usersResult);
                return res.status(usersResponse.status).json({
                    error: 'Error fetching users',
                    details: usersResult,
                });
            }

            // Iterate through users to find the matching customId
            for (const user of usersResult.Users || []) {
                if (user.CustomId === customId) {
                    foundPlayFabId = user.PlayFabId;
                    break;
                }
            }

            // Update the continuation token for the next batch of users
            continuationToken = usersResult.ContinuationToken;
        } while (continuationToken && !foundPlayFabId);

        if (!foundPlayFabId) {
            console.error('CustomId not found in PlayFab user list');
            return res.status(404).json({ error: 'CustomId not found' });
        }

        console.log('Resolved PlayFabId:', foundPlayFabId);

        // Step 2: Call ExecuteCloudScript using the resolved PlayFabId
        const executeCloudScriptUrl = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/ExecuteCloudScript`;
        const executeCloudScriptBody = {
            PlayFabId: foundPlayFabId,
            FunctionName: 'GetBanInfoFromCustomId',
            FunctionParameter: { customId },
            GeneratePlayStreamEvent: false,
        };

        const cloudScriptResponse = await fetch(executeCloudScriptUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY,
            },
            body: JSON.stringify(executeCloudScriptBody),
        });

        // Log raw response from ExecuteCloudScript
        const rawCloudScriptResult = await cloudScriptResponse.text();
        console.log('Raw PlayFab ExecuteCloudScript Response:', rawCloudScriptResult);

        let cloudScriptResult;
        try {
            cloudScriptResult = JSON.parse(rawCloudScriptResult);
        } catch (err) {
            console.error('Failed to parse PlayFab ExecuteCloudScript response:', err.message);
            return res.status(500).json({ error: 'Invalid response from PlayFab' });
        }

        if (!cloudScriptResponse.ok) {
            console.error('Error from PlayFab ExecuteCloudScript:', cloudScriptResult);
            return res.status(cloudScriptResponse.status).json({
                error: 'Error calling PlayFab ExecuteCloudScript',
                details: cloudScriptResult,
            });
        }

        console.log('Cloud Script Success:', cloudScriptResult);
        return res.status(200).json({
            success: true,
            data: cloudScriptResult.FunctionResult,
        });
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}

// Helper function to convert raw stream to string (used for parsing raw request body)
function streamToString(stream) {
    return new Promise((resolve, reject) => {
      let body = '';
      stream.on('data', (chunk) => {
        body += chunk.toString();
      });
      stream.on('end', () => resolve(body));
      stream.on('error', (err) => reject(err));
    });
  }
