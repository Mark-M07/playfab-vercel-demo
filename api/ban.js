import fetch from 'node-fetch';

export default async function handler(req, res) {
    try {
      res.setHeader('Access-Control-Allow-Origin', '*'); // Enable CORS for Unity
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
  
      // Parse request body
      const { customId } = req.body;
      if (!customId) {
        console.error('Missing customId in request body');
        return res.status(400).json({ error: 'Missing customId' });
      }
  
      // Log received customId
      console.log('Received customId:', customId);
  
      // Call PlayFab Server API
      const url = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/ExecuteCloudScript`;
      const body = {
        FunctionName: "GetBanInfoFromCustomId",
        FunctionParameter: { customId },
        GeneratePlayStreamEvent: false
      };
  
      const playFabResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY
        },
        body: JSON.stringify(body)
      });
  
      const result = await playFabResponse.json();
  
      if (!playFabResponse.ok) {
        console.error('Error from PlayFab API:', result);
        return res.status(playFabResponse.status).json({
          error: 'Error calling PlayFab',
          details: result
        });
      }
  
      // Return response to client
      console.log('Success:', result);
      return res.status(200).json({
        success: true,
        data: result.FunctionResult
      });
  
    } catch (err) {
      console.error('Server error:', err);
      return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
  }
  
