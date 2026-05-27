module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await fetch('https://api.smartsheet.com/2.0/sheets/298113280462724/rows', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMARTSHEET_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Smartsheet error' });
    }

    // ── Mirror to Traveller Profile MasterSheet ──
    const d = {};
    const cells = req.body && (Array.isArray(req.body) ? req.body[0].cells : req.body.cells) || [];
    const FORM_COL = {
      2862616417701764: 'groupId',
      7366216045072260: 'firstName',
      820513382633348:  'middleName',
      1736716510859140: 'lastName',
      6240316138229636: 'dateOfBirth',
      3988516324544388: 'gender',
      8492115951914884: 'nationality',
      329341627305860:  'emailAddress',
      4832941254676356: 'expenseAccount',
      2581141440991108: 'phoneNumber',
      5536271777959812: 'companyName',
      7084741068361604: 'passportNumber',
      1455241534148484: 'passportExpiryDate',
      5958841161518980: 'passportCountryOfIssue',
      3707041347833732: 'knownTravellerNumber',
      892291580727172:  'redressNumber',
      8572212360810372: 'departureCity',
      5395891208097668: 'seatPreference',
      3144091394412420: 'mealPreference',
      2018191487569796: 'specialAssistance',
      4269991301255044: 'airlineLoyaltyPrograms',
      8773590928625540: 'additionalNotes',
    };
    for (const cell of cells) {
      const key = FORM_COL[cell.columnId];
      if (key) d[key] = cell.value;
    }

    const today = new Date().toISOString().split('T')[0];
    const masterCells = [
      { columnId: 5029597388509060, value: d.groupId || '' },
      { columnId: 6155241207926660, value: 'Traveller Profile Form' },
      { columnId: 5726513277472644, value: d.firstName || '' },
      { columnId: 3474713463787396, value: d.middleName || '' },
      { columnId: 7978313091157892, value: d.lastName || '' },
      { columnId: 659963696680836,  value: d.dateOfBirth || '' },
      { columnId: 5163563324051332, value: d.gender || '' },
      { columnId: 2911763510366084, value: d.nationality || '' },
      { columnId: 7415363137736580, value: d.emailAddress || '' },
      { columnId: 1785863603523460, value: d.phoneNumber || '' },
      { columnId: 6289463230893956, value: d.companyName || '' },
      { columnId: 4037663417208708, value: d.passportNumber || '' },
      { columnId: 8541263044579204, value: d.passportExpiryDate || '' },
      { columnId: 378488719970180,  value: d.passportCountryOfIssue || '' },
      { columnId: 4882088347340676, value: d.departureCity || '' },
      { columnId: 2630288533655428, value: d.seatPreference || '' },
      { columnId: 7133888161025924, value: d.mealPreference || '' },
      { columnId: 1504388626812804, value: d.specialAssistance || '' },
      { columnId: 6007988254183300, value: d.airlineLoyaltyPrograms || '' },
      { columnId: 3756188440498052, value: d.redressNumber || '' },
      { columnId: 8259788067868548, value: d.knownTravellerNumber || '' },
      { columnId: 7696838114447236, value: d.additionalNotes || '' },
      { columnId: 2067338580234116, value: today },
    ].filter(c => c.value !== '');

    await fetch('https://api.smartsheet.com/2.0/sheets/8780932377956228/rows', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMARTSHEET_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ toTop: true, cells: masterCells }])
    }).catch(err => console.error('Master sheet write failed:', err.message));

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
