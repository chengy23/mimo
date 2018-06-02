'use strict';
 
var azure = require('azure-storage');

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: 'PlainText',
            text: output,
        },
        card: {
            type: 'Simple',
            title: `SessionSpeechlet - ${title}`,
            content: `SessionSpeechlet - ${output}`,
        },
        reprompt: {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        },
        shouldEndSession,
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
}

function getWelcomeResponse(callback) {
    const sessionAttributes = {};
    const cardTitle = 'Welcome';
    const speechOutput = 'Welcome to the Mimo Blood Pressure module. ' +
                    'What is your blood pressure today?';
    const repromptText = 'Please tell me your blood pressure by saying something like, ' +
        'my blood pressure is 110 over 78';
    const shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    const cardTitle = 'Session Ended';
    const speechOutput = 'Thank you, have a nice day!';
    const shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function createBloodPressureAttributes(bpSystolic, bpDiatolic) {
    return {
        bpSystolic, 
        bpDiatolic,
    };
}

function setBloodPressureInSession(intent, session, callback) {
    const cardTitle = intent.name;
    const systolic = intent.slots.Systolic;
    const diatolic = intent.slots.Diatolic;
    let sessionAttributes = {};
    const shouldEndSession = true;
    let speechOutput = '';
    let repromptText = '';
    
    if (systolic) {
        var bpSystolic = systolic.value;
        var bpDiatolic = diatolic.value;
        sessionAttributes = createBloodPressureAttributes(bpSystolic, bpDiatolic);
        
        var queueService = azure.createQueueService('STORAGE ACCOUNT', 'ACCOUNT KEY');
        var encoder = new azure.QueueMessageEncoder.TextBase64QueueMessageEncoder();
    
        var messageText = "";
        repromptText = "You can tell my your blood pressure by saying: my blood pressure is 110 over 78.";
        
        if (bpSystolic < 120 && bpDiatolic < 80) {
            messageText = "" + bpSystolic + " " + bpDiatolic + " normal";
            speechOutput = ("Your blood pressure is " + 
                        bpSystolic + 
                        " over " + 
                        bpDiatolic + 
                        ". That is normal blood pressure. Check the graph on the screen to see your range.");
        } else if (bpSystolic >= 120 && bpSystolic <= 129 && bpDiatolic < 80) {
            messageText = "" + bpSystolic + " " + bpDiatolic + " high1";
            speechOutput = "Your blood pressure is " + 
                        bpSystolic + 
                        " over " + 
                        bpDiatolic + 
                        ". That is elevated blood pressure.";
        } else if ((bpSystolic >= 130 && bpSystolic <= 139) || (bpDiatolic >= 80 && bpDiatolic <= 89)) {
            messageText = "" + bpSystolic + " " + bpDiatolic + " high2";
            speechOutput = "Your blood pressure is " + 
                        bpSystolic + 
                        " over " + 
                        bpDiatolic + 
                        ". That is high blood pressure, or hypertension stage one. You may wish to consult your doctor. Check the graph on the screen to see your range.";
        } else if ((bpSystolic >= 140 && bpSystolic < 180) || (bpDiatolic >= 90 && bpDiatolic < 120)) {
            messageText = "" + bpSystolic + " " + bpDiatolic + " high3";
            speechOutput = "Your blood pressure is " + 
                        bpSystolic + 
                        " over " + 
                        bpDiatolic + 
                        ". That is high blood pressure, or hypertension stage two. You should consult your doctor. Check the graph on the screen to see your range.";
        } else if (bpSystolic >= 180 || bpDiatolic >= 120) {
            messageText = "" + bpSystolic + " " + bpDiatolic + " high4";
            speechOutput = "Your blood pressure is " + 
                        bpSystolic + 
                        " over " + 
                        bpDiatolic + 
                        ". That is hypertensive crisis. Consult you doctor immediately. Check the graph on the screen to see your range.";
        } else {
            speechOutput = "Your blood pressure is " + 
                        bpSystolic + 
                        " over " + 
                        bpDiatolic + 
                        ". That is an unhandled case.";
        }
    } else {
        speechOutput = "I'm not sure what your blood pressure is. " + 
                        "Please try again.";
        repromptText = "I'm not sure what your blood pressure is. " + 
                        "You can tell me your blood pressure by saying, " + 
                        "my blood pressure is 120 over 80.";
    }
    
    if (messageText != "") {
        queueService.createMessage('QUEUE NAME', encoder.encode(messageText), function(error, results, response){
            if(!error){
                //nothing
            }
        });
    }

    callback(sessionAttributes,
         buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getMoreBloodPressureInfo(intent, session, callback) {
    const cardTitle = intent.name;
    let sessionAttributes = {};
    const shouldEndSession = true;
    let speechOutput = '';
    let repromptText = '';
    
    speechOutput = "Blood pressure is the pressure of the blood in the circulatory system. " + 
                        "It is composed of two numbers, the systolic pressure and the diatolic pressure. " + 
                        "That is, the pressure the heart is exerting against artery walls when it beats " + 
                        "over how much pressure the heart exerts when resting between beats.";
    repromptText = "You can tell me your blood pressure by saying, " + 
                        "my blood pressure is 120 over 80.";
    
    callback(sessionAttributes,
         buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

function onLaunch(launchRequest, session, callback) {
    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    getWelcomeResponse(callback);
}

function onIntent(intentRequest, session, callback) {
    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;

    if (intentName === 'MimoBloodPressureReadingIntent') {
        setBloodPressureInSession(intent, session, callback);
    } else if (intentName === 'MimoBloodPressureMoreInfoIntent') {
        getMoreBloodPressureInfo(intent, session, callback);
    } else if (intentName === 'AMAZON.HelpIntent') {
        getWelcomeResponse(callback);
    } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        handleSessionEndRequest(callback);
    } else {
        throw new Error('Invalid intent');
    }
}

function onSessionEnded(sessionEndedRequest, session) {
    console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
}

exports.handler = (event, context, callback) => {
    try {
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

        //uncomment when publishing
        /*
        if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
             callback('Invalid Application ID');
        }
        */

        if (event.session.new) {
            onSessionStarted({ requestId: event.request.requestId }, event.session);
        }

        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};
