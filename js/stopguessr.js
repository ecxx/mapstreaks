const default_palette = ["#0088FF", "#ff0000", "#000000"]
const satellite_palette = ["#0088FF","#ff8888", "#000000"]

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
	#stoploc;

	onClick = (res) => {
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
			if (this.state == "set") {
				if (this.lastloc == null) return;
				var d = calculateDistance(this.lastloc, this.#stoploc);
				this.addAttempt(d);
				if (d <= 1) document.getElementById("p_info").innerHTML = "You were <span class='f-c'>" + d.toFixed(4) + "</span> km away from " + this.stopid + " " + this.stopname + "!"
				else if (d <= 5) document.getElementById("p_info").innerHTML = "You were <span class='f-g'>" + d.toFixed(4) + "</span> km away from " + this.stopid + " " + this.stopname + "!"
				else document.getElementById("p_info").innerHTML = "You were <span class='f-w'>" + d.toFixed(4) + "</span> km away from " + this.stopid + " " + this.stopname + "!"
				this.map.setView([1.3521, 103.8198], 12);
				this.answermarker = styleCircleMarker(this.provider, 1, this.#stoploc).addTo(this.map)
				this.state = "reset"
			} else {
				this.setStop();
				this.map.removeLayer(this.answermarker);
				this.state = "set"
			}
		}
	}

	constructor(divid) {
		this.map = L.map(divid);
		this.map.setView([1.3521, 103.8198], 12);
		this.selectionmarker = null
		this.answermarker = null
		this.datapath = "data/data_stopguessr.json"

		this.#data = null
		this.keys = null
		this.stopid = null
		this.stopname = null
		this.#stoploc = []

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
		this.keys = Object.keys(this.#data)
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
		this.setStop()
	}

	setStop() {
		this.map.setView([1.3521, 103.8198], 12);
		var stop = this.keys[Math.floor(Math.random() * this.keys.length)]
		this.lastloc = null
		if (this.selectionmarker != null) this.map.removeLayer(this.selectionmarker)
		this.selectionmarker = null
		this.stopid = stop
		this.stopname = this.#data[stop][2]
		this.#stoploc = {lat: this.#data[stop][1], lng: this.#data[stop][0]}
		document.getElementById("p_info").innerHTML = "Guess where BS " + this.stopid + " (" + this.stopname + ") is:"
	}

	resetView() {
		this.map.setView([1.3521, 103.8198], 13);
	}

}

const map = new Map("map")
const params = new URLSearchParams(window.location.search);
map_type = params.get("map")
if (!Object.keys(MapProviders).includes(this.map_type)) this.map_type = "nolabel"
map.setProvider(MapProviders[map_type])
async function mainf() {
	document.getElementById("p_feedback").style.display = "none"
	document.getElementById("f_start").style.display = "none"
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
}

mainf()