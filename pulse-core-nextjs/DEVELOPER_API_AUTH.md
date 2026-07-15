# AfyaHero Hospital OS Developer API Auth

This guide documents how AfyaHero company apps (Patient App, CHP App, and partner internal apps) authenticate to AfyaHero Hospital OS Developer APIs.

## 1) Required headers

Every request from a developer app must include:

- `x-afyahero-app-id`: App identifier
- `x-afyahero-app-key`: App key
- `x-afyahero-timestamp`: Unix epoch time in milliseconds
- `x-afyahero-signature`: HMAC SHA-256 hex signature

Legacy compatibility headers are still accepted for now:

- `x-afyahero-client-id` (legacy for app id)
- `x-afyahero-api-key` (legacy for app key)

## 2) Signature format

The signature payload string is:

`METHOD + "\n" + PATH_AND_QUERY + "\n" + TIMESTAMP`

Where:

- `METHOD` is uppercase HTTP method (for example `GET`, `POST`)
- `PATH_AND_QUERY` is URL path + query string (for example `/api/fhir/Patient?_count=20`)
- `TIMESTAMP` is the same value sent in `x-afyahero-timestamp`

The server computes:

`HMAC_SHA256(signingSecret, payload).hex()`

and compares it to `x-afyahero-signature`.

## 3) Replay and clock protections

- Signature timestamps are accepted only within a 5-minute window.
- Duplicate signed requests are rejected within the replay window.
- Always generate a fresh timestamp and signature per request.

## 4) Environment configuration (Hospital OS)

Set `AFYAHERO_DEVELOPER_APPS_JSON` on the server:

```json
[
  {
    "appId": "patient-mobile-app",
    "appKey": "replace_with_app_key",
    "signingSecret": "replace_with_signing_secret",
    "hospitalId": "hospital_123",
    "appType": "patient_app",
    "scopes": ["fhir:read"]
  },
  {
    "appId": "chp-mobile-app",
    "appKey": "replace_with_app_key",
    "signingSecret": "replace_with_signing_secret",
    "hospitalId": "hospital_123",
    "appType": "chp_app",
    "scopes": ["fhir:read", "fhir:write"]
  }
]
```

Notes:

- `signingSecret` should be unique per app and rotated periodically.
- If `signingSecret` is omitted, server falls back to `appKey` for signing.
- Scope checks are enforced (`fhir:read`, `fhir:write`).

## 5) Node.js signing example

```js
import crypto from 'crypto';

function signRequest({ method, pathAndQuery, timestamp, signingSecret }) {
  const payload = `${method.toUpperCase()}\n${pathAndQuery}\n${timestamp}`;
  return crypto.createHmac('sha256', signingSecret).update(payload).digest('hex');
}

async function callFhir() {
  const appId = process.env.AFYAHERO_APP_ID;
  const appKey = process.env.AFYAHERO_APP_KEY;
  const signingSecret = process.env.AFYAHERO_SIGNING_SECRET;
  const method = 'GET';
  const pathAndQuery = '/api/fhir/Patient?_count=20';
  const timestamp = Date.now().toString();

  const signature = signRequest({ method, pathAndQuery, timestamp, signingSecret });

  const res = await fetch(`https://hospital.afyahero.com${pathAndQuery}`, {
    method,
    headers: {
      'x-afyahero-app-id': appId,
      'x-afyahero-app-key': appKey,
      'x-afyahero-timestamp': timestamp,
      'x-afyahero-signature': signature,
    },
  });

  if (!res.ok) {
    throw new Error(`FHIR request failed: ${res.status}`);
  }
  return res.json();
}
```

## 6) React Native / JavaScript example

```js
import CryptoJS from 'crypto-js';

function signRequest(method, pathAndQuery, timestamp, signingSecret) {
  const payload = `${method.toUpperCase()}\n${pathAndQuery}\n${timestamp}`;
  return CryptoJS.HmacSHA256(payload, signingSecret).toString(CryptoJS.enc.Hex);
}

export async function fetchPatientBundle(baseUrl, appId, appKey, signingSecret) {
  const method = 'GET';
  const pathAndQuery = '/api/fhir/Patient?_count=20';
  const timestamp = Date.now().toString();
  const signature = signRequest(method, pathAndQuery, timestamp, signingSecret);

  const response = await fetch(`${baseUrl}${pathAndQuery}`, {
    method,
    headers: {
      'x-afyahero-app-id': appId,
      'x-afyahero-app-key': appKey,
      'x-afyahero-timestamp': timestamp,
      'x-afyahero-signature': signature,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}
```

## 7) Operational recommendations

- Store app keys/secrets in secure secret storage, never in source code.
- Rotate `appKey` and `signingSecret` on a schedule (for example every 90 days).
- Maintain app-level scopes based on least privilege.
- Monitor failed signature and replay attempts as security events.
- For sensitive write APIs, also require idempotency keys where supported.

## 8) Onboarding verification endpoint

Use `GET /api/developer/auth/verify` to validate that app credentials and request signing are configured correctly before calling clinical endpoints.

Important details:

- This endpoint verifies credentials and signature.
- It does not enforce replay blocking to support repeated integration testing.
- Production FHIR routes still enforce replay protection.

## 8.1) App token lifecycle (v1 app auth)

For the v1 app auth token flow used by app-facing endpoints:

- Access token TTL is 15 minutes.
- Refresh token TTL is 7 days.
- Server requires `AFYAHERO_V1_APP_TOKEN_SECRET` (keep in secret storage, do not commit).

Example `curl` (replace placeholders):

```bash
curl -X GET "https://hospital.afyahero.com/api/developer/auth/verify" \
  -H "x-afyahero-app-id: <app-id>" \
  -H "x-afyahero-app-key: <app-key>" \
  -H "x-afyahero-timestamp: <timestamp-ms>" \
  -H "x-afyahero-signature: <hmac-hex>"
```

## 9) Postman onboarding assets

Ready-to-import files are included at repository root:

- `AfyaHero-Developer-API.postman_collection.json`
- `AfyaHero-Developer-API.postman_environment.json`

Collection includes:

- Verify auth request
- FHIR Patient search (read scope)
- FHIR Observation create (write scope)

The collection pre-request script auto-generates:

- `timestampMs`
- `signature`
- `isoNow`

## 10) CI smoke test script

A runnable smoke test is included:

- `scripts/verify-developer-auth.mjs`
- npm script: `npm run verify:developer-auth`

Required env vars:

- `AFYAHERO_BASE_URL` (for example `https://hospital.afyahero.com`)
- `AFYAHERO_APP_ID`
- `AFYAHERO_APP_KEY`
- `AFYAHERO_SIGNING_SECRET`

Example:

```bash
AFYAHERO_BASE_URL=https://hospital.afyahero.com \
AFYAHERO_APP_ID=patient-mobile-app \
AFYAHERO_APP_KEY=replace_with_app_key \
AFYAHERO_SIGNING_SECRET=replace_with_signing_secret \
npm run verify:developer-auth
```

