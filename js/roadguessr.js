const default_palette = ["#0088FF", "#ff0000", "#000000"]
const satellite_palette = ["#0088FF","#ff8888", "#000000"]

var max_difficulty = 3

function degToRad(deg) {
	var rad = (deg * Math.PI) / 180;
	return rad;
}

function calculateDistance(startCoords, destCoords) {
	const startingLat = degToRad(startCoords.lat);
	const startingLong = degToRad(startCoords.lng);
	const destinationLat = degToRad(destCoords.lat);
	const destinationLong = degToRad(destCoords.lng);
	const radius = 6371;
	const distance = Math.acos(
		Math.sin(startingLat) * Math.sin(destinationLat) +
		Math.cos(startingLat) * Math.cos(destinationLat) *
		Math.cos(startingLong - destinationLong)
	) * radius;

	return distance;
}

class MapProvider {
	constructor(url, options, colours) {
		this.url = url
		this.options = options
		this.colours = colours
		this.layer = null
	}

	pop() {
		if (this.url == null)
			return null
		if (this.layer == null)
			this.layer = L.tileLayer(this.url, this.options)
		return this.layer
	}
}

const MapProviders = {
	"labels": new MapProvider('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: 'abcd',
		maxZoom: 20
	}, default_palette),
	"outline": new MapProvider('http://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &amp; USGS'
	}, default_palette),
	"nolabel": new MapProvider('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: 'abcd',
		maxZoom: 20
	}, default_palette),
	"satellite": new MapProvider('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
	}, satellite_palette),
	"mapless": new MapProvider(null, null, default_palette),
	"relief": new MapProvider('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', {
		attribution: 'Tiles &copy; Esri &mdash; Source: Esri',
		maxZoom: 13
	}, default_palette),
}

function styleCircleMarker(provider, ckey, latlng) {
	colour = provider.colours[ckey]
	return L.circleMarker(latlng, {
		radius: 4,
		fillColor: colour,
		color: colour,
		weight: 1,
		opacity: 1,
		fillOpacity: 1
	});
}

class Map {

	#data;
	#roadshape;

	onClick = (res) => {
		if (this.state == "reset") return;
		if (!res || !res.latlng) return;
		this.lastloc = res.latlng
		if (this.selectionmarker == null) {
			this.selectionmarker = L.marker(this.lastloc).addTo(this.map)
		} else {
			this.selectionmarker.setLatLng(this.lastloc)
		}
	}

	onKeyDown = (res) => {
		if (event.repeat) return;
		if (event.key === 'Enter') {
			this.enterFunction()
		}
	}

	onEnterButton = (res) => {
		this.enterFunction()
	}

	constructor(divid) {
		this.map = L.map(divid);
		this.map.setView([1.3521, 103.8198], 12);
		this.selectionmarker = null
		this.answermarker = null
		this.pathmarker = null
		this.datapath = "data/data_roadguessr.json"

		this.#data = null
		this.keys = null
		this.stopid = null
		this.stopname = null
		this.#roadshape = {}

		this.lastloc = null

		this.attempts = 0
		this.distsum = 0
		this.best = "-"
		this.l5a = []
		this.alla = []

		this.state = "set"
	}

	async loadData() {
		var response = await fetch(this.datapath)
		this.#data = await response.json()
		this.keys = Object.keys(this.#data['features'])
	}

	updateScores() {
		document.getElementById("p_feedback_best").innerHTML = this.best
		if (this.attempts > 0) {
			var mn = (this.distsum / this.attempts).toFixed(3)
			document.getElementById("p_feedback_mean").innerHTML = mn
			document.getElementById("p_feedback_l5").innerHTML = this.l5a.join("km, ") + "km"
		}
	}

	addAttempt(distance) {
		this.l5a.unshift(distance.toFixed(3))
		if (this.l5a.length > 5) this.l5a.pop()
		this.alla.push(distance.toFixed(3))
		this.distsum += distance
		this.attempts++
		if (this.best == "-") this.best = distance.toFixed(3)
		else if (this.best >= distance) this.best = distance.toFixed(3)
		this.updateScores()
 	}

	setProvider(provider) {
		if (this.tilelayer != null)
			this.map.removeLayer(this.tilelayer)
		this.provider = provider
		this.tilelayer = this.provider.pop()
		if (this.tilelayer != null) {
			this.tilelayer.addTo(this.map)
		}
	}

	startGame() {
		this.map.on("click", this.onClick);
		document.addEventListener("keydown", this.onKeyDown);
		document.getElementById("b_guess").addEventListener("click", this.onEnterButton);
		this.setStop()
	}

	enterFunction() {
		if (this.state == "set") {
			if (this.lastloc == null) return;

			var pt = turf.point([this.lastloc.lng, this.lastloc.lat])
			var d = 200
			var bestpoint = null

			if (this.#roadshape.geometry.type == "MultiLineString") {
				for (var _ln of this.#roadshape.geometry.coordinates) {
					var ln = turf.lineString(_ln)
					var res = turf.nearestPointOnLine(ln, pt, { units: "kilometers" })
					if (res.properties.dist < d) {
						d = res.properties.dist
						bestpoint = res.geometry.coordinates
					}
				}
			} else {
				var ln = turf.lineString(this.#roadshape.geometry.coordinates)
				var res = turf.nearestPointOnLine(ln, pt, { units: "kilometers" })
				d = res.properties.dist
				bestpoint = res.geometry.coordinates
			}

			this.addAttempt(d);
			if (d <= 1) document.getElementById("p_info").innerHTML = "You were <span class='f-c'>" + d.toFixed(4) + "</span> km away from " + this.roadname + "!"
			else if (d <= 5) document.getElementById("p_info").innerHTML = "You were <span class='f-g'>" + d.toFixed(4) + "</span> km away from " + this.roadname + "!"
			else document.getElementById("p_info").innerHTML = "You were <span class='f-w'>" + d.toFixed(4) + "</span> km away from " + this.roadname + "!"
			this.map.setView([1.3521, 103.8198], 12);
			this.answermarker = L.geoJSON(this.#roadshape).addTo(this.map);
			this.pathmarker = L.polyline([
				[this.lastloc.lat, this.lastloc.lng],
				[bestpoint[1], bestpoint[0]]
			], {color: 'red'}).addTo(this.map)
			this.state = "reset"
		} else {
			this.setStop();
			this.map.removeLayer(this.answermarker);
			this.map.removeLayer(this.pathmarker);
			this.state = "set"
		}
	}

	setStop() {
		this.map.setView([1.3521, 103.8198], 12);
		var difficulty = 4
		while (difficulty > max_difficulty) {
			var stop = this.keys[Math.floor(Math.random() * this.keys.length)]
			difficulty = this.#data['features'][stop].properties.classifier
		}
		this.lastloc = null
		if (this.selectionmarker != null) this.map.removeLayer(this.selectionmarker)
		this.selectionmarker = null
		this.roadname = this.#data['features'][stop]['properties']['name']
		this.#roadshape = this.#data['features'][stop]
		document.getElementById("p_info").innerHTML = "Guess where <span class='f-c'>" + this.roadname + "</span> is:"
	}

	resetView() {
		this.map.setView([1.3521, 103.8198], 13);
	}

}

const map = new Map("map")
const params = new URLSearchParams(window.location.search);
map_type = params.get("map")
difficulty = params.get("diff")
if (!Object.keys(MapProviders).includes(this.map_type)) this.map_type = "nolabel"
if (difficulty == "hard") max_difficulty = 3
if (difficulty == "medium") max_difficulty = 2
if (difficulty == "easy") max_difficulty = 1
map.setProvider(MapProviders[map_type])
async function mainf() {
	document.getElementById("p_feedback").style.display = "none"
	document.getElementById("f_start").style.display = "none"
	document.getElementById("f_guess").style.display = "none"
	document.getElementById("p_info").style.display = "none"
	await map.loadData()
	document.getElementById("p_feedback").style.display = ""
	document.getElementById("f_start").style.display = ""
	document.getElementById("p_loading").style.display = "none"
}

document.getElementById("b_start").onclick = function() {
	map.startGame()
	map.setStop()
	document.getElementById("f_start").style.display = "none"
	document.getElementById("p_info").style.display = ""
	document.getElementById("f_guess").style.display = ""
}

mainf()