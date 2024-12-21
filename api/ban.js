import fetch from 'node-fetch';

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { customId } = req.body;
    if (!customId) {
      console.error('Missing customId in request body');
      return res.status(400).json({ error: 'Missing customId' });
    }

    console.log('Received customId:', customId);

    // Step 1: Resolve customId to PlayFabId
    const getPlayerCombinedInfoUrl = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetPlayerCombinedInfo`;
    const getPlayerCombinedInfoBody = {
      CustomId: customId,
      InfoRequestParameters: {
        GetUserAccountInfo: true,
      },
    };

    const combinedInfoResponse = await fetch(getPlayerCombinedInfoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY,
      },
      body: JSON.stringify(getPlayerCombinedInfoBody),
    });

    const combinedInfoResult = await combinedInfoResponse.json();

    if (!combinedInfoResponse.ok) {
      console.error('Error resolving customId to PlayFabId:', combinedInfoResult);
      return res.status(combinedInfoResponse.status).json({
        error: 'Error resolving customId to PlayFabId',
        details: combinedInfoResult,
      });
    }

    const playFabId = combinedInfoResult.data.UserAccountInfo.PlayFabId;
    console.log('Resolved PlayFabId:', playFabId);

    // Step 2: Call ExecuteCloudScript using the resolved PlayFabId
    const executeCloudScriptUrl = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/ExecuteCloudScript`;
    const executeCloudScriptBody = {
      PlayFabId: playFabId,
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

    const cloudScriptResult = await cloudScriptResponse.json();

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
