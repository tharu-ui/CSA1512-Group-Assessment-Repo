# Smart Canteen Crowd & Token Predictor

Part of the CSA15 Cloud Computing and Big Data Analytics team assignment — Smart Campus Service Platform (CO1/CO2). This module predicts canteen crowd levels from historical check-in data and lets students reserve a virtual queue token before they leave for lunch.

## What it does

- Predicts crowd level (Low / Medium / High) for the next three lunch slots, based on the last 7 days of check-in history.
- Falls back to a "Medium" default with fewer than 3 days of data, instead of failing.
- Issues a queue token per student per slot, rejecting requests once a slot hits capacity (409 `SLOT_FULL`).
- Requires a bearer token on the token-issuance route; requests without one are rejected with 401.

## Project structure

canteen-module/
├── src/
│ ├── app.js # Express app entrypoint
│ ├── canteen.js # Prediction + token routes (tested version, in-memory store)
│ ├── canteen_mongodb_version.js # Draft version wired to MongoDB — not yet tested, see note below
│ └── store.js # In-memory data store standing in for MongoDB
├── tests/
│ └── run_tests.js # Runs the app and exercises all 4 test cases end to end
├── docs/
│ ├── architecture_diagram.png
│ └── canteen_test_evidence.png
├── package.json
└── README.md


## Setup

Requires [Node.js](https://nodejs.org) (tested on v24).
npm install

## Running the tests
node tests/run_tests.js

This starts the server, seeds sample check-in data, hits every endpoint, and prints observed status codes and response bodies for each test case, ending with a pass count (4/4 tests passed. on the current version).

## API

GET /api/canteen/prediction - Returns predicted crowd level for the next 3 slots
POST /api/canteen/checkin - Logs a canteen entry scan
POST /api/canteen/token - Issues a queue token (requires Authorization: Bearer <token>)

## Current status and next steps

src/canteen.js is the version that has actually been run and tested — it's the source of the 4/4 test results in the assignment's Section 5. It uses an in-memory store (store.js) rather than a live database, so it runs standalone with no setup.

src/canteen_mongodb_version.js is a draft for migrating to real MongoDB (via Mongoose models CheckinLog and Token, not yet included in this repo). It has NOT been run or tested — treat it as a starting point, not working code, until it's connected to a live database and re-tested.

## Known limitation carried over from the tested version : 
the token-capacity check (countActiveTokens then createToken) isn't atomic, so two simultaneous requests for the last token in a slot could both pass the capacity check before either write completes. A production version should use an atomic database operation (e.g. findOneAndUpdate with a count guard) to close this race condition.
