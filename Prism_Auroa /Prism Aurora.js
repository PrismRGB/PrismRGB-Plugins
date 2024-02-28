export function Name() { return "Prism Auroa"; }
export function VendorId() {}
export function ProductId() {}
export function Publisher() { return "PrismRGB"; }
export function Size() { return [1, 1]; }
export function DefaultPosition(){return [0, 0];}
export function DefaultScale(){return 1.0;}
export function Type() { return "Hid"; }
export function SubdeviceController(){ return true; }
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
*/
export function ControllableParameters() {
	return [
		{"property":"shutdownColor", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"000000"},
		{"property":"LightingMode", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"#009bde"},
	];
}

const DeviceMaxLedLimit = 120;
const ChannelArray =
[
	["Channel 1", 120],
];

function SetupChannels() {
	device.SetLedLimit(DeviceMaxLedLimit);

	for(let i = 0; i < ChannelArray.length; i++) {
		device.addChannel(ChannelArray[i][0], ChannelArray[i][1]);
	}
}

const vKeyNames = [];
const vKeyPositions = [];
const MaxLedsInPacket = 20;

export function LedNames() {
	return vKeyNames;
}

export function LedPositions() {
	return vKeyPositions;
}

export function Initialize() {
	const packet = new Array(65).fill(0);
	packet[2] = 0x01;
	device.write(packet, 65);
	SetupChannels();
}

export function Render() {
	for(let i = 0; i < ChannelArray.length; i++) {
		SendChannel(i);
	}

	device.pause(1);
}

export function Shutdown(SystemSuspending) {

	if(SystemSuspending){
		for(let i = 0; i < ChannelArray.length; i++) {
			SendChannel(i, "#000000");
		}

		device.pause(1); // Go Dark on System Sleep/Shutdown
	}else{
		for(let i = 0; i < ChannelArray.length; i++) {
			SendChannel(i, shutdownColor);
		}

		device.pause(1);
	}

}

let brightnessRed = 255;
let brightnessGreen = 255;
let brightnessBlue = 255;

function SendChannel(Channel, overrideColor) {
    let ChannelLedCount = device.channel(ChannelArray[Channel][0]).ledCount > ChannelArray[Channel][1] ? ChannelArray[Channel][1] : device.channel(ChannelArray[Channel][0]).ledCount;
    const componentChannel = device.channel(ChannelArray[Channel][0]);

    let RGBData = [];

    if (overrideColor) {
        RGBData = device.createColorArray(overrideColor, ChannelLedCount, "Inline");
    } else if (LightingMode === "Forced") {
        RGBData = device.createColorArray(forcedColor, ChannelLedCount, "Inline");
    } else if (componentChannel.shouldPulseColors()) {
        ChannelLedCount = 90;

        const pulseColor = device.getChannelPulseColor(ChannelArray[Channel][0]);
        RGBData = device.createColorArray(pulseColor, ChannelLedCount, "Inline");
    } else {
        RGBData = device.channel(ChannelArray[Channel][0]).getColors("Inline");
    }

    const NumPackets = Math.ceil(ChannelLedCount / MaxLedsInPacket);
	
    for (let CurrPacket = 1; CurrPacket <= NumPackets; CurrPacket++) {
        let packet = [0x00, CurrPacket, 0x00, NumPackets, Channel + 1];
        packet = packet.concat(RGBData.splice(0, 60));
        for (let i = 5; i < packet.length; i += 3) {
            const totalValue = packet[i] + packet[i + 1] + packet[i + 2];
            if (totalValue > 160) {
                const scaleFactor = 160 / totalValue;
                packet[i] *= scaleFactor;
                packet[i + 1] *= scaleFactor;
                packet[i + 2] *= scaleFactor;
            }
            packet[i] *= brightnessRed / 255;
            packet[i + 1] *= brightnessGreen / 255;
            packet[i + 2] *= brightnessBlue / 255;
        }
        device.write(packet, 65);
    }
}

export function Validate(endpoint) {
	return endpoint.interface === 2;
}

