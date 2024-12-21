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

    // Step 1: Search for PlayFabId by customId using GetAllUsers
    let foundPlayFabId = null;
    let continuationToken = null;

    do {
      const getAllUsersUrl = `https://${process.env.PLAYFAB_TITLE_ID}.playfabapi.com/Server/GetAllUsers`;
      const getAllUsersBody = {
        StartPosition: continuationToken,
        MaxResultsCount: 100 // Fetch up to 100 users per call
      };

      const usersResponse = await fetch(getAllUsersUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SecretKey': process.env.PLAYFAB_DEV_SECRET_KEY,
        },
        body: JSON.stringify(getAllUsersBody),
      });

      const usersResult = await usersResponse.json();

      if (!usersResponse.ok) {
        console.error('Error fetching users:', usersResult);
        return res.status(usersResponse.status).json({
          error: 'Error fetching users',
          details: usersResult,
        });
      }

      // Iterate through users to find the matching customId
      for (const user of usersResult.Users) {
        if (user.CustomId === customId) {
          foundPlayFabId = user.PlayFabId;
          break;
        }
      }

      // Update the continuation token for the next batch of users
      continuationToken = usersResult.ContinuationToken;
    } while (continuationToken && !foundPlayFabId);

    if (!foundPlayFabId) {
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
