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
const { DialogflowApp } = require('actions-on-google');
const functions = require('firebase-functions');
const firebaseAdmin = require('firebase-admin');
firebaseAdmin.initializeApp(functions.config().firebase);
const googleMapsClient = require('@google/maps').createClient({
  key: functions.config().geocoding.key
});

// Dialogflow actions
const WELCOME_ACTION = 'input.welcome';
const REQUEST_NAME_PERMISSION_ACTION = 'request_name_permission';
const REQUEST_LOC_PERMISSION_ACTION = 'request_location_permission';
const READ_MIND_ACTION = 'read_mind';
const UNHANDLED_DEEP_LINK_ACTION = 'deeplink.unknown';

// Entities/Firebase data keys
const LOCATION_DATA = 'location';
const NAME_DATA = 'name';

function encodeAsFirebaseKey (string) {
  return string.replace(/%/g, '%25')
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
}

exports.namePsychic = functions.https.onRequest((request, response) => {
  console.log('Request headers: ' + JSON.stringify(request.headers));
  console.log('Request body: ' + JSON.stringify(request.body));

  const app = new DialogflowApp({request, response});

  let hasScreen =
    app.hasSurfaceCapability(app.SurfaceCapabilities.SCREEN_OUTPUT);

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

  function greetUser (app) {
    app.ask(`<speak>Welcome to your Psychic! <break time="500ms"/> \
      My mind is more powerful than you know. I wonder which of your secrets \
      I shall unlock. Would you prefer I guess your name, or your \
      location?</speak>`);
  }

  function unhandledDeepLinks (app) {
    app.ask(`Welcome to your Psychic! I can guess many things about \
      you, but I cannot make guesses about \
      ${app.getRawInput()}. \
      Instead, I shall guess your name or location. Which do you prefer?`);
  }

  function requestNamePermission (app) {
    let permission = app.SupportedPermissions.NAME;
    app.data.permission = permission;
    return requestPermission(app, permission, NAME_DATA, sayName);
  }

  function requestLocationPermission (app) {
    let permission;
    // If the request comes from a phone, we can't use coarse location.
    if (hasScreen) {
      permission = app.SupportedPermissions.DEVICE_PRECISE_LOCATION;
    } else {
      permission = app.SupportedPermissions.DEVICE_COARSE_LOCATION;
    }
    app.data.permission = permission;
    return requestPermission(app, permission, LOCATION_DATA, sayLocation);
  }

  function requestPermission (app, permission, firebaseKey, speechCallback) {
    return new Promise(function (resolve, reject) {
      let userId = app.getUser().user_id;
      firebaseAdmin.database().ref('users/' + encodeAsFirebaseKey(userId))
        .once('value', function (data) {
          if (data && data.val() && data.val()[firebaseKey]) {
            let speechOutput = speechCallback(data.val()[firebaseKey]);
            resolve(app.tell(speechOutput));
          } else {
            resolve(app.askForPermission('To read your mind', permission));
          }
        });
    });
  }

  // Parse city name from the results returned by Google Maps reverse geocoding.
  function parseCityFromReverseGeocoding (results) {
    let addressComponents = results[0].address_components;
    for (let component of addressComponents) {
      for (let type of component.types) {
        if (type === 'locality') {
          return component.long_name;
        }
      }
    }
  }

  function readMind (app) {
    if (app.isPermissionGranted()) {
      let permission = app.data.permission;
      let userData;
      let firebaseKey;
      let speechCallback;
      if (permission === app.SupportedPermissions.NAME) {
        userData = app.getUserName().displayName;
        firebaseKey = NAME_DATA;
        speechCallback = sayName;
        readMindResponse(app, userData, firebaseKey, speechCallback);
      } else if (permission === app.SupportedPermissions.DEVICE_COARSE_LOCATION) {
        userData = app.getDeviceLocation().city;
        firebaseKey = LOCATION_DATA;
        speechCallback = sayLocation;
        readMindResponse(app, userData, firebaseKey, speechCallback);
      } else if (permission === app.SupportedPermissions.DEVICE_PRECISE_LOCATION) {
        // If we required precise location, it means that we're on a phone.
        // Because we will get only latitude and longitude, we need to reverse geocode
        // to get the city.
        let deviceCoordinates = app.getDeviceLocation().coordinates;
        let latLng = [deviceCoordinates.latitude, deviceCoordinates.longitude];
        googleMapsClient.reverseGeocode({latlng: latLng}, function (err, response) {
          if (!err) {
            userData = parseCityFromReverseGeocoding(response.json.results);
            firebaseKey = LOCATION_DATA;
            speechCallback = sayLocation;
            readMindResponse(app, userData, firebaseKey, speechCallback);
          } else {
            readMindError();
          }
        });
      } else {
        readMindError();
      }
    } else {
      readMindError();
    }
  }

  function readMindResponse (app, userData, firebaseKey, speechCallback) {
    let userId = app.getUser().user_id;

      // Save [User ID]:[{<name or location>: <data>}] to Firebase
      // Note: Users can reset User ID at any time.
    firebaseAdmin.database().ref('users/' + encodeAsFirebaseKey(userId)).update({
      [firebaseKey]: userData
    });

    app.tell(speechCallback(userData));
  }

  function readMindError () {
      // User did not grant permission or reverse geocoding failed.
    app.tell(`<speak>Wow! <break time="1s"/> This has never \
        happened before. I cannot read your mind. I need more practice. \
        Ask me again later.</speak>`);
  }

  let actionMap = new Map();
  actionMap.set(WELCOME_ACTION, greetUser);
  actionMap.set(UNHANDLED_DEEP_LINK_ACTION, unhandledDeepLinks);
  actionMap.set(REQUEST_NAME_PERMISSION_ACTION, requestNamePermission);
  actionMap.set(REQUEST_LOC_PERMISSION_ACTION, requestLocationPermission);
  actionMap.set(READ_MIND_ACTION, readMind);

  app.handleRequest(actionMap);
});
