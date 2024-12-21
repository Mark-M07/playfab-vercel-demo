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
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        const { customId, playFabId } = req.body;
        if (!customId || !playFabId) {
            return res.status(400).json({ error: 'Missing customId or playFabId' });
        }

        const mappings = await getTitleData(process.env.PLAYFAB_TITLE_ID, process.env.PLAYFAB_DEV_SECRET_KEY);
        mappings[customId] = playFabId;
        await setTitleData(process.env.PLAYFAB_TITLE_ID, process.env.PLAYFAB_DEV_SECRET_KEY, mappings);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
