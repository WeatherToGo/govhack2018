
/**
 * Copyright 2017-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Messenger Platform Quick Start Tutorial
 *
 * This is the completed code for the Messenger Platform quick start tutorial
 *
 * https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start/
 *
 * To run this code, you must do the following:
 *
 * 1. Deploy this code to a server running Node.js
 * 2. Run `npm install`
 * 3. Update the VERIFY_TOKEN
 * 4. Add your PAGE_ACCESS_TOKEN to your environment vars
 *
 */

/**
 * 8/9/18
 *
 * Used the Messenger Platform Quick Start Tutorial for the
 * Weather To Go chatbot created during GovHack Sydney 2018
 */

'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const TRANSPORT_NSW_API_KEY = process.env.TRANSPORT_NSW_API_KEY;
// Imports dependencies and set up http server
const 
  request = require('request'),
  express = require('express'),
  geolib = require('geolib'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);


      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender ID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Check if a token and mode were sent
  if (mode && token) {
  
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

function handleMessage(sender_psid, received_message) {
  let response;
  let message;

  const raining = isRaining();
  if (raining) {
    message = "There is heavy rain predicted. Do not forget your umbrella! ☂️"
  } else {
    message = "It's sunny outside! ☀️"
  }

  // Checks if the message contains text
  if (received_message.text) {    
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    response = {
      "text": message
    }
  } else if (received_message.attachments) {
    if (received_message.attachments[0].payload) {
      if (received_message.attachments[0].type === 'location') {
        const localTrafficMsg = localTraffic(received_message.attachments[0].payload.coordinates);
        message += ' ' + localTrafficMsg;
      }
      response = {
        "text": `Here's the latest info for Sydney: ${message}`
      }
    } else {
      let attachment_url = received_message.attachments[0].payload.url;
      response = {
        "attachment": {
          "type": "template",
          "payload": {
            "template_type": "generic",
            "elements": [{
              "title": "Is this the right picture?",
              "subtitle": "Tap a button to answer.",
              "image_url": attachment_url,
              "buttons": [
                {
                  "type": "postback",
                  "title": "Yes!",
                  "payload": "yes",
                },
                {
                  "type": "postback",
                  "title": "No!",
                  "payload": "no",
                }
              ],
            }]
          }
        }
      }
    }    
  } 
  
  // Send the response message
  callSendAPI(sender_psid, response);    
}

function handlePostback(sender_psid, received_postback) {
  console.log('ok')
   let response;
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  } else if (payload === 'InitialUserMessage') {
    response = {
      "text": "Hi, I'm your weather to go chatbot and I can help you decide when you should leave, to be on time. I will check the weather forecast, and compare it with the live traffic in your location. Tap the location button at the bottom, to start!",
      "quick_replies":[
          {
              "content_type":"location"
          }
      ]
    }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

function isRaining() {
  const bomURL = 'http://reg.bom.gov.au/fwo/IDN60901/IDN60901.94768.json';

  var raining = false

  request.get({url: bomURL, json: true}, (err, res, data) => {
      if (err) {
          console.log(err)
      } else if (res.statusCode === 200) {
          if (data.observations.data.length > 0) {
              // Check if it has started raining in the last half hour
              if (data.observations.data[0].rain_trace > data.observations.data[1].rain_trace) {
                  raining = true
              }
          }
      } else {
          // Ignore if response other than 200 OK
          console.log(res.statusCode)
      }
  });

  return raining
}

app.get('/raining', (req, res) => {
  res.status(200).send(isRaining());
});

function localTraffic(coordinates) {
  const trafficAPIUrl = 'https://api.transport.nsw.gov.au/v1/ttds/events';

  let message = 'There is normal traffic in your area. You can leave at your usual time.'

  request.get(
      {
          url: trafficAPIUrl,
          json: true,
          headers: {
              'Authorization': `apikey ${TRANSPORT_NSW_API_KEY}`,
              'User-Agent': 'weathertogo/1.0',
          }
      }, (err, res, data) => {
      if (err) {
          console.log(err)
      } else if (res.statusCode === 200) {
          if (data.events.length > 0) {
              for(let i = 0; i < data.events.length; i++){
                  const distDiff = geolib.getDistance(
                      {latitude: data.events[i].head.lat, longitude: data.events[i].head.lng},
                      {latitude: coordinates.lat, longitude: coordinates.long}
                  );
                  // if traffic incident within 2km
                  if (distDiff < 2000) {
                    message = 'There is some traffic in your area. Consider leaving 15 minutes earlier.'
                    break
                  }
              }
          }
      } else {
          // Ignore if response other than 200 OK
          console.log(res.statusCode)
      }
  });

  return message
}

app.get('/traffic', (req, res) => {
    const coordinates = {
        long: 151.224775,
        lat: -33.830969,
    }
    res.status(200).send(localTraffic(coordinates));
});
