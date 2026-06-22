module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ── "Email me a copy" flag → Smartsheet checkbox column (Power Automate watches this) ──
    // "Send a copy" CHECKBOX column on the Traveller Profile sheet (298113280462724).
    const SEND_COPY_COL = 2130159334625156;
    const { sendCopy, ...payload } = req.body || {};
    if (sendCopy && SEND_COPY_COL) {
      payload.cells = payload.cells || [];
      payload.cells.push({ columnId: SEND_COPY_COL, value: true });
    }

    const response = await fetch('https://api.smartsheet.com/2.0/sheets/298113280462724/rows', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMARTSHEET_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Smartsheet error' });
    }

    // ── Mirror to Traveller Profile MasterSheet ──
    const d = {};
    const cells = (Array.isArray(payload) ? payload[0].cells : payload.cells) || [];
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
      { columnId: 5054810658475908, value: d.travellerType || '' },
      { columnId: 2797347930410884, value: d.hostName || '' },
      { columnId: 7970821628006276, value: d.expenseAccount || '' },
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
      { columnId: 7360592674590596, value: d.additionalNotes || '' }, // Special Requests (Additional Notes merged in)
      { columnId: 2067338580234116, value: today },
    ].filter(c => c.value !== '');

    // Fold retired/duplicate Traveller-master columns into their kept destination.
    const consolidateMaster = (cs) => {
      const RETIRE = { 323718256824196:3982892954062724, 2575518070509444:3982892954062724, 8259788067868548:652472233529220, 2294043093798788:652472233529220, 5156071860899716:7133888161025924, 2856993047220100:7133888161025924, 42243280113540:2067338580234116, 1168143186956164:4882088347340676, 605193233534852:2630288533655428, 2904272047214468:1504388626812804, 6129139651481476:2911763510366084 };
      const DESTS = new Set([3982892954062724,652472233529220,7133888161025924,2067338580234116,4882088347340676,2630288533655428,1504388626812804,2911763510366084]);
      const DATE_DEST = 2067338580234116;
      const pass = [], buckets = {}, order = [];
      for (const c of cs) { const d = RETIRE[c.columnId] || c.columnId; if (DESTS.has(d)) { if (!buckets[d]) { buckets[d] = []; order.push(d); } buckets[d].push(c.value); } else pass.push(c); }
      const out = pass.slice();
      for (const d of order) {
        if (d === DATE_DEST) { const v = buckets[d].find(x => x !== '' && x != null); if (v != null && v !== '') out.push({ columnId: d, value: v }); }
        else { const seen = new Set(), parts = []; for (let v of buckets[d]) { v = (v == null ? '' : String(v)).trim(); if (v && !seen.has(v.toLowerCase())) { seen.add(v.toLowerCase()); parts.push(v); } } if (parts.length) out.push({ columnId: d, value: parts.join('; ') }); }
      }
      return out;
    };
    const masterFinal = consolidateMaster(masterCells);

    await fetch('https://api.smartsheet.com/2.0/sheets/8780932377956228/rows', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMARTSHEET_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ toBottom: true, locked: true, cells: masterFinal }]) // bottom-append (was toTop) + locked so editors can't sort/move rows
    }).catch(err => console.error('Master sheet write failed:', err.message));

    // ── Mirror into the KCG Agent copy ("Copy of Traveller Profile MasterSheet") ──
    // The copy has new sheet + column IDs; translate each cell's columnId to
    // the copy's equivalent (matched by title). Best-effort; never blocks.
    const TRAVELLER_COPY_SHEET_ID = '7213505705889668';
    const TRAVELLER_ORIG_TO_COPY = {
      5054810658475908: 294551951806340,  // Traveller Type
      2797347930410884: 4798151579176836, // Host Name
      7970821628006276: 927870649405316,  // Expense Account
      5029597388509060: 3953726649044868, // Group ID
      6155241207926660: 8457326276415364, // Source
      5726513277472644: 2546351765491588, // First Name
      3474713463787396: 7049951392862084, // Middle Name
      7978313091157892: 1420451858648964, // Last Name
      659963696680836:  5361101532598148, // Date of Birth
      5163563324051332: 3109301718912900, // Gender
      2911763510366084: 7612901346283396, // Nationality
      7415363137736580: 1983401812070276, // Email Address
      1785863603523460: 6487001439440772, // Phone Number
      6289463230893956: 4235201625755524, // Company Name
      4037663417208708: 8738801253126020, // Passport Number
      8541263044579204: 153814463451012,  // Passport Expiry Date
      378488719970180:  4657414090821508, // Passport Country of Issue
      4882088347340676: 2405614277136260, // Departure City
      2630288533655428: 6909213904506756, // Seat Preference
      7133888161025924: 1279714370293636, // Meal Preference
      1504388626812804: 5783313997664132, // Special Assistance
      6007988254183300: 3531514183978884, // Airline Loyalty Programs
      3756188440498052: 8035113811349380, // Redress Number
      8259788067868548: 716764416872324,  // Known Traveller Number
      7360592674590596: 7964745067171716, // Special Requests (Additional Notes merged in)
      2067338580234116: 7472163857928068, // Submission Date
    };
    try {
      const copyCells = masterFinal
        .map(c => ({ columnId: TRAVELLER_ORIG_TO_COPY[c.columnId], value: c.value }))
        .filter(c => c.columnId);
      await fetch(`https://api.smartsheet.com/2.0/sheets/${TRAVELLER_COPY_SHEET_ID}/rows`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.SMARTSHEET_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ toTop: true, cells: copyCells }])
      }).catch(err => console.error('KCG Agent traveller copy mirror failed:', err.message));
    } catch (copyErr) {
      console.error('KCG Agent traveller copy mirror error:', copyErr.message);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
