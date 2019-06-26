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

const functions = require('firebase-functions');
const url = require('url');
const {
  dialogflow,
  Image,
  Permission,
  NewSurface,
} = require('actions-on-google');
const {ssml} = require('./util');

const config = functions.config();
const STATIC_MAPS_ADDRESS = 'https://maps.googleapis.com/maps/api/staticmap';
const STATIC_MAPS_SIZE = '640x640';

const locationResponse = (city, speech) => {
  const staticMapsURL = url.parse(STATIC_MAPS_ADDRESS, true);
  staticMapsURL.query = {
    key: config.maps.key,
    size: STATIC_MAPS_SIZE,
  };
  staticMapsURL.query.center = city;
  const mapViewURL = url.format(staticMapsURL);
  return [
    speech,
    new Image({
      url: mapViewURL,
      alt: 'City Map',
    }),
  ];
};

const responses = {
  sayName: (name) => ssml`
    <speak>
      I am reading your mind now.
      <break time="2s"/>
      This is easy, you are ${name}
      <break time="500ms"/>
      I hope I pronounced that right.
      <break time="500ms"/>
      Okay! I am off to read more minds.
    </speak>
  `,
  sayLocation: (city) => locationResponse(city, ssml`
    <speak>
      I am reading your mind now.
      <break time="2s"/>
      This is easy, you are in ${city}
      <break time="500ms"/>
      That is a beautiful town.
      <break time="500ms"/>
      Okay! I am off to read more minds.
    </speak>
  `),
  greetUser: ssml`
    <speak>
      Welcome to your Psychic!
      <break time="500ms"/>
      My mind is more powerful than you know.
      I wonder which of your secrets I shall unlock.
      Would you prefer I guess your name, or your location?
    </speak>
  `,
  unhandledDeepLinks: (input) => ssml`
    <speak>
      Welcome to your Psychic! I can guess many things about you,
      but I cannot make guesses about ${input}.
      Instead, I shall guess your name or location. Which do you prefer?
    </speak>
  `,
  readMindError: ssml`
    <speak>
      Wow!
      <break time="1s"/>
      This has never happened before. I cannot read your mind.
      I need more practice.
      Ask me again later.
    </speak>
  `,
  permissionReason: 'To read your mind',
  newSurfaceContext: 'To show you your location',
  notificationText: 'See you where you are...',
};

/**
 * Shows the location of the user with a preference for a screen device.
 * If on a speaker device, asks to transfer dialog to a screen device.
 * Reads location from userStorage.
 * @param {object} conv - The conversation instance.
 * @return {Void}
 */
const showLocationOnScreen = (conv) => {
  const capability = 'actions.capability.SCREEN_OUTPUT';
  if (conv.surface.capabilities.has(capability) ||
    !conv.available.surfaces.capabilities.has(capability)) {
    return conv.close(...responses.sayLocation(userData(conv).location));
  }
  conv.ask(new NewSurface({
    context: responses.newSurfaceContext,
    notification: responses.notificationText,
    capabilities: capability,
  }));
};

/**
 * Depending on user verification status, save data either to dialog session
 * (conv.data) or cross-session storage (conv.user.storage). Users must be
 * verified to use cross-session storage, but it provides ideal UX.
 * https://developers.google.com/actions/assistant/guest-users
 * @param {object} conv - The conversation instance.
 * @return {Object}
 */
const userData = (conv) => {
  return conv.user.verification === 'VERIFIED' ? conv.user.storage : conv.data;
};

const app = dialogflow({debug: true});

app.intent('Default Welcome Intent', (conv) => {
  // userData(conv) = {}
  // Uncomment above to delete the cached permissions on each request
  // to force the app to request new permissions from the user

  // Location permissions only work for verified users
  if (conv.user.verification === 'VERIFIED') {
    conv.ask(responses.greetUser);
  } else {
    conv.ask(new Permission({
      context: responses.permissionReason,
      permissions: conv.data.requestedPermission,
    }));
  }
});

app.intent('Unrecognized Deep Link Fallback', (conv) => {
  conv.ask(responses.unhandledDeepLinks(conv.query));
});

app.intent('request_name_permission', (conv) => {
  conv.data.requestedPermission = 'NAME';
  if (!conv.user.storage.name) {
    return conv.ask(new Permission({
      context: responses.permissionReason,
      permissions: conv.data.requestedPermission,
    }));
  }
  conv.close(responses.sayName(conv.user.storage.name));
});

app.intent('request_location_permission', (conv) => {
  // 'DEVICE_COARSE_LOCATION' will provide a street address.
  // ['DEVICE_PRECISE_LOCATION'](https://developers.google.com/actions/assistant/helpers#user_information) can be used for geolocation.
  conv.data.requestedPermission = 'DEVICE_COARSE_LOCATION';

  if (!conv.user.storage.location) {
    return conv.ask(new Permission({
      context: responses.permissionReason,
      permissions: conv.data.requestedPermission,
    }));
  }
  showLocationOnScreen(conv);
});

app.intent('handle_permission', (conv, params, permissionGranted) => {
  if (!permissionGranted) {
    throw new Error('Permission not granted');
  }
  const {requestedPermission} = conv.data;
  if (requestedPermission === 'NAME') {
    conv.user.storage.name = conv.user.name.display;
    return conv.close(responses.sayName(conv.user.storage.name));
  }
  if (requestedPermission === 'DEVICE_COARSE_LOCATION') {
    userData(conv).location = conv.device.location.city;
    return showLocationOnScreen(conv);
  }
  throw new Error('Unrecognized permission');
});

app.intent('new_surface', (conv) => {
  conv.close(...responses.sayLocation(userData(conv).location));
});

app.catch((conv, e) => {
  console.error(e);
  conv.close(responses.readMindError);
});

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
