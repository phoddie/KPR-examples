//@program
/*
  Copyright 2011-2014 Marvell Semiconductor, Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

var nfcTokenStyle = new Style({ font:"bold 40px", color:"white", horizontal:"center", vertical:"middle" });
var infoStyle = new Style({ font:"bold 25px", color:"white", horizontal:"center", vertical:"bottom" });
var errorStyle = new Style({ font:"bold 40px", color:"white", horizontal:"center", vertical:"middle" });

var pageNumber = 6;

var NFCScreen = Container.template(function($) { return {
	left:0, right:0, top:0, bottom:0, skin: new Skin({ fill: "#76b321" }),
	contents: [
        Label($, { left:0, right:0, top:0, bottom:0, style: nfcTokenStyle, string: $.token }),
        Label($, { left:0, right:0, top:0, bottom:0, style: infoStyle, string: $.count }),
        Label($, { left:0, right:0, top:0, bottom:30, style: infoStyle, string: $.lastTime })
	]
}});

var ErrorScreen = Container.template(function($) { return {
	left:0, right:0, top:0, bottom:0, skin: new Skin({ fill: "#f78e0f" }),
	contents: [
		Label($, { left:0, right:0, top:0, bottom:0, style: errorStyle, string:"Error " + $.error })
	]
}});

Handler.bind("/nfcTarget", {
	onInvoke: function(handler, message) {
		var it = message.requestObject;
       	var token = it.token;

		if (!token)
        	application.replace(application.first, new NFCScreen({token: "Scanning", count: "", lastTime: ""}));
        else 
        if (!it.commandData || ("number" == typeof it.commandData))
        	application.replace(application.first, new NFCScreen({token: token, count: "(read failed " + it.commandData + ")", lastTime: ""}));
        else {
			var bytes = it.commandData;
            if (('K' != String.fromCharCode(bytes[0])) || ('N' != String.fromCharCode(bytes[1])) ||
                ('M' != String.fromCharCode(bytes[2])) || ('A' != String.fromCharCode(bytes[3])))
                bytes = ['K'.charCodeAt(0), 'N'.charCodeAt(0), 'M'.charCodeAt(0), 'A'.charCodeAt(0), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

            var count = (bytes[4] << 8) | bytes[5];
            count += 1;
            bytes[4] = (count >> 8) & 0xff;
            bytes[5] = count & 0xff;
         
            var lastTime = (bytes[6] << 24) | (bytes[7] << 16) | (bytes[8] << 8) | bytes[9];
            var now = (Date.now() / 1000) | 0;
            bytes[6] = (now >> 24) & 0xff;
            bytes[7] = (now >> 16) & 0xff;
            bytes[8] = (now >>  8) & 0xff;
            bytes[9] = (now >>  0) & 0xff;

            handler.invoke(new MessageWithObject("pins:/nfc/mifare_CmdWrite", {page: pageNumber, data: bytes, token: token, key: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]}), Message.JSON);

	        application.replace(application.first, new NFCScreen({token: JSON.stringify(token), count: "Times seen: " + (count - 1), lastTime: "Last seen: " + (new Date(lastTime * 1000))}));
		}
	},
    onComplete: function(handler, message, result) {
		trace("nfc write result: " + result + "\n");
    }
});

var model = application.behavior = Object.create(Object.prototype, {
	onComplete: { value: function(application, message, text) {
		if (0 != message.error)
			application.replace(application.first, new ErrorScreen(message));
        else {
            application.invoke(new MessageWithObject("pins:/nfc/poll?repeat=on&callback=/nfcTarget&interval=100",
            			{command: "mifare_CmdRead", commandParams: {page: pageNumber, token: null, key: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]}}));
            application.replace(application.first, new NFCScreen({token: "Scanning", count: "", lastTime: ""}));
        }
	}},
	onLaunch: { value: function(application) {
        var message = new MessageWithObject("pins:configure", {
            nfc: {
                require: "PN532",
                pins: {
                    data: {sda: 27, clock: 29}
                }
            }});
        application.invoke(message, Message.TEXT);

		this.data = { token: undefined};
        application.add(new NFCScreen({token: "Initializing", count: "", lastTime: ""}));
	}},
});
