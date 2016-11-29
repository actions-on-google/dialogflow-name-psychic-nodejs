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
let ApiAiAssistant = require('actions-on-google').ApiAiAssistant;
let firebaseAdmin = require('firebase-admin');
let express = require('express');
let bodyParser = require('body-parser');

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

const REQUEST_PERMISSION_ACTION = 'request_permission';
const READ_MIND_ACTION = 'read_mind';

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert('path/to/serviceAccountKey.json'),
  databaseURL: 'https://<DATABASE_NAME>.firebaseio.com'
});

// [START permissions]
app.post('/', function (req, res) {
  console.log('Request headers: ' + JSON.stringify(req.headers));
  console.log('Request body: ' + JSON.stringify(req.body));

  const assistant = new ApiAiAssistant({request: req, response: res});

  function sayName (displayName) {
    return '<speak>I am reading your mind now. ' +
      '<break time="2s"/> This is easy, you are ' + displayName + '. ' +
      '<break time="500ms"/> I hope I pronounced that right. ' +
      '<break time="500ms"/> Okay! I am off to read more minds.</speak>';
  }

  function requestPermission (assistant) {
    return new Promise(function (resolve, reject) {
      let userId = assistant.getUser().user_id;
      firebaseAdmin.database().ref('users/' + userId)
        .once('value', function (data) {
          if (data && data.val()) {
            resolve(assistant.tell(sayName(data.val().name)));
          } else {
            let permission = assistant.SupportedPermissions.NAME;
            resolve(assistant.askForPermission('To read your mind', permission));
          }
        });
    });
  }

  function readMind (assistant) {
    for (let input of req.body.originalRequest.data.inputs) {
      if (input.arguments) {
        for (let argument of input.arguments) {
          if (argument.name === assistant.BuiltInArgNames.PERMISSION_GRANTED &&
            argument.text_value === 'true') {
            if (assistant.getUser() && assistant.getUser().profile) {
              let userId = assistant.getUser().user_id;
              let displayName = assistant.getUser().profile.display_name;

              // Save to Firebase
              firebaseAdmin.database().ref('users/' + userId).set({
                name: displayName
              });

              assistant.tell(sayName(displayName));
              return;
            }
          }
        }
      }
    }
    // Response shows that user did not grant permission
    assistant.tell('<speak>Wow! <break time="1s"/> this has never ' +
      'happened before. I can\'t read your mind. I need more practice. ' +
      'Ask me again later.</speak>');
  }

  let actionMap = new Map();
  actionMap.set(REQUEST_PERMISSION_ACTION, requestPermission);
  actionMap.set(READ_MIND_ACTION, readMind);

  assistant.handleRequest(actionMap);
});
// [END permissions]

if (module === require.main) {
  // [START server]
  // Start the server
  let server = app.listen(process.env.PORT || 8080, function () {
    let port = server.address().port;
    console.log('App listening on port %s', port);
  });
  // [END server]
}

module.exports = app;
