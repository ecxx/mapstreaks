var current_bus = ""
var data = {}
var data_keys = []
var data_keys_check = []

var current_set = {}
var current_set_keys = []

var current_layer = []

var gamemode = "box"
var satellite_colours = [0, "#F2FF00", "#ffaa00", "#ff8888", "#ff8888"]

var state = "set"

var score_correct = 0
var score_incorrect = 0
var score_gg = 0
var score_total = 0
var current_streak = 0
var max_streak = 0

var map;

function reset_feedback() {
	pctscore = 0
	if (score_total > 0) pctscore = (score_correct / score_total) * 100
	document.getElementById("feedback_text").innerHTML = 
	"Session Score: <span class='f-c'>" + score_correct + 
	"</span>-<span class='f-g'>" + score_gg + 
	"</span>-<span class='f-w'>" + score_incorrect + "</span> " +
	"(" + pctscore.toFixed(2) + "%)" +
	"<br>Current Streak: <span class='font-weight-bold'>" + current_streak + 
	"</span> | Max Streak: <span class='font-weight-bold'>" + max_streak + "</span"
}

function initMap() {
	map = L.map('map').setView([1.3521,103.8198], 13);

	var CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: 'abcd',
		maxZoom: 20
	});

	var Esri_WorldImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
	});

	var MtbMap = L.tileLayer('http://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; USGS'
	});

	MtbMap.addTo(map);
}

function toggleMap() {
	if (state=="set") setMap()
	else resetMap()
}

function setMap() {
	current_bus = current_set_keys[Math.floor(Math.random() * current_set_keys.length)]
	current_data = current_set[current_bus]
	map.removeLayer(current_layer)
	document.getElementById("bus_descriptor").innerHTML = "Your guess:"
	
	map.fitBounds([
		current_data['mincoord'],
		current_data['maxcoord']
	])

	data = current_data[gamemode]
	objects = []

	for (var feature of data) {
		if (gamemode=="stops") {
			var c = satellite_colours[feature['properties']['frequency']]
		}
		objects.push(L.geoJSON(feature, {
			pointToLayer: function (feature, latlng) {
				return L.circleMarker(latlng, {
					radius: 3,
					fillColor: c,
					color: c,
					weight: 1,
					opacity: 1,
					fillOpacity: 1					
				});
			}
		}))
	}

	current_layer = L.layerGroup(objects)
	current_layer.addTo(map)

	state = "reset"
}

function resetMap() {
	guess = document.getElementById("bus_guess").value
	console.log(guess)
	state = "set"

	if (guess.toUpperCase() == current_bus.toUpperCase()) {
		console.log("true!")
		score_correct += 1
		score_total += 1
		current_streak += 1
		if (max_streak < current_streak) max_streak = current_streak
		document.getElementById("bus_descriptor").innerHTML = "You guessed: <b class='f-c'>" + guess + "</b>!"
	}
	else if (guess.toUpperCase() == "GG") {
		console.log("gg!")
		score_gg += 1
		score_total += 1
		current_streak = 0
		document.getElementById("bus_descriptor").innerHTML = 
		"Your guess: <b class='f-g'>" + guess + "</b> | Correct Answer: <b class='f-c'>" + current_bus + "</b>"
	}
	else if (data_keys_check.includes(guess.toUpperCase())) {
		console.log("false!")
		score_incorrect += 1
		score_total += 1
		current_streak = 0
		document.getElementById("bus_descriptor").innerHTML = 
		"Your guess: <b class='f-w'>" + guess + "</b> | Correct Answer: <b class='f-c'>" + current_bus + "</b>"
	}
	else {
		document.getElementById("bus_descriptor").innerHTML = "Invalid guess! try again"
		console.log("invalid!")
		state = "reset"
	}

	if (state=="set") {
		reset_feedback()
		document.getElementById("bus_guess").value = ""
	}

}

async function loadBusData() {

	start_game_btn = document.getElementById("start_game")
	guess_form = document.getElementById("guess_form")
	guess_field = document.getElementById("bus_guess")
	guess_btn = document.getElementById("bus_guess_button")
	loading_txt = document.getElementById("loading_text")
	reset_feedback()

	disp_gf = guess_form.style.display
	disp_sg = start_game_btn.style.display

	guess_form.style.display = "none"
	start_game_btn.style.display = "none"

	const response = await fetch ("data/data.json")
	data = await response.json()
	data_keys = Object.keys(data)
	data_keys_check = data_keys.map(item => item.toUpperCase())

	current_set = data
	current_set_keys = data_keys

	loading_txt.style.display = "none"
	start_game_btn.style.display = disp_sg
	start_game_btn.onclick = function() {
		start_game_btn.style.display = "none"
		guess_form.style.display = disp_gf
		setMap()

		guess_field.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				console.log(event)
				toggleMap()
			}
		});
		guess_btn.onclick = toggleMap

	}
}

loadBusData()
initMap()