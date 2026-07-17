var data;
var keys;
var stopkey;

const params = new URLSearchParams(window.location.search);
var k = params.get("q")

if (k) document.getElementById("f_s1_ii").value = k
if (k) document.getElementById("f_g1_ii").value = k

function degToRad(deg) {
	var rad = (deg * Math.PI) / 180;
	return rad;
}

var sentosa = {
"lat": 1.256714167,
"long": 103.8208411
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
	document.getElementById("f_s1").style.display = "none"
	document.getElementById("p_info").style.display = "none"
	var response = await fetch("data/ccltag.json")
	data = (await response.json())
	keys = Object.keys(data)
	document.getElementById("p_loading").style.display = "none"
	document.getElementById("f_g1").style.display = ""
	document.getElementById("f_g5").style.display = ""
	document.getElementById("f_s1").style.display = ""
	document.getElementById("p_info").style.display = ""

	document.getElementById("f_g1_b").onclick = function() {

		var oldstops = document.getElementById("f_g1_ii").value.split(".")

		var currstop = document.getElementById("f_g1_i").value

		document.getElementById("p_info").innerHTML = ""
		var newstops = ""
		while (true) {
			var stops = []
			newstops = ""
			for (var i = 0; i < 5; i++) {
				if (oldstops[i] == currstop) {
					newstops = keys[Math.floor(Math.random() * keys.length)]
					stops.push(newstops)
				}
				else stops.push(oldstops[i])
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
		document.getElementById("p_info").innerHTML = "Your new stop: " + newstops + " " + data[newstops]['name'] + " (" + data[newstops]['road'] + ")<br>"
		document.getElementById("p_stopkey").innerHTML = "Your new stop key: " + stops.join(".") + " (auto copied to keyboard)"

		navigator.clipboard.writeText(stops.join("."));
	}

	document.getElementById("f_s1_b").onclick = function() {

		var oldstops = document.getElementById("f_s1_ii").value.split(".")

		var currstop = document.getElementById("f_s1_i").value

		document.getElementById("p_info").innerHTML = ""
		var newstops = ""
		while (true) {
			var stops = []
			newstops = ""
			for (var i = 0; i < 5; i++) {
				if (oldstops[i] == currstop) {
					newstops = keys[Math.floor(Math.random() * keys.length)]
					stops.push(newstops)
				}
				else stops.push(oldstops[i])
			}
			var flag=true;
			for (var i = 0; i < 5; i++) {
				for (var j = i+1; j < 5; j++) {
					var dist = calculateDistance(data[stops[i]],data[stops[j]])
					if (dist < 2) flag=false;
				}
			}
			if (calculateDistance(data[newstops], sentosa) < 2) flag=false;
			console.log(calculateDistance(data[newstops], sentosa))
			if (flag) break;
			
		}
		document.getElementById("p_info").innerHTML = "Your new stop: " + newstops + " " + data[newstops]['name'] + " (" + data[newstops]['road'] + ")<br>"
		document.getElementById("p_stopkey").innerHTML = "Your new stop key: " + stops.join(".") + " (auto copied to keyboard)"

		navigator.clipboard.writeText(stops.join("."));
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
		document.getElementById("p_stopkey").innerHTML = "Your stop key: " + stops.join(".") + " (auto copied to keyboard)"
		stopkey = stops.join(".")

		navigator.clipboard.writeText(stops.join("."));
	}

	document.getElementById("ksk").onclick = function() {
		navigator.clipboard.writeText(stopkey);
	}

	document.getElementById("kk2").onclick = function() {
		navigator.clipboard.writeText(window.location.href.split('?')[0] + "?q=" + stopkey);
	}

}

mainf()