import fetch from 'node-fetch';

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

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const { customId } = req.body;
        if (!customId) {
            return res.status(400).json({ error: 'Missing customId' });
        }

        const mappings = await getTitleData(process.env.PLAYFAB_TITLE_ID, process.env.PLAYFAB_DEV_SECRET_KEY);
        const playFabId = mappings[customId];

        if (!playFabId) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const bansResponse = await fetch(`https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetUserBans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY,
            },
            body: JSON.stringify({ PlayFabId: playFabId }),
        });

        const bansResult = await bansResponse.json();

        const activeBans = (bansResult.data.BanData || [])
            .filter(ban => ban.Active)
            .map(ban => ({
                reason: ban.Reason,
                expires: ban.Expires,
                created: ban.Created
            }));

        return res.status(200).json({
            success: true,
            data: {
                bans: activeBans
            }
        });

    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
