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

const url = require('url');
const { DialogflowApp, Responses } = require('actions-on-google');
const { RichResponse, BasicCard } = Responses;
const functions = require('firebase-functions');
const maps = require('@google/maps');

const config = functions.config();

const client = maps.createClient({
  key: config.maps.key
});

// Dialogflow actions
const Actions = {
  WELCOME: 'input.welcome',
  REQUEST_NAME_PERMISSION: 'request.name.permission',
  REQUEST_LOC_PERMISSION: 'request.location.permission',
  READ_MIND: 'read.mind',
  NEW_SURFACE: 'new.surface',
  UNHANDLED_DEEP_LINK: 'deeplink.unknown'
};

const STATIC_MAPS_ADDRESS = 'https://maps.googleapis.com/maps/api/staticmap';
const STATIC_MAPS_SIZE = '640x640';
const staticMapsURL = url.parse(STATIC_MAPS_ADDRESS);
staticMapsURL.query = {
  key: config.maps.key,
  size: STATIC_MAPS_SIZE
};

/**
 * Constructs a rich response consisting of a simple response and a basic card whose image shows
 * a Static Maps view centered on a city.
 *
 * @param {string} city
 * @param {string} speech
 */
const locationResponse = (city, speech) => {
  staticMapsURL.query.center = city;
  const mapViewURL = url.format(staticMapsURL);
  return new RichResponse()
    .addSimpleResponse(speech)
    .addBasicCard(new BasicCard().setImage(mapViewURL, 'City Map'));
};

/**
 * Sanitize template literal inputs by escaping characters into XML entities to use in SSML
 * Also normalize the extra spacing for better text rendering in SSML
 * A tag function used by ES6 tagged template literals
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_template_literals
 *
 * @example
 * const equation = '"1 + 1 > 1"';
 * const response = ssml`
 *   <speak>
 *     ${equation}
 *   </speak>
 * `;
 * // Equivalent to ssml`\n  <speak>\n    ${equation}\n  </speak>\n`
 * console.log(response);
 * // Prints: '<speak>&quot;1 + 1 &gt; 1&quot;</speak>'
 *
 * @param {TemplateStringsArray} template Non sanitized constant strings in the template literal
 * @param {Array<string>} inputs Computed expressions to be sanitized surrounded by ${}
 */
const ssml = (template, ...inputs) => template.reduce((out, str, i) => i
  ? out + (
    inputs[i - 1]
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  ) + str
  : str
).trim().replace(/\s+/g, ' ').replace(/ </g, '<').replace(/> /g, '>');

const responses = {
  /** @param {string} name */
  sayName: name => ssml`
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
  /** @param {string} city */
  sayLocation: city => locationResponse(city, ssml`
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
  /** @param {string} input */
  unhandledDeepLinks: input => ssml`
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
      This has never happened before. I cannot read your mind. I need more practice.
      Ask me again later.
    </speak>
  `,
  permissionReason: 'To read your mind',
  newSurfaceContext: 'To show you your location',
  notificationText: 'See you where you are...'
};

/**
 * @typedef {Object} AppData
 * @property {string=} requestedPermission
 */

/**
 * @typedef {Object} UserStorage
 * @property {string=} location
 * @property {string=} name
 */

class NamePsychic {
  /**
   * @param {ExpressRequest} req
   * @param {ExpressResponse} res
   */
  constructor (req, res) {
    console.log('Headers', JSON.stringify(req.headers, null, 2));
    console.log('Body', JSON.stringify(req.body, null, 2));

    this.app = new DialogflowApp({
      request: req,
      response: res
    });

    /** @type {AppData} */
    this.data = this.app.data;
    /** @type {UserStorage} */
    this.userStorage = this.app.userStorage;
    this.permissions = this.app.SupportedPermissions;
  }

  run () {
    /** @type {*} */
    const map = this;
    const action = this.app.getIntent();
    console.log(action);
    if (!action) {
      return this.app.tell(responses.readMindError);
    }
    const result = map[action]();
    if (result instanceof Promise) {
      result.catch(/** @param {Error} e */ e => {
        console.log('Error', e.toString(), e.stack);
        this.app.tell(responses.readMindError);
      });
    }
  }

  /**
   * Gets the city name from results returned by Google Maps reverse geocoding from coordinates.
   * @param {number} latitude
   * @param {number} longitude
   * @return {Promise<string>}
   */
  coordinatesToCity (latitude, longitude) {
    const latlng = [latitude, longitude];
    return new Promise((resolve, reject) => client.reverseGeocode({ latlng },
      /**
       * @param {Error} e
       * @param {Object<string, *>} response
       */
      (e, response) => {
        if (e) {
          return reject(e);
        }
        const { results } = response.json;
        /** @type {Array<Object<string, *>>} */
        const components = results[0].address_components;
        for (const component of components) {
          for (const type of component.types) {
            if (type === 'locality') {
              return resolve(component.long_name);
            }
          }
        }
        reject(new Error('Could not parse city name from Google Maps results'));
      }
    ));
  }

  /**
   * Shows the location of the user with a preference for a screen device. If on a speaker device,
   * asks to transfer dialog to a screen device.
   * Reads location from userStorage.
   */
  showLocationOnScreen () {
    /** @type {boolean} */
    const screenCapability = this.app.SurfaceCapabilities.SCREEN_OUTPUT;
    if (this.app.hasSurfaceCapability(screenCapability) ||
      !this.app.hasAvailableSurfaceCapabilities(screenCapability)) {
      this.app.tell(responses.sayLocation(this.userStorage.location));
    }
    this.app.askForNewSurface(responses.newSurfaceContext, responses.notificationText,
      [screenCapability]);
  }

  [Actions.WELCOME] () {
    this.app.ask(responses.greetUser);
  }

  [Actions.UNHANDLED_DEEP_LINK] () {
    this.app.ask(responses.unhandledDeepLinks(this.app.getRawInput()));
  }

  [Actions.REQUEST_NAME_PERMISSION] () {
    const requestedPermission = this.permissions.NAME;
    this.data.requestedPermission = requestedPermission;
    if (!this.userStorage.name) {
      return this.app.askForPermission(responses.permissionReason, requestedPermission);
    }
    this.app.tell(responses.sayName(this.userStorage.name));
  }

  [Actions.REQUEST_LOC_PERMISSION] () {
    // If the request comes from a phone, we can't use coarse location.
    const requestedPermission = this.app.hasSurfaceCapability(this.app.SurfaceCapabilities.SCREEN_OUTPUT)
      ? this.permissions.DEVICE_PRECISE_LOCATION
      : this.permissions.DEVICE_COARSE_LOCATION;
    this.data.requestedPermission = requestedPermission;
    if (!this.userStorage.location) {
      return this.app.askForPermission(responses.permissionReason, requestedPermission);
    }
    this.showLocationOnScreen();
  }

  [Actions.READ_MIND] () {
    if (!this.app.isPermissionGranted()) {
      return Promise.reject(new Error('Permission not granted'));
    }
    const requestedPermission = this.data.requestedPermission;
    if (requestedPermission === this.permissions.NAME) {
      this.userStorage.name = this.app.getUserName().displayName;
      return this.app.tell(responses.sayName(this.userStorage.name));
    }
    if (requestedPermission === this.permissions.DEVICE_COARSE_LOCATION) {
      // If we requested coarse location, it means that we're on a speaker device.
      this.userStorage.location = this.app.getDeviceLocation().city;
      this.showLocationOnScreen();
    }
    if (requestedPermission === this.permissions.DEVICE_PRECISE_LOCATION) {
      // If we requested precise location, it means that we're on a phone.
      // Because we will get only latitude and longitude, we need to reverse geocode
      // to get the city.
      const { coordinates } = this.app.getDeviceLocation();
      return this.coordinatesToCity(coordinates.latitude, coordinates.longitude)
        .then(city => {
          this.userStorage.location = city;
          this.showLocationOnScreen();
        });
    }
    return Promise.reject(new Error('Unrecognized permission'));
  }

  [Actions.NEW_SURFACE] () {
    this.app.tell(responses.sayLocation(this.userStorage.location));
  }
}

exports.namePsychic = functions.https.onRequest((req, res) => new NamePsychic(req, res).run());
