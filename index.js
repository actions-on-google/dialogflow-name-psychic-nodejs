// Copyright 2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

process.env.DEBUG = 'actions-on-google:*';
const ApiAiAssistant = require('actions-on-google').ApiAiAssistant;
const firebaseAdmin = require('firebase-admin');

// Import local JSON file as Cloud Function dependency
const cert = require('path/to/serviceAccountKey.json');

// API.AI actions
const WELCOME_ACTION = 'input.welcome';
const REQUEST_NAME_PERMISSION_ACTION = 'request_name_permission';
const REQUEST_LOC_PERMISSION_ACTION = 'request_location_permission';
const READ_MIND_ACTION = 'read_mind';
const UNHANDLED_DEEP_LINK_ACTION = 'deeplink.unknown';

// Entities/Firebase data keys
const LOCATION_DATA = 'location';
const NAME_DATA = 'name';

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(cert),
  databaseURL: 'https://<DATABASE_NAME>.firebaseio.com'
});

// [START permissions]
exports.namePsychic = (req, res) => {
  console.log('Request headers: ' + JSON.stringify(req.headers));
  console.log('Request body: ' + JSON.stringify(req.body));

  const assistant = new ApiAiAssistant({request: req, response: res});

  function sayName (displayName) {
    return `<speak>I am reading your mind now. \
      <break time="2s"/> This is easy, you are ${displayName} \
      <break time="500ms"/> I hope I pronounced that right. \
      <break time="500ms"/> Okay! I am off to read more minds.</speak>`;
  }

  function sayLocation (city) {
    return `<speak>I am reading your mind now. \
      <break time="2s"/> This is easy, you are in ${city} \
      <break time="500ms"/> That is a beautiful town. \
      <break time="500ms"/> Okay! I am off to read more minds.</speak>`;
  }

  function greetUser (assistant) {
    assistant.ask(`<speak>Welcome to your Psychic! <break time="500ms"/> \
      My mind is more powerful than you know. I wonder which of your secrets \
      I shall unlock. Would you prefer I guess your name, or your \
      location?</speak>`);
  }

  function unhandledDeepLinks (assistant) {
    assistant.ask(`Welcome to your Psychic! I can guess many things about \
      you, but I cannot make guesses about \
      ${assistant.getRawInput()}. \
      Instead, I shall guess your name or location. Which do you prefer?`);
  }

  function requestNamePermission (assistant) {
    let permission = assistant.SupportedPermissions.NAME;
    assistant.data.permission = permission;
    return requestPermission(assistant, permission, NAME_DATA, sayName);
  }

  function requestLocationPermission (assistant) {
    let permission = assistant.SupportedPermissions.DEVICE_COARSE_LOCATION;
    // For more precise location data, use
    // assistant.SupportedPermissions.DEVICE_PRECISE_LOCATION
    assistant.data.permission = permission;
    return requestPermission(assistant, permission, LOCATION_DATA, sayLocation);
  }

  function requestPermission (assistant, permission, firebaseKey, speechCallback) {
    return new Promise(function (resolve, reject) {
      let userId = assistant.getUser().user_id;
      firebaseAdmin.database().ref('users/' + userId)
        .once('value', function (data) {
          if (data && data.val() && data.val()[firebaseKey]) {
            let speechOutput = speechCallback(data.val()[firebaseKey]);
            resolve(assistant.tell(speechOutput));
          } else {
            resolve(assistant.askForPermission('To read your mind', permission));
          }
        });
    });
  }

  function readMind (assistant) {
    if (assistant.isPermissionGranted()) {
      let permission = assistant.data.permission;
      let userData;
      let firebaseKey;
      let speechCallback;
      if (permission === assistant.SupportedPermissions.NAME) {
        userData = assistant.getUserName().displayName;
        firebaseKey = NAME_DATA;
        speechCallback = sayName;
      } else if (permission === assistant.SupportedPermissions.DEVICE_COARSE_LOCATION) {
        userData = assistant.getDeviceLocation().city;
        firebaseKey = LOCATION_DATA;
        speechCallback = sayLocation;
      }

      let userId = assistant.getUser().user_id;

      // Save [User ID]:[{<name or location>: <data>}] to Firebase
      // Note: Users can reset User ID at any time.
      firebaseAdmin.database().ref('users/' + userId).update({
        [firebaseKey]: userData
      });

      assistant.tell(speechCallback(userData));
    } else {
      // Response shows that user did not grant permission
      assistant.tell(`<speak>Wow! <break time="1s"/> This has never \
        happened before. I can't read your mind. I need more practice. \
        Ask me again later.</speak>`);
    }
  }

  let actionMap = new Map();
  actionMap.set(WELCOME_ACTION, greetUser);
  actionMap.set(UNHANDLED_DEEP_LINK_ACTION, unhandledDeepLinks);
  actionMap.set(REQUEST_NAME_PERMISSION_ACTION, requestNamePermission);
  actionMap.set(REQUEST_LOC_PERMISSION_ACTION, requestLocationPermission);
  actionMap.set(READ_MIND_ACTION, readMind);

  assistant.handleRequest(actionMap);
};
// [END permissions]
