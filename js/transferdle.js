const default_palette = ["#0088FF", "#008800", "#ff8c00", "#ff0000"]
const satellite_palette = ["#0088FF", "#F2FF00", "#ffaa00", "#ff8888"]

/*
0: start
1: all previous stops
2: current
3: end
*/

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

function styleCircleMarker(provider, ckey, latlng, rad) {
	colour = provider.colours[ckey]
	return L.circleMarker(latlng, {
		radius: rad,
		fillColor: colour,
		color: colour,
		weight: 1,
		opacity: 1,
		fillOpacity: 1
	});
}

class Map {
	constructor(divid) {
		this.divid = divid
		this.map = L.map(divid).setView([1.3521, 103.8198], 12);
		this.tilelayer = null
		this.data_start_stop = null
		this.data_target_stop = null
		this.data_latest_stop = null
		this.data_intermediary_stops = null
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

	resetAll() {
		this.map.setView([1.3521, 103.8198], 12);
		if (this.data_intermediary_stops) this.map.removeLayer(this.data_intermediary_stops)
		this.data_intermediary_stops = L.layerGroup([])
		this.data_intermediary_stops.addTo(this.map)
		if (this.data_start_stop) this.map.removeLayer(this.data_start_stop)
		if (this.data_target_stop) this.map.removeLayer(this.data_target_stop)
		if (this.data_latest_stop) this.map.removeLayer(this.data_latest_stop)
	}

	setStart(latlng) {
		this.data_start_stop = styleCircleMarker(this.provider, 0, latlng, 4).addTo(this.map)
	}

	setTarget(latlng) {
		this.data_target_stop = styleCircleMarker(this.provider, 3, latlng, 4).addTo(this.map)
	}

	setLatest(latlng) {
		if (this.data_latest_stop) this.map.removeLayer(this.data_latest_stop)
		this.data_latest_stop = styleCircleMarker(this.provider, 2, latlng, 4).addTo(this.map)
	}

	delLatest() {
		if (this.data_latest_stop) this.map.removeLayer(this.data_latest_stop)
	}

	addInter(latlng) {
		styleCircleMarker(this.provider, 1, latlng, 2).addTo(this.data_intermediary_stops)
	}

}

class GameController {

	constructor(map) {
		this.datapath = "data/data_transferdle.json"
		this.data = {}
		this.keys = []

		this.map = map
		
		this.best_transfers = "-"

		this.distance = 0
		this.transfers = 0
		this.stops = 0

		this.bus = ""
		this.bus_direction = ""
		this.starting_stop = ""
		this.stop = ""
		this.sequence = 0

		this.run = []
		this.transfer_options = {}
	}

	async loadData() {
		var response = await fetch(this.datapath)
		this.data = await response.json()
		this.d_services = this.data["services"]
		this.d_stops = this.data["stops"]
		this.stop_keys = Object.keys(this.d_stops)
	}

	getLatLng(id) {
		return this.d_stops[id]['LatLng']
	}

	startRound() {
		this.distance = 0
		this.transfers = 0
		this.stops = 0

		this.selection_state = "U"

		this.bus = ""
		this.bus_direction = ""
		this.starting_stop = this.stop_keys[Math.floor(Math.random() * this.stop_keys.length)]
		this.stop = this.starting_stop
		this.target_stop = this.stop_keys[Math.floor(Math.random() * this.stop_keys.length)]
		while (this.target_stop == this.starting_stop) this.target_stop = this.stop_keys[Math.floor(Math.random() * this.stop_keys.length)]
		this.sequence = 0
		this.run = []
		this.transfer_options = {}
		this.generateValidBuses()
		this.startRefreshUI()

		this.map.resetAll()
		this.map.setStart(this.getLatLng(this.starting_stop))
		this.map.setTarget(this.getLatLng(this.target_stop))

		return [this.starting_stop, this.target_stop]
	}

	generateValidBuses() {
		this.transfer_options = this.d_stops[this.stop]['Services']
	}

	boardBus(service, direction) { // only called once, at the start of the round
		if (this.bus != "") return -1
		if (!Object.keys(this.d_stops[this.stop]['Services']).includes(service)) return -1;
		if (!Object.keys(this.d_stops[this.stop]['Services'][service]).includes(direction)) return -1;
		this.run.push(service)
		this.bus = service
		this.bus_direction = direction
		this.sequence = this.d_stops[this.stop]['Services'][service][direction][0]
		this.map.setLatest(this.getLatLng(this.stop))


		this.refreshValidBuses()
		this.refreshUI()
		return 0;
	}

	transferBus(service, direction) { // called each time 
		if (this.bus == "") return -1
		if (!Object.keys(this.transfer_options).includes(service)) return -1;
		if (!Object.keys(this.transfer_options[service]).includes(direction)) return -1;
		var newbdata = this.transfer_options[service][direction]
		// draw map stuff
		for (var [seqno, sx] of Object.entries(this.d_services[this.bus][this.bus_direction]['stops'])) {
			if (parseInt(seqno) <= parseInt(this.sequence)) continue;
			if (parseInt(seqno) > parseInt(newbdata[3])) continue;
			this.map.addInter(this.getLatLng(sx[0]))
		}

		this.run.push(service)
		this.bus = service
		this.bus_direction = direction
		this.stop = newbdata[1]
		var oldseqno = this.sequence
		this.sequence = newbdata[0]

		this.map.setLatest(this.getLatLng(this.stop))

		// update statistics
		this.distance += newbdata[2]
		this.stops += newbdata[3] - oldseqno
		this.transfers += 1
		this.refreshValidBuses()
		this.refreshUI()
		return 0;
	}

	endRound(service, direction) {
		var owndis = this.d_services[this.bus][this.bus_direction]['stops'][this.sequence][1]
		for (var [seqno, sx] of Object.entries(this.d_services[this.bus][this.bus_direction]['stops'])) {
			if (seqno < this.sequence) continue;
			var sno = sx[0]
			var newdis = Math.round((sx[1]- owndis)*10)/10
			if (sno == this.target_stop) {

				// draw map stuff
				for (var [qsno, qsx] of Object.entries(this.d_services[this.bus][this.bus_direction]['stops'])) {
					if (parseInt(qsno) <= parseInt(this.sequence)) continue;
					if (parseInt(qsno) >= parseInt(seqno)) continue;
					this.map.addInter(this.getLatLng(qsx[0]))
				}
				this.map.delLatest()

				this.distance += newdis
				this.stops += seqno - this.sequence
				this.bus = ""
				this.stop = this.target_stop

				if (this.best_transfers == "-") this.best_transfers = this.transfers
				if (this.best_transfers > this.transfers) this.best_transfers = this.transfers
				this.refreshUI()
				return 0
			}
		}
		return -1
	}

	refreshValidBuses() {
		this.transfer_options = {}
		var owndis = this.d_services[this.bus][this.bus_direction]['stops'][this.sequence][1]
		for (var [seqno, sx] of Object.entries(this.d_services[this.bus][this.bus_direction]['stops'])) {
			var sno = sx[0]
			var newdis = Math.round((sx[1]- owndis)*10)/10
			if (parseInt(seqno) < parseInt(this.sequence)) continue;
			for (var t_bus of Object.keys(this.d_stops[sno]['Services'])) {
				for (var [t_dir, t_sqno] of Object.entries(this.d_stops[sno]['Services'][t_bus])) {
					this.transfer_options[t_bus] = this.transfer_options[t_bus] || {}
					this.transfer_options[t_bus][t_dir] = this.transfer_options[t_bus][t_dir] || [t_sqno[0], sno, newdis, seqno]
					if (this.transfer_options[t_bus][t_dir][0] > t_sqno[0]) this.transfer_options[t_bus][t_dir] = [t_sqno[0], sno, newdis, seqno]
 				}
			}
		}
	}

	startRefreshUI() {
		document.getElementById("p_feedback_start").innerHTML = this.starting_stop + " " + this.d_stops[this.starting_stop]['Name'][0] + " (" + this.d_stops[this.starting_stop]['Name'][1] + ")"
		document.getElementById("p_feedback_target").innerHTML = this.target_stop + " " + this.d_stops[this.target_stop]['Name'][0] + " (" + this.d_stops[this.target_stop]['Name'][1] + ")"
		this.refreshUI()
	}

	refreshUI() {
		document.getElementById("p_feedback_cstop").innerHTML = this.stop + " " + this.d_stops[this.stop]['Name'][0] + " (" + this.d_stops[this.stop]['Name'][1] + ")"
		if (this.bus != ""){
			document.getElementById("p_feedback_cbus").innerHTML = this.bus
			document.getElementById("p_feedback_cbusdir").innerHTML = this.d_services[this.bus][this.bus_direction]["route"]
		} else {
			document.getElementById("p_feedback_cbus").innerHTML = "-"
			document.getElementById("p_feedback_cbusdir").innerHTML = "-"
		}
		document.getElementById("p_feedback_run").innerHTML = this.run.join("-")
		document.getElementById("p_feedback_cs").innerHTML = this.transfers
		document.getElementById("p_feedback_ms").innerHTML = this.best_transfers
	}

	endRefreshUI() {
		document.getElementById("p_round_tfr").innerHTML = "<span class='f-c'>" + this.transfers + "</span>"
		document.getElementById("p_round_dist").innerHTML = "<span class='f-c'>" +  Math.round(this.distance*10)/10 + "</span>km"
		document.getElementById("p_round_stops").innerHTML = "<span class='f-c'>" + this.stops + "</span>"
	}

	update() {
		var input = document.getElementById("i_guess").value.toUpperCase()
		var pinfo = document.getElementById("p_info")
		switch(this.selection_state) {
			case "U": // unboarded / game just started. try to board a bus
				if (!Object.keys(this.transfer_options).includes(input)) {
					// error
					pinfo.innerHTML = "Can't board " + input + ", name another bus:"
				} else if (Object.keys(this.transfer_options[input]).length == 1) {
					// directly board the bus
					this.selection_bus = input
					this.selection_direction = Object.keys(this.transfer_options[input])[0]
					this.boardBus(this.selection_bus, this.selection_direction)
					pinfo.innerHTML = "Transfer onto a bus | E to end journey: "
					document.getElementById("i_guess").value = ""
					this.selection_state = "B"
				} else {
					this.selection_bus = input
					var newinnerhtml = "Bus " + input + ", choose direction: <br>"
					for (var direction of Object.keys(this.transfer_options[input])) {
						newinnerhtml += "[<span class='f-g'>" + direction + "</span>] " + this.d_services[input][direction]["route"] + "<br>"
					}
					newinnerhtml += "To cancel selection, enter anything else"
					pinfo.innerHTML = newinnerhtml
					document.getElementById("i_guess").value = ""
					this.selection_state = "US"
				}
				return;
			case "B": // boarded
				if (input=="E") {
					var out = this.endRound()
					if (out == 0) {
						pinfo.innerHTML = "<span class='f-c'>Arrived!</span> Press enter to continue:"
						document.getElementById("i_guess").value = ""
						this.selection_state = "W"
						document.getElementById("round_stats").style.display = ""
						document.getElementById("p_detail").style.display = "none"
						this.endRefreshUI()
					} else {
						pinfo.innerHTML = "Can't reach target stop on this bus. Name a bus:"
					}
					return;
				}
				if (!Object.keys(this.transfer_options).includes(input)) {
					// error
					pinfo.innerHTML = "Can't board " + input + ", name another bus:"
				} else if (Object.keys(this.transfer_options[input]).length == 1) {
					// directly board the bus
					this.selection_bus = input
					this.selection_direction = Object.keys(this.transfer_options[input])[0]
					this.transferBus(this.selection_bus, this.selection_direction)
					pinfo.innerHTML = "Transfer onto a bus | E to end journey: "
					document.getElementById("i_guess").value = ""
					this.selection_state = "B"
				} else {
					this.selection_bus = input
					var newinnerhtml = "Bus " + input + ", choose direction: <br>"
					for (var direction of Object.keys(this.transfer_options[input])) {
						newinnerhtml += "[<span class='f-g'>" + direction + "</span>] " + this.d_services[input][direction]["route"] + "<br>"
					}
					newinnerhtml += "To cancel selection, enter anything else"
					pinfo.innerHTML = newinnerhtml
					document.getElementById("i_guess").value = ""
					this.selection_state = "BS"
				}
				return;
			case "US": // selecting direction
				if (!Object.keys(this.transfer_options[this.selection_bus]).includes(input)) {
					// reset
					pinfo.innerHTML = "Board a bus: "
					document.getElementById("i_guess").value = ""
					this.selection_state = "U"
				} else {
					this.selection_direction = input
					this.boardBus(this.selection_bus, this.selection_direction)
					pinfo.innerHTML = "Transfer onto a bus | E to end journey: "
					document.getElementById("i_guess").value = ""
					this.selection_state = "B"
				}
				return;
			case "BS": // selecting direction
				if (!Object.keys(this.transfer_options[this.selection_bus]).includes(input)) {
					// reset
					pinfo.innerHTML = "Transfer onto a bus | E to end journey: "
					document.getElementById("i_guess").value = ""
					this.selection_state = "B"
				} else {
					this.selection_direction = input
					this.transferBus(this.selection_bus, this.selection_direction)
					pinfo.innerHTML = "Transfer onto a bus | E to end journey: "
					document.getElementById("i_guess").value = ""
					this.selection_state = "B"
				}
				return;
			case "W": // restart
				document.getElementById("round_stats").style.display = "none"
				document.getElementById("p_detail").style.display = ""
				this.startRound()
				pinfo.innerHTML = "Board a bus: "
		}
	}

}

const map = new Map("map")
const params = new URLSearchParams(window.location.search);
map_type = params.get("map")
if (!Object.keys(MapProviders).includes(this.map_type)) this.map_type = "nolabel"
map.setProvider(MapProviders[map_type])

var controller = new GameController(map)


async function mainf() {
	document.getElementById("p_feedback").style.display = "none"
	document.getElementById("p_detail").style.display = "none"
	document.getElementById("f_start").style.display = "none"
	document.getElementById("f_guess").style.display = "none"
	document.getElementById("round_stats").style.display = "none"
	await controller.loadData()
	document.getElementById("p_feedback").style.display = ""
	document.getElementById("f_start").style.display = ""
	document.getElementById("p_detail").style.display = ""
	document.getElementById("p_loading").style.display = "none"
}

document.getElementById("b_start").onclick = function() {
	controller.startRound()
	document.getElementById("f_start").style.display = "none"
	document.getElementById("f_guess").style.display = ""

	document.getElementById("i_guess").addEventListener('keydown', (event) => {
		if (event.repeat) return;
		if (event.key === 'Enter') {
			controller.update()
			event.preventDefault();
		}
	});
	document.getElementById("b_guess").onclick = function () {
		controller.update()
	}

}

mainf()