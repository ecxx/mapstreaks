var data;
var keys;

function degToRad(deg) {
	var rad = (deg * Math.PI) / 180;
	return rad;
}

function calculateDistance(startCoords, destCoords) {
	const startingLat = degToRad(startCoords.lat);
	const startingLong = degToRad(startCoords.long);
	const destinationLat = degToRad(destCoords.lat);
	const destinationLong = degToRad(destCoords.long);
	const radius = 6371;
	const distance = Math.acos(
		Math.sin(startingLat) * Math.sin(destinationLat) +
		Math.cos(startingLat) * Math.cos(destinationLat) *
		Math.cos(startingLong - destinationLong)
	) * radius;

	return distance;
}


async function mainf() {
	document.getElementById("f_g1").style.display = "none"
	document.getElementById("f_g5").style.display = "none"
	document.getElementById("p_info").style.display = "none"
	var response = await fetch("data/ccltag.json")
	data = (await response.json())
	keys = Object.keys(data)
	document.getElementById("p_loading").style.display = "none"
	document.getElementById("f_g1").style.display = ""
	document.getElementById("f_g5").style.display = ""
	document.getElementById("p_info").style.display = ""

	document.getElementById("f_g1_b").onclick = function() {
		var currstop = document.getElementById("f_g1_i").value
		if (keys.includes(currstop)) {
			var st;
			while (true) {
				st = keys[Math.floor(Math.random() * keys.length)]
				dist = calculateDistance(data[st],data[currstop])
				if (dist>2) break;
			}
			document.getElementById("p_info").innerHTML = "New Stop: " + st + " " + data[st]['name'] + " (" + data[st]['road'] + ")"
		}
	}

	document.getElementById("f_g5").onclick = function() {
		document.getElementById("p_info").innerHTML = ""
		while (true) {
			var stops = []
			for (var i = 0; i < 5; i++) {
				stops.push(keys[Math.floor(Math.random() * keys.length)])
			}
			var flag=true;
			for (var i = 0; i < 5; i++) {
				for (var j = i+1; j < 5; j++) {
					var dist = calculateDistance(data[stops[i]],data[stops[j]])
					if (dist < 2) flag=false;
				}
			}
			if (flag) break;
			
		}
		for (var st of stops) document.getElementById("p_info").innerHTML += st + " " + data[st]['name'] + " (" + data[st]['road'] + ")<br>"
	}

}

mainf()