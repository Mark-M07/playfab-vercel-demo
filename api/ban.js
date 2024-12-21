import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
};

async function getTitleData(titleId, secretKey) {
    const response = await fetch(`https://${titleId}.playfabapi.com/Server/GetTitleData`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-SecretKey': secretKey
        },
        body: JSON.stringify({
            Keys: ["idMappings"]
        })
    });
    const data = await response.json();
    try {
        return JSON.parse(data.data.Data.idMappings || '{}');
    } catch (e) {
        console.error('Failed to parse idMappings:', e);
        return {};
    }
}

async function setTitleData(titleId, secretKey, mappings) {
    const response = await fetch(`https://${titleId}.playfabapi.com/Server/SetTitleData`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-SecretKey': secretKey
        },
        body: JSON.stringify({
            Key: "idMappings",
            Value: JSON.stringify(mappings)
        })
    });
    return response.json();
}

export default async function handler(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        let body;
        try {
            body = req.body ? req.body : JSON.parse(await streamToString(req));
        } catch (err) {
            console.error('Failed to parse request body:', err.message);
            return res.status(400).json({ error: 'Invalid JSON in request body' });
        }

        const { action, customId, playFabId } = body;

        // Handle different actions
        switch (action) {
            case 'store': {
                if (!customId || !playFabId) {
                    return res.status(400).json({ error: 'Missing customId or playFabId' });
                }

                const mappings = await getTitleData(process.env.PLAYFAB_TITLE_ID, process.env.PLAYFAB_DEV_SECRET_KEY);
                mappings[customId] = playFabId;
                await setTitleData(process.env.PLAYFAB_TITLE_ID, process.env.PLAYFAB_DEV_SECRET_KEY, mappings);

                return res.status(200).json({
                    success: true,
                    message: 'Mapping stored successfully'
                });
            }

            case 'lookup': {
                if (!customId) {
                    return res.status(400).json({ error: 'Missing customId' });
                }

                const mappings = await getTitleData(process.env.PLAYFAB_TITLE_ID, process.env.PLAYFAB_DEV_SECRET_KEY);
                const storedPlayFabId = mappings[customId];

                if (!storedPlayFabId) {
                    return res.status(404).json({ error: 'CustomId not found' });
                }

                // Get ban information
                const bansResponse = await fetch(`https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetUserBans`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY,
                    },
                    body: JSON.stringify({ PlayFabId: storedPlayFabId }),
                });

                const bansResult = await bansResponse.json();

                const activeBans = (bansResult.data.BanData || [])
                    .filter(ban => ban.Active)
                    .map(ban => ({
                        reason: ban.Reason,
                        expires: ban.Expires,
                        created: ban.Created,
                        active: ban.Active
                    }));

                return res.status(200).json({
                    success: true,
                    data: {
                        playFabId: storedPlayFabId,
                        bans: activeBans
                    }
                });
            }

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
}

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
