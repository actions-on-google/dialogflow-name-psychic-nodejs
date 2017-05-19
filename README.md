# Actions on Google: Name Psychic Sample using Node.js

The Psychic in this sample can guess interesting secrets about you, like your
name and where you are. This sample introduces permissions requests for user
information on the Actions on Google platform.

## Setup Instructions

### Steps
1. Create a Firebase project.
1. In your Project settings, under Service Accounts, download a private key.
1. In the security key JSON import in index.js, specify the path to your private key file.
1. Also specify your database name, shown in the Database page of the Firebase console.
1. Use the [Actions on Google Console](https://console.actions.google.com) to add a new project with a name of your choosing.
1. Click "Use API.AI" and then "Create Actions on API.AI".
1. Click "Save" to save the project.
1. Click on the gear icon to see the project settings.
1. Select "Export and Import".
1. Select "Restore from zip". Follow the directions to restore from the NamePsychic.zip file in this repo.
1. Deploy the fulfillment webhook in index.js to your preferred hosting environment
(we recommend [Google Cloud Functions](https://cloud.google.com/functions/docs/tutorials/http)).
1. In the Fulfillment page of the API.AI console, enable Webhook, set the URL to the hosting URL, then save.
1. In the handle_permission fallback intent, check "End Conversation" for Actions on Google, then save.
1. Open API.AI's Integrations page, open the Settings menu for Actions on Google.
1. Enter the following intents as "Additional triggering intents"
    * request_name_permission
    * request_location_permission
1. Click Test.
1. Click View to open the Actions on Google simulator.
1. Type "Talk to my test app" in the simulator, or say "OK Google, talk to my test app" to any Actions on Google enabled device signed into your developer account.

For more detailed information on deployment, see the [documentation](https://developers.google.com/actions/samples/).

## References and How to report bugs
* Actions on Google documentation: [https://developers.google.com/actions/](https://developers.google.com/actions/).
* If you find any issues, please open a bug here on GitHub.
* Questions are answered on [StackOverflow](https://stackoverflow.com/questions/tagged/actions-on-google).

## How to make contributions?
Please read and follow the steps in the CONTRIBUTING.md.

## License
See LICENSE.md.

## Terms
Your use of this sample is subject to, and by using or downloading the sample files you agree to comply with, the [Google APIs Terms of Service](https://developers.google.com/terms/).

## Google+
Actions on Google Developers Community on Google+ [https://g.co/actionsdev](https://g.co/actionsdev).
