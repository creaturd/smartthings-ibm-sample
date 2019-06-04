"use strict";

let express = require('express');
let bodyParser = require('body-parser');
let mqtt = require('mqtt');

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

let discoveryResponse = require("./discoveryResponse.json");
const refreshResponse = require("./refreshResponse.json");
const {partnerHelper, CommandResponse} = require("st-schema");
const stPartnerHelper = new partnerHelper({}, {});
const mqttOptions = {
	'host': 'm24.cloudmqtt.com',
	'port': 10898,
	'username': 'qazcrtmu',
	'password': 'cnT3gGvRSFEd',
	'clientId': 'WebHook'
};

function sendCommandToDevice(deviceId, message) {
	try {
		var topic = 'devices/' + mqttOptions.username + '/' + deviceId;
		
		var mqttClient = mqtt.connect(mqttOptions);
		mqttClient.on('connect', function () {
		 	mqttClient.publish(topic, message);
			mqttClient.end();
		});
	} catch (e) {
		console.error('Unable to connect to MQTT Broker: ' + JSON.stringify(e));
	}
}


function discoveryRequest(requestId) {
  discoveryResponse.headers.requestId = requestId
  console.log(discoveryResponse);
  return discoveryResponse
}
	
function commandRequest(requestId, devices) {
  let response = new CommandResponse(requestId)
  devices.map(({ externalDeviceId, deviceCookie, commands }) => {

   	const device = response.addDevice(externalDeviceId, deviceCookie);
    	stPartnerHelper.mapSTCommandsToState(device, commands);

	var message = JSON.stringify(commands);
	sendCommandToDevice(externalDeviceId, message);
  });
  console.log("response: %j", response);
  return response;
}

function stateRefreshRequest(requestId, devices) {
  let response = { "headers": { "schema": "st-schema", "version": "1.0", "interactionType": "stateRefreshResponse", "requestId": requestId }, "deviceState": [] }
  devices.map(({ externalDeviceId, deviceCookie }) => {
	let deviceResponse = refreshResponse[externalDeviceId]
	response.deviceState.push(deviceResponse)

	var message = JSON.stringify(deviceResponse);
	sendCommandToDevice(externalDeviceId, message);
	
  });
  
  console.log(response);
  return response;
}

function grantCallbackAccess(callbackAuthentication) {
  console.log("grantCallbackAccess token is:", callbackAuthentication.code)
  console.log("grantCallbackAccess clientId is:", callbackAuthentication.clientId)
  return {}
}


// Renders the homepage
app.get('/', function (req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'})
  res.write(JSON.stringify(discoveryResponse))
  res.end()
});


// [START Action]
app.post('/', function (req, res) {
  console.log('Request received: ' + JSON.stringify(req.body))
  
  let response
  const {headers, authentication, devices, callbackAuthentication, globalError, deviceState} = req.body
  const {interactionType, requestId} = headers;
  console.log("request type: ", interactionType);
  try {
    switch (interactionType) {
      case "discoveryRequest":
        response = discoveryRequest(requestId)
        break
      case "commandRequest":
        response = commandRequest(requestId, devices)
        break
      case "stateRefreshRequest":
        response = stateRefreshRequest(requestId, devices)
        break
      case "grantCallbackAccess":
        response = grantCallbackAccess(callbackAuthentication)
        break
      case "integrationDeleted":
        console.log("integration to SmartThings deleted");
        break
      default:
        response = "error. not supported interactionType" + interactionType
        console.log(response)
        break;
    }
  } catch (ex) {
    console.log("failed with ex", ex)
  }

  res.send(response)

})


if (module === require.main) {
  // [START server]
  let server = app.listen(process.env.PORT || 3000, function () {
    let port = server.address().port
    console.log('App listening on port %s', port)
  })
  // [END server]
}

module.exports = app

