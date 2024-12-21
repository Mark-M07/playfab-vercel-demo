import fetch from 'node-fetch'; // If using Node 18+ you can also use globalThis.fetch

export default async function handler(req, res) {
  // Only allow POST for this function
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1) Parse request body
    const { customId } = req.body;
    if (!customId) {
      return res.status(400).json({ error: 'Missing customId' });
    }

    // 2) Prepare request to PlayFab
    //    You can either:
    //    A) Call GetAllUsers + GetUserBans
    //    B) Or call a custom CloudScript function you wrote ("GetBanInfoFromCustomId")
    //       as shown below.

    // Replace YOUR_PLAYFAB_TITLE_ID with your actual TitleId
    // Example of calling Cloud Script function "GetBanInfoFromCustomId"
    // If you have a direct server API call you want to use, you can swap the URL & body accordingly.
    const url = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/ExecuteCloudScript`;

    // Build the request body
    const body = {
      FunctionName: "GetBanInfoFromCustomId",
      FunctionParameter: { customId: customId },
      GeneratePlayStreamEvent: false
    };

    // 3) Call PlayFab using fetch
    const playFabResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY
      },
      body: JSON.stringify(body)
    });

    // Parse JSON
    const result = await playFabResponse.json();

    // 4) Handle errors or return the data
    if (!playFabResponse.ok) {
      return res.status(playFabResponse.status).json({
        error: result.error || 'Error calling PlayFab',
        details: result.errorMessage
      });
    }

    // If successful, you typically get a `FunctionResult` from the Cloud Script
    const { FunctionResult } = result;
    if (!FunctionResult) {
      return res.status(200).json({
        success: true,
        data: 'No ban data returned'
      });
    }

    // Return relevant info to client
    return res.status(200).json({
      success: true,
      data: FunctionResult
    });

  } catch (err) {
    console.error('Error in ban lookup:', err);
    return res.status(500).json({ error: err.message });
  }
}
