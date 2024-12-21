import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
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
            body = req.body ? req.body : JSON.parse(await streamToString(req));
        } catch (err) {
            console.error('Failed to parse request body:', err.message);
            return res.status(400).json({ error: 'Invalid JSON in request body' });
        }

        const { playFabId } = body;
        if (!playFabId) {
            console.error('Missing playFabId in request body');
            return res.status(400).json({ error: 'Missing playFabId' });
        }

        console.error('Received playFabId:', playFabId);

        // Call GetUserBans API directly
        const getUserBansUrl = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetUserBans`;
        const getUserBansBody = {
            PlayFabId: playFabId
        };

        const bansResponse = await fetch(getUserBansUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY,
            },
            body: JSON.stringify(getUserBansBody),
        });

        const rawBansResponse = await bansResponse.text();
        console.error('Raw GetUserBans Response:', rawBansResponse);

        let bansResult;
        try {
            bansResult = JSON.parse(rawBansResponse);
        } catch (err) {
            console.error('Failed to parse GetUserBans response:', err.message);
            return res.status(500).json({ error: 'Invalid response from PlayFab', details: rawBansResponse });
        }

        if (!bansResponse.ok) {
            console.error('Error fetching bans:', bansResult);
            return res.status(bansResponse.status).json({
                error: 'Error fetching bans',
                details: bansResult,
            });
        }

        // Filter to only return active bans and relevant information
        const activeBans = (bansResult.data.BanData || []).filter(ban => ban.Active).map(ban => ({
            reason: ban.Reason,
            expires: ban.Expires,
            created: ban.Created,
            active: ban.Active
        }));

        console.error('Returning ban data:', activeBans);
        return res.status(200).json({
            success: true,
            data: {
                bans: activeBans
            }
        });

    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}

// Helper function to convert raw stream to string
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
