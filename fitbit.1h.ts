#!/usr/bin/env -S -P/${HOME}/.deno/bin:/usr/local/bin:/opt/homebrew/bin deno run --allow-net --allow-read --allow-write --allow-env
//
// This script uses the fitbit API to show you your Active Zone minutes for the last 7 days
//

import * as dotenv from "https://deno.land/std@0.178.0/dotenv/mod.ts";

// Get the folder of this script
const scriptPath = Deno.mainModule.substring(7);
// Change the current working directory to the directory of this script
Deno.chdir(scriptPath.substring(0, scriptPath.lastIndexOf("/")));

const env = await dotenv.load();

const FITBIT_CLIENT_ID = env["FITBIT_CLIENT_ID"];

if (!FITBIT_CLIENT_ID) {
  console.error("FITBIT_CLIENT_ID is not set");
  Deno.exit(1);
}

// Read the refresh token from a file, removing any trailing whitespace
const FITBIT_REFRESH_TOKEN = await Deno.readTextFile("./config/.fitbit_refresh_token")
  .then((text) => text.trim());

if (!FITBIT_REFRESH_TOKEN) {
  console.error("FITBIT_REFRESH_TOKEN is not set in .fitbit_refresh_token");
  Deno.exit(1);
}

// Firstly, get an access token
const tokenResponse = await fetch("https://api.fitbit.com/oauth2/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: FITBIT_REFRESH_TOKEN,
    client_id: FITBIT_CLIENT_ID,
  }),
});

// Get the access token and the new refresh token from the response
// And write the new refresh token to a file
const { access_token, refresh_token } = await tokenResponse.json();
await Deno.writeTextFile("./config/.fitbit_refresh_token", refresh_token);

// Now fetch the AZM from the intraday API, for the last 7 days
// /1/user/[user-id]/activities/active-zone-minutes/date/[start-date]/[end-date].json
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);
const endDate = new Date();
const response = await fetch(
  `https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/${
    startDate.toISOString().split("T")[0]
  }/${endDate.toISOString().split("T")[0]}.json`,
  {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  },
);

// Example response:
// {
//   "activities-active-zone-minutes": [
//     {
//       "dateTime": "2022-05-01",
//       "value": {
//         "activeZoneMinutes": 21,
//         "fatBurnActiveZoneMinutes": 5,
//         "cardioActiveZoneMinutes": 12,
//         "peakActiveZoneMinutes": 4
//       }
//     },
//     {
//       "dateTime": "2022-05-02",
//       "value": {
//         "activeZoneMinutes": 25,
//         "fatBurnActiveZoneMinutes": 7,
//         "cardioActiveZoneMinutes": 18,
//         "peakActiveZoneMinutes": 0
//       }
//     }
//   ]
// }

// Get today's AZM as well as the total for the last 7 days
const { "activities-active-zone-minutes": azm } = await response.json();
const today = azm[azm.length - 1].value.activeZoneMinutes;
const total = azm.reduce((acc, day) => acc + day.value.activeZoneMinutes, 0);

// Print the results
console.log(`${today} ⚡️ ${total}`);
