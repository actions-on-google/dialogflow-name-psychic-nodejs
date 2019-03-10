# Actions on Google: Name Psychic Sample

This Node.js sample introduces permission requests for [user information](https://developers.google.com/actions/assistant/helpers#user_information) and
demonstrates [surface transfer capabilities](https://developers.google.com/actions/assistant/surface-capabilities#multi-surface_conversations)
when building Actions for Google Assistant and uses Google Maps Static API.

## Setup Instructions

### Configuration
**This sample uses Google Maps Static API and so requires [Pay as You Go](https://developers.google.com/maps/documentation/maps-static/usage-and-billing) billing enabled via the Google Cloud Platform console under your project.**

1. Use the [Actions on Google Console](https://console.actions.google.com) to add a new project with a name of your choosing and click *Create Project*.
1. Scroll down to the *More Options* section, and click on the *Conversational* card.
1. On the left navigation menu under *BUILD*, click on *Actions*. Click on *Add Your First Action* and choose your app's language(s).
1. Select *Custom intent*, click *BUILD*. This will open a Dialogflow console. Click *CREATE*.
1. Click on the gear icon to see the project settings.
1. Select *Export and Import*.
1. Select *Restore from zip*. Follow the directions to restore from the `agent.zip` file in this repo.
1. Deploy the fulfillment webhook provided in the `functions` folder using [Google Cloud Functions for Firebase](https://firebase.google.com/docs/functions/):
   1. Follow the instructions to [set up and initialize Firebase SDK for Cloud Functions](https://firebase.google.com/docs/functions/get-started#set_up_and_initialize_functions_sdk). Make sure to select the project that you have previously generated in the Actions on Google Console and to reply "N" when asked to overwrite existing files by the Firebase CLI.
   1. Obtain an API Key for the Google Static Maps API following the [instructions](https://developers.google.com/maps/documentation/maps-static/intro).
   1. Run the following command replacing `<THE_API_KEY>` with your API Key: `firebase functions:config:set maps.key=<THE API KEY>`
   1. In the [Google Cloud Console API Library](https://console.cloud.google.com/apis/library), enable the Static Maps API and billing for your project.
   1. Run `firebase deploy --only functions` and take note of the endpoint where the fulfillment webhook has been published. It should look like `Function URL (webhook): https://us-central1-YOUR_PROJECT.cloudfunctions.net/webhook`
1. Go back to the Dialogflow console and select *Fulfillment* from the left navigation menu. Enable *Webhook*, set the value of *URL* to the `Function URL` from the previous step, then click *Save*.
1. Select *Intents* from the left navigation menu. Select the `handle_permission` fallback intent, scroll down to the *Actions on Google* section, check *End Conversation*, then click *Save*.
1. Select *Integrations* from the left navigation menu and open the *Settings* menu for Actions on Google.
1. Enable *Auto-preview changes* and Click *Test*. This will open the Actions on Google simulator.
1. Type `Talk to my test app` in the simulator, or say `OK Google, talk to my test app` to any Actions on Google enabled device signed into your developer account.

### References & Issues
+ Questions? Go to [StackOverflow](https://stackoverflow.com/questions/tagged/actions-on-google), [Actions on Google G+ Developer Community](https://g.co/actionsdev) or [Support](https://developers.google.com/actions/support/).
+ For bugs, please report an issue on Github.
+ Actions on Google [Webhook Boilerplate](https://github.com/actions-on-google/dialogflow-webhook-boilerplate-nodejs).
+ [Codelabs](https://codelabs.developers.google.com/?cat=Assistant) for Actions on Google.
+ Actions on Google [Documentation](https://developers.google.com/actions/extending-the-assistant).
+ For more info on deploying with [Firebase](https://developers.google.com/actions/dialogflow/deploy-fulfillment).
+ To learn more about [Google Maps Static API Billing](https://developers.google.com/maps/documentation/maps-static/usage-and-billing).

## Make Contributions
Please read and follow the steps in the CONTRIBUTING.md

## License
See LICENSE

## Terms
Your use of this sample is subject to, and by using or downloading the sample files you agree to comply with, the [Google APIs Terms of Service](https://developers.google.com/terms/).
