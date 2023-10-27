export function Name() { return "Prism S"; }
export function VendorId() { return 0x16D0; }
export function ProductId() { return 0x1294; }
export function Publisher() { return "PrismRGB"; }
export function Size() { return [0, 0]; }
export function Type() { return "Hid"; }
export function SubdeviceController(){ return true; }
export function DefaultPosition(){return [120, 80];}
export function DefaultScale(){return 8.0;}
/* global
shutdownColor:readonly
LightingMode:readonly
forcedColor:readonly
GPUCable:readonly
ATXCable:readonly
GPUCableType:readonly
*/
export function ControllableParameters() {
	return [
		{"property":"ATXCable", "group":"lighting", "label":"24 Pin Cable Connected", "type":"boolean", "default": "true"},
		{"property":"GPUCable", "group":"lighting", "label":"GPU Cable Connected", "type":"boolean", "default": "true"},
		{"property":"GPUCableType", "group":"lighting", "label":"GPU Cable Type", "type":"combobox", "values":["Dual 8 Pin", "Triple 8 Pin"], "default":"Triple 8 Pin"},
		{"property":"shutdownColor", "group":"Lighting", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"#000000"},
		{"property":"LightingMode", "group":"Lighting", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "group":"Lighting", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"#009bde"}
	];
}

let channelReload = false;
/* const MaxLedsInPacket = 21; */
let brightness = .50;

export function onGPUCableChanged() {
	addChannels();
}

export function onATXCableChanged() {
	addChannels();
}

export function onGPUCableTypeChanged() {
	addChannels();
}

export function Initialize() {
	addChannels();
}

function addChannels() {
	device.removeSubdevice("Dual8PinStrimer");
	device.removeSubdevice("Triple8PinStrimer");
	device.removeSubdevice("24PinStrimer");
	channelReload = true;

	if(GPUCable) {
		if(GPUCableType === "Dual 8 Pin") {
			device.createSubdevice("Dual8PinStrimer");
			device.setSubdeviceName("Dual8PinStrimer", `Dual 8 Pin Strimer`);
			device.setSubdeviceSize("Dual8PinStrimer", 27, 4);
			device.setSubdeviceLeds("Dual8PinStrimer", vDual8PinLedNames, vDual8PinLedPositions);
		} else if(GPUCableType === "Triple 8 Pin") {
			device.createSubdevice("Triple8PinStrimer");
			device.setSubdeviceName("Triple8PinStrimer", `Triple 8 Pin Strimer`);
			device.setSubdeviceSize("Triple8PinStrimer", 27, 6);
			device.setSubdeviceLeds("Triple8PinStrimer", vTriple8PinLedNames, vTriple8PinLedPositions);
		}
	}

	if(ATXCable) {
		device.createSubdevice("24PinStrimer");
		device.setSubdeviceName("24PinStrimer", `ATX Strimer`);
		device.setSubdeviceSize("24PinStrimer", 20, 6);
		device.setSubdeviceLeds("24PinStrimer", v24PinLedNames, v24PinLedPositions);
	}

	Save_Settings();
}

export function Render() {
	let SendData = [];

	if(!channelReload) {
		if(ATXCable) {
			let RGBData = getMoboColors();

			for(let CurrPacket = 0; CurrPacket < 6; CurrPacket++) {
				if(CurrPacket === 5) {
					CurrPacket = 15;
				}
				let packet = [CurrPacket];

				if(RGBData.length >= 63) {
					packet.push(...RGBData.splice(0, 63));
				} else {
					packet.push(...RGBData.splice(0, RGBData.length));
				}

				SendData.push(...packet.splice(0, packet.length));
			}
		}

		if(GPUCable) {
			if(SendData.length === 0) {
				let packet = new Array(46).fill(0);
				SendData.push(...packet.splice(0, packet.length));
				SendData[0] = 0x05;
			} else {
				SendData[320] = 0x05;
			}

			if(GPUCableType === "Dual 8 Pin") {
				let RGBData = getDualGPUColors();
				SendData.push(...RGBData.splice(0, 18));

				for(let CurrPacket = 6; CurrPacket < 11; CurrPacket++) {
					if(CurrPacket === 10) {
						CurrPacket = 20;
					}
					let packet = [CurrPacket];

					if(RGBData.length >= 63) {
						packet.push(...RGBData.splice(0, 63));
					} else {
						packet.push(...RGBData.splice(0, RGBData.length));
					}

					SendData.push(...packet.splice(0, packet.length));
				}
			} else if(GPUCableType === "Triple 8 Pin") {
				let RGBData = getTripleGPUColors();
				SendData.push(...RGBData.splice(0, 18));

				for(let CurrPacket = 6; CurrPacket < 14; CurrPacket++) {
					let packet = [CurrPacket];

					if(RGBData.length >= 63) {
						packet.push(...RGBData.splice(0, 63));
					} else {
						packet.push(...RGBData.splice(0, RGBData.length));
					}

					SendData.push(...packet.splice(0, packet.length));
				}
			}

		}

		let NumPackets = Math.ceil(SendData.length / 64);

		for(let CurrPacket = 0; CurrPacket < NumPackets; CurrPacket++) {
			let packet = [0x00];
			packet.push(...SendData.splice(0, 64));
			device.write(packet, 65);
		}
	} else {
		channelReload = false;
	}
}

export function Shutdown() {
	Save_Settings();
}

function getDeviceColors(deviceType, shutdown = false) {
	const RGBData = [];
	let positions;

	switch (deviceType) {
	case "24PinStrimer":
		positions = v24PinLedPositions;
		break;
	  case "Dual8PinStrimer":
		positions = vDual8PinLedPositions;
		break;
	  case "Triple8PinStrimer":
		positions = vTriple8PinLedPositions;
		break;
	  default:
		return RGBData;
	}

	for (let iIdx = 0; iIdx < positions.length; iIdx++) {
		const iPxX = positions[iIdx][0];
		const iPxY = positions[iIdx][1];
		let color;

		if (shutdown) {
			color = hexToRgb(shutdownColor);
	  	} else if (LightingMode === "Forced") {
			color = hexToRgb(forcedColor);
	  	} else {
			color = device.subdeviceColor(deviceType, iPxX, iPxY);
	  	}

		const iLedIdx = iIdx * 3;
	  	RGBData[iLedIdx] = color[0] * brightness;
	  	RGBData[iLedIdx + 1] = color[1] * brightness;
	  	RGBData[iLedIdx + 2] = color[2] * brightness;
	}

	return RGBData;
}

function getMoboColors(shutdown = false) {
	return getDeviceColors("24PinStrimer", shutdown);
}

function getDualGPUColors(shutdown = false) {
	return getDeviceColors("Dual8PinStrimer", shutdown);
}

function getTripleGPUColors(shutdown = false) {
	return getDeviceColors("Triple8PinStrimer", shutdown);
}

function Save_Settings() {
	let Mos = 0;
	let RGBData = [];
	RGBData = device.createColorArray(shutdownColor, 1, "Inline");

	if(GPUCableType === "Dual 8 Pin") {
		Mos = 1;
	}

	device.write([0x00, 0xfe, 0x01, RGBData[0], RGBData[1], RGBData[2], Mos], 65);
	device.pause(50);
}

function hexToRgb(hex) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	const colors = [];
	colors[0] = parseInt(result[1], 16);
	colors[1] = parseInt(result[2], 16);
	colors[2] = parseInt(result[3], 16);

	return colors;
}

export function Validate(endpoint) {
	return endpoint.interface === 2;
}

const vDual8PinLedNames = [
	"LED 1", "LED 2", "LED 3", "LED 4", "LED 5", "LED 6", "LED 7", "LED 8", "LED 9", "LED 10",
	"LED 11", "LED 12", "LED 13", "LED 14", "LED 15", "LED 16", "LED 17", "LED 18", "LED 19", "LED 20",
	"LED 21", "LED 22", "LED 23", "LED 24", "LED 25", "LED 26", "LED 27", "LED 28", "LED 29", "LED 30",

	"LED 31", "LED 32", "LED 33", "LED 34", "LED 35", "LED 36", "LED 37", "LED 38", "LED 39", "LED 40",
	"LED 41", "LED 42", "LED 43", "LED 44", "LED 45", "LED 46", "LED 47", "LED 48", "LED 49", "LED 50",
	"LED 51", "LED 52", "LED 53", "LED 54", "LED 55", "LED 56", "LED 57", "LED 58", "LED 59", "LED 60",

	"LED 61", "LED 62", "LED 63", "LED 64", "LED 65", "LED 66", "LED 67", "LED 68", "LED 69", "LED 70",
	"LED 71", "LED 72", "LED 73", "LED 74", "LED 75", "LED 76", "LED 77", "LED 78", "LED 79", "LED 80",
	"LED 81", "LED 82", "LED 83", "LED 84", "LED 85", "LED 86", "LED 87", "LED 88", "LED 89", "LED 90",

	"LED 91", "LED 92", "LED 93", "LED 94", "LED 95", "LED 96", "LED 97", "LED 98", "LED 99", "LED 100",
	"LED 101", "LED 102", "LED 103", "LED 104", "LED 105", "LED 106", "LED 107", "LED 108"
];

const vDual8PinLedPositions = [
	[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
	[10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0], [17, 0], [18, 0], [19, 0],
	[20, 0], [21, 0], [22, 0], [23, 0], [24, 0], [25, 0], [26, 0],

	[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1],
	[10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1], [18, 1], [19, 1],
	[20, 1], [21, 1], [22, 1], [23, 1], [24, 1], [25, 1], [26, 1],

	[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2],
	[10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [18, 2], [19, 2],
	[20, 2], [21, 2], [22, 2], [23, 2], [24, 2], [25, 2], [26, 2],

	[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
	[10, 3], [11, 3], [12, 3], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3], [19, 3],
	[20, 3], [21, 3], [22, 3], [23, 3], [24, 3], [25, 3], [26, 3]
];

const vTriple8PinLedNames = [
	"LED 1", "LED 2", "LED 3", "LED 4", "LED 5", "LED 6", "LED 7", "LED 8", "LED 9", "LED 10",
	"LED 11", "LED 12", "LED 13", "LED 14", "LED 15", "LED 16", "LED 17", "LED 18", "LED 19", "LED 20",
	"LED 21", "LED 22", "LED 23", "LED 24", "LED 25", "LED 26", "LED 27",

	"LED 28", "LED 29", "LED 30", "LED 31", "LED 32", "LED 33", "LED 34", "LED 35", "LED 36", "LED 37", "LED 38", "LED 39", "LED 40",
	"LED 41", "LED 42", "LED 43", "LED 44", "LED 45", "LED 46", "LED 47", "LED 48", "LED 49", "LED 50",
	"LED 51", "LED 52", "LED 53", "LED 54",

	"LED 55", "LED 56", "LED 57", "LED 58", "LED 59", "LED 60", "LED 61", "LED 62", "LED 63", "LED 64", "LED 65", "LED 66", "LED 67", "LED 68", "LED 69", "LED 70",
	"LED 71", "LED 72", "LED 73", "LED 74", "LED 75", "LED 76", "LED 77", "LED 78", "LED 79", "LED 80",
	"LED 81",

	"LED 82", "LED 83", "LED 84", "LED 85", "LED 86", "LED 87", "LED 88", "LED 89", "LED 90", "LED 91", "LED 92", "LED 93", "LED 94",
	"LED 95", "LED 96", "LED 97", "LED 98", "LED 99", "LED 100", "LED 101", "LED 102", "LED 103", "LED 104", "LED 105", "LED 106", "LED 107", "LED 108",

	"LED 109", "LED 110", "LED 111", "LED 112", "LED 113", "LED 114", "LED 115", "LED 116", "LED 117", "LED 118", "LED 119", "LED 120", "LED 121", "LED 122",
	"LED 123", "LED 124", "LED 125", "LED 126", "LED 127", "LED 128", "LED 129", "LED 130", "LED 131", "LED 132", "LED 133", "LED 134", "LED 135",

	"LED 136", "LED 137", "LED 138", "LED 139", "LED 140", "LED 141", "LED 142", "LED 143", "LED 144", "LED 145", "LED 146", "LED 147", "LED 148", "LED 149", "LED 150", "LED 151",
	"LED 152", "LED 153", "LED 154", "LED 155", "LED 156", "LED 157", "LED 158", "LED 159", "LED 160", "LED 161", "LED 162"
];

const vTriple8PinLedPositions = [
	[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
	[10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0], [17, 0], [18, 0], [19, 0],
	[20, 0], [21, 0], [22, 0], [23, 0], [24, 0], [25, 0], [26, 0],

	[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1],
	[10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1], [18, 1], [19, 1],
	[20, 1], [21, 1], [22, 1], [23, 1], [24, 1], [25, 1], [26, 1],

	[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2],
	[10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [18, 2], [19, 2],
	[20, 2], [21, 2], [22, 2], [23, 2], [24, 2], [25, 2], [26, 2],

	[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
	[10, 3], [11, 3], [12, 3], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3], [19, 3],
	[20, 3], [21, 3], [22, 3], [23, 3], [24, 3], [25, 3], [26, 3],

	[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4],
	[10, 4], [11, 4], [12, 4], [13, 4], [14, 4], [15, 4], [16, 4], [17, 4], [18, 4], [19, 4],
	[20, 4], [21, 4], [22, 4], [23, 4], [24, 4], [25, 4], [26, 4],

	[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5],
	[10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], [16, 5], [17, 5], [18, 5], [19, 5],
	[20, 5], [21, 5], [22, 5], [23, 5], [24, 5], [25, 5], [26, 5]
];

const v24PinLedNames = [
	"LED 1", "LED 2", "LED 3", "LED 4", "LED 5", "LED 6", "LED 7", "LED 8", "LED 9", "LED 10",
	"LED 11", "LED 12", "LED 13", "LED 14", "LED 15", "LED 16", "LED 17", "LED 18", "LED 19", "LED 20",

	"LED 21", "LED 22", "LED 23", "LED 24", "LED 25", "LED 26", "LED 27", "LED 28", "LED 29", "LED 30",
	"LED 31", "LED 32", "LED 33", "LED 34", "LED 35", "LED 36", "LED 37", "LED 38", "LED 39", "LED 40",

	"LED 41", "LED 42", "LED 43", "LED 44", "LED 45", "LED 46", "LED 47", "LED 48", "LED 49", "LED 50",
	"LED 51", "LED 52", "LED 53", "LED 54", "LED 55", "LED 56", "LED 57", "LED 58", "LED 59", "LED 60",

	"LED 61", "LED 62", "LED 63", "LED 64", "LED 65", "LED 66", "LED 67", "LED 68", "LED 69", "LED 70",
	"LED 71", "LED 72", "LED 73", "LED 74", "LED 75", "LED 76", "LED 77", "LED 78", "LED 79", "LED 80",

	"LED 81", "LED 82", "LED 83", "LED 84", "LED 85", "LED 86", "LED 87", "LED 88", "LED 89", "LED 90",
	"LED 91", "LED 92", "LED 93", "LED 94", "LED 95", "LED 96", "LED 97", "LED 98", "LED 99", "LED 100",

	"LED 101", "LED 102", "LED 103", "LED 104", "LED 105", "LED 106", "LED 107", "LED 108", "LED 109", "LED 110",
	"LED 111", "LED 112", "LED 113", "LED 114", "LED 116", "LED 117", "LED 118", "LED 119", "LED 120"
];

const v24PinLedPositions = [
	[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
	[10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0], [17, 0], [18, 0], [19, 0],

	[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1],
	[10, 1], [11, 1], [12, 1], [13, 1], [14, 1], [15, 1], [16, 1], [17, 1], [18, 1], [19, 1],

	[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2],
	[10, 2], [11, 2], [12, 2], [13, 2], [14, 2], [15, 2], [16, 2], [17, 2], [18, 2], [19, 2],

	[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
	[10, 3], [11, 3], [12, 3], [13, 3], [14, 3], [15, 3], [16, 3], [17, 3], [18, 3], [19, 3],

	[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4],
	[10, 4], [11, 4], [12, 4], [13, 4], [14, 4], [15, 4], [16, 4], [17, 4], [18, 4], [19, 4],

	[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5],
	[10, 5], [11, 5], [12, 5], [13, 5], [14, 5], [15, 5], [16, 5], [17, 5], [18, 5], [19, 5],
];

export function ImageUrl() {
	return "https://i.imgur.com/Y1wzRO7.png";
}