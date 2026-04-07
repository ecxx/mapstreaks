const default_palette = ["#0088FF", "#008800", "#ff8c00", "#ff0000", "#ff0000", "#000000"]
const satellite_palette = ["#0088FF", "#F2FF00", "#ffaa00", "#ff8888", "#ff8888", "#000000"]

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

const DisplayTypes = ['stops', 'chull', 'box']
const MapProviders = {
	"base": new MapProvider('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
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

function styleCircleMarker(provider, properties) {
	colour = provider.colours[properties['colourkey']]
	return function (feature, latlng) {
		return L.circleMarker(latlng, {
			radius: 2,
			fillColor: colour,
			color: colour,
			weight: 1,
			opacity: 1,
			fillOpacity: 1
		});
	}
}

function stylePolygon(provider, properties) {
	colour = provider.colours[properties['colourkey']]
	opacity = properties['opacity']
	return function (feature) {
		if (feature['geometry']['type'] == "Point") return {}
		return {
			color: colour,
			weight: 3,
			fillColor: colour,
			fillOpacity: opacity
		}
	}
}

class Map {
	constructor(divid, data_mode) {
		this.divid = divid
		this.map = L.map(divid).setView([1.3521, 103.8198], 13);
		this.provider = null
		this.tilelayer = null
		this.datalayer = null
		this.data_mode = data_mode
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

	setData(data) {
		var bounds = [data['mincoord'], data['maxcoord']]
		data = data[this.data_mode]
		if (this.datalayer != null)
			this.map.removeLayer(this.datalayer)
		var elements = []
		for (var feature of data) {
			elements.push(L.geoJSON(feature, {
				pointToLayer: styleCircleMarker(this.provider, feature['properties']),
				style: stylePolygon(this.provider, feature['properties'])
			}))
		}
		this.datalayer = L.layerGroup(elements)
		this.datalayer.addTo(this.map)
		this.map.fitBounds(bounds)
	}
}

class DataProvider {
	constructor() {
		this.datapath = "data/data.json"
		this.data = {}
		this.keys = []
		this.keys_upper = []
	}

	async loadData() {
		var response = await fetch (this.datapath)
		this.data = await response.json()
		this.keys = Object.keys(this.data)
		this.keys_upper = this.keys.map(item => item.toUpperCase())
	}

	getData(bus) {
		if (this.keys.includes(bus)) return this.data[bus]
		else return {}
	}
}

class DataFilter {
	constructor(dataprovider, keys) {
		this.provider = dataprovider
		this.keys = keys
	}

	getBus() {
		var bus = this.keys[Math.floor(Math.random() * this.keys.length)]
		return [bus, this.provider.getData(bus)]
	} 

	static allfilter(dataprovider) {
		return new DataFilter(dataprovider, dataprovider.keys)
	}

}

class GameController {

	#bus;
	#busdata;

	constructor(map_id) {
		const params = new URLSearchParams(window.location.search);
		this.map_type = params.get("map")
		if (!Object.keys(MapProviders).includes(this.map_type)) this.map_type = "base"
		this.display_type = params.get("shape")
		if (!DisplayTypes.includes(this.display_type)) this.display_type = "stops"

		this.provider = new DataProvider()
		this.map = new Map(map_id, this.display_type)
		this.map.setProvider(MapProviders[this.map_type])
		this.#bus = ""
		this.#busdata = {}
		this.scores = [0, 0, 0] // +, -, gg
		this.streaks = [0, 0] // cur, max
	}

	async loadData() {
		await this.provider.loadData()
		this.filter = DataFilter.allfilter(this.provider)
	}

	setBus() {
		[this.#bus, this.#busdata] = this.filter.getBus()
		this.map.setData(this.#busdata)
	}

	resetBus(guess) {
		if (this.provider.keys_upper.includes(guess.toUpperCase())) {
			if (guess.toUpperCase() == this.#bus.toUpperCase()) {
				this.scores[0]++
				this.streaks[0]++
				if (this.streaks[1] < this.streaks[0]) this.streaks[1] = this.streaks[0]
				return [1, this.#bus]
			} else {
				this.scores[1]++
				this.streaks[0] = 0
				return [0, this.#bus]
			}
		} else if (guess.toUpperCase() == "GG") {
			this.scores[2]++
			this.streaks[0] = 0
			return ["gg", this.#bus];
		}
		return [null, null]
	}

}

class UserController {

	constructor(
		map_id = "map",
		p_feedback_id = "p_feedback",
		p_loading_id = "p_loading",
		f_start_id = "f_start",
		b_start_id = "b_start",
		f_guess_id = "f_guess",
		p_info_id = "p_info",
		i_guess_id = "i_guess",
		b_guess_id = "b_guess"
	) {
		this.controller = new GameController(map_id)
		this.map_id = map_id
		this.p_feedback_id = p_feedback_id
		this.p_feedback = document.getElementById(p_feedback_id)
		this.p_loading = document.getElementById(p_loading_id)
		this.f_start = document.getElementById(f_start_id)
		this.b_start = document.getElementById(b_start_id)
		this.f_guess = document.getElementById(f_guess_id)
		this.p_info  = document.getElementById(p_info_id)
		this.i_guess = document.getElementById(i_guess_id)
		this.b_guess = document.getElementById(b_guess_id)
		this.load()
		this.state = "set"
	}

	async load() {
		this.f_start.style.display = "none"
		this.f_guess.style.display = "none"
		await this.controller.loadData()
		this.f_start.style.display = ""
		this.p_loading.style.display = "none"
		this.b_start.onclick = function() {
			document.getElementById("f_start").style.display = "none"
			document.getElementById("f_guess").style.display = ""
			controller.update()
			document.getElementById("i_guess").addEventListener('keydown', (event) => {
				if (event.repeat) return;
				if (event.key === 'Enter') {
					controller.update()
					event.preventDefault();
				}
			});
			document.getElementById("b_guess").onclick = function() {
				controller.update()
			}
			this.starttime = new Date().getTime()
			var starttime = this.starttime
			this.interval = setInterval(function() {
				var now = new Date().getTime()
				var timed = now - starttime
				console.log(starttime)
				var seconds = Math.floor((timed % (1000 * 60)) / 1000);
				var minutes = Math.floor((timed % (1000 * 60 * 60)) / (1000 * 60));
				document.getElementById("timer").innerHTML = minutes.toString().padStart(2,'0') + ":" + seconds.toString().padStart(2,'0')
			}, 100)
		}
	}

	updatestats() {
		document.getElementById(this.p_feedback_id + "_c").innerHTML = this.controller.scores[0]
		document.getElementById(this.p_feedback_id + "_w").innerHTML = this.controller.scores[1]
		document.getElementById(this.p_feedback_id + "_gg").innerHTML = this.controller.scores[2]
		document.getElementById(this.p_feedback_id + "_cs").innerHTML = this.controller.streaks[0]
		document.getElementById(this.p_feedback_id + "_ms").innerHTML = this.controller.streaks[1]
	}

	update() {
		if (this.state == "set") {
			this.controller.setBus()
			this.p_info.innerHTML = "Your guess:"
			this.i_guess.value = ""
			this.state = "reset"
		} else {
			var guess = this.i_guess.value
			var result = this.controller.resetBus(guess)
			switch (result[0]) {
				case null:
					this.p_info.innerHTML = "Invalid guess, try again:"
					break;
				case 1:
					this.p_info.innerHTML = "You guessed: <span class='f-c'>" + guess + "</span>!"
					break;
				case 0:
					this.p_info.innerHTML = "You guessed: <span class='f-w'>" + guess + "</span> | Correct answer: <span class='f-c'>" + result[1] + "</span>"
					break;
				case "gg":
					this.p_info.innerHTML = "You guessed: <span class='f-g'>" + guess + "</span> | Correct answer: <span class='f-c'>" + result[1] + "</span>"
					break;
			}
			if (result != null) {
				this.state = "set"
				this.updatestats()
			}
		}
	}

}

var controller = new UserController()
controller.load()