b64 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+#"

function setCookie(cname, cvalue, exdays) {
	const d = new Date();
	d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
	let expires = "expires=" + d.toUTCString();
	document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
	let name = cname + "=";
	let decodedCookie = decodeURIComponent(document.cookie);
	let ca = decodedCookie.split(';');
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return "";
}

function encode_state(svc, version, scores, streaks) {
	setCookie("KO_version", version, 30)
	setCookie("KO_starttime", starttime, 30)
	setCookie("KO_s0", scores[0], 30)
	setCookie("KO_s1", scores[1], 30)
	setCookie("KO_s2", scores[2], 30)
	setCookie("KO_st", streaks[1], 30)
	
	let i = 1
	let q = 0
	let enc = ""
	for (key of Object.keys(svc)) {
		q += i * Number(svc[key])
		i *= 2;
		if (i == 64) {
			enc += b64[q]
			i = 1
			q = 0
		}
	}
	if (i != 1) enc += b64[q]
	setCookie("KO_gamestate", enc, 30)
}

function decode_version() {
	return getCookie("KO_version")
}

function decode_state(svc) {
	let ver = getCookie("KO_version")
	if (ver == "") return {}
	let enc = getCookie("KO_gamestate")
	console.log(enc)
	let i = 0
	let e = 0
	let svc_left = 0
	let starttime = getCookie("KO_starttime")

	for (key of Object.keys(svc)) {
		if (i == 0) {
			i = 6
			ch = b64.indexOf(enc[e])
			e++
		}
		svc[key] = (ch%2)
		if (svc[key] == 0) svc_left++
		ch = (ch - ch%2)/2
		i--;
	}
	return {
		"version": ver,
		"starttime": starttime,
		"svc": svc,
		"svc_left": svc_left,
		"scores": [
			Number(getCookie("KO_s0")),
			Number(getCookie("KO_s1")),
			Number(getCookie("KO_s2"))
		],
		"streaks": [
			0,
			Number(getCookie("KO_st"))
		]
	}
}

let modal_display = new bootstrap.Modal(document.getElementById('model_display'), {});

const Result = {
	INVL: "invalid",
	DUPE: "duplicate",
	NOR: "notonroad",
	AC: "accepted"
};

var starttime;
var lasttime;
var interval;
var lastsave = 0;

class DataProvider {

	#data;
	#roads;
	#svcs;
	#sli;

	constructor() {
		this.datapath = "data/knockout/latest.json"
		this.#data = {}
		this.#roads = []
		this.#svcs = []
		this.#sli = []

	}

	async loadData() {
		var response = await fetch(this.datapath)
		this.#data = await response.json()
		this.#roads = this.#data['roads']
		this.#svcs = this.#data['services']
		this.#sli = this.#data['services_li']
		this.services_left = Object.keys(this.#svcs).length
		this.keys = Object.keys(this.#svcs)
		this.scores = [0, 0, 0]
		this.streaks = [0, 0]
		this.version = this.#data['data_version']
	}

	savestate() {
		console.log(this.version)
		encode_state(this.#svcs, this.version, this.scores, this.streaks)
	}

	async loadstate() {
		var version = decode_version()
		if (version == "") return
		this.datapath = "data/knockout/" + version + ".json"
		var response = await fetch(this.datapath)
		this.#data = await response.json()
		this.#roads = this.#data['roads']
		this.#svcs = this.#data['services']
		this.#sli = this.#data['services_li']
		let decoded_state = decode_state(this.#svcs)
		this.scores = decoded_state['scores']
		this.streaks = decoded_state['streaks']
		starttime = decoded_state['starttime']
		this.#svcs = decoded_state['svc']
		this.services_left = decoded_state['svc_left']
	}

	submit(bus) {
		if (!(this.keys.includes(bus.toUpperCase()))) return Result.INVL
		if (this.#svcs[bus.toUpperCase()] == 1) {
			this.scores[2]++
			return Result.DUPE
		}
		// below this are scored
		if (this.#roads[this.croad].includes(bus.toUpperCase())) {
			this.#svcs[bus.toUpperCase()] = 1
			this.services_left -= 1
			this.streaks[0]++
			this.scores[0]++
			if (this.streaks[1] < this.streaks[0]) this.streaks[1] = this.streaks[0]
			return Result.AC
		} else {
			this.scores[1]++
			this.streaks[0] = 0
			return Result.NOR
		}

	}

	output_rem_buses(elem) {
		var ar = []
		for (var k of this.#sli) {
			if (this.#svcs[k] == 0) ar.push(k.padEnd(4, " "))
		}
		elem.innerHTML = "Buses remaining:<br>" + ar.join(", ")
	}

	getroad() {
		while (true) {
			var keys = Object.keys(this.#roads);
			var road = keys[keys.length * Math.random() << 0]
			for (var x of this.#roads[road]) {
				if (this.#svcs[x] == 0) {
					this.croad = road
					return road
				}
			}
			delete this.#roads[road]
		}
	}

}

class UserController {

	constructor(
		p_feedback_id = "p_feedback",
		p_loading_id = "p_loading",
		f_start_id = "f_start",
		b_start_id = "b_start",
		f_guess_id = "f_guess",
		p_info_id = "p_info",
		i_guess_id = "i_guess",
		b_guess_id = "b_guess",
		b_display_id = "rds_display"
	) {
		this.provider = new DataProvider()
		this.p_feedback_id = p_feedback_id
		this.p_feedback = document.getElementById(p_feedback_id)
		this.p_loading = document.getElementById(p_loading_id)
		this.f_start = document.getElementById(f_start_id)
		this.b_start = document.getElementById(b_start_id)
		this.f_guess = document.getElementById(f_guess_id)
		this.p_info = document.getElementById(p_info_id)
		this.i_guess = document.getElementById(i_guess_id)
		this.b_guess = document.getElementById(b_guess_id)
		this.display = document.getElementById(b_display_id)
		this.load()
		this.state = "set"
	}

	async load() {
		this.f_start.style.display = "none"
		this.f_guess.style.display = "none"
		await this.provider.loadData()
		this.updatestats()
		this.f_start.style.display = ""
		this.p_loading.style.display = "none"
		this.b_start.onclick = function () {
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
			document.getElementById("b_guess").onclick = function () {
				controller.update()
			}
			starttime = new Date().getTime()
			lastsave = starttime
			interval = setInterval(function () {
				var now = new Date().getTime()
				var timed = now - starttime
				var lst = Math.floor((now - lastsave) / 1000);
				document.getElementById("lst").innerHTML = lst
				var seconds = Math.floor((timed % (1000 * 60)) / 1000);
				var minutes = Math.floor(timed % (1000 * 60 * 60) / (1000 * 60));
				var hours = Math.floor(timed / (1000 * 60 * 60));
				if ((now - lastsave) > (60 * 1000)) {
					controller.provider.savestate()
					lastsave = now
				}
				if (hours == 0) document.getElementById("timer").innerHTML = minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0')
				else document.getElementById("timer").innerHTML = hours.toString().padStart(2, '0') + ":" + minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0')
			}, 100)
		}
		var version = decode_version()
		if (version) {
			document.getElementById("p_version").style.display = ""
			document.getElementById("b_rl").onclick = async function () {
				await controller.provider.loadstate()
				document.getElementById("p_version").innerHTML = "Playing on version " + version
				controller.updatestats()
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
				document.getElementById("b_guess").onclick = function () {
					controller.update()
				}
				lastsave = new Date().getTime()
				interval = setInterval(function () {
					var now = new Date().getTime()
					var timed = now - starttime
					var lst = Math.floor((now - lastsave) / 1000);
					document.getElementById("lst").innerHTML = lst
					var seconds = Math.floor((timed % (1000 * 60)) / 1000);
					var minutes = Math.floor(timed % (1000 * 60 * 60) / (1000 * 60));
					var hours = Math.floor(timed / (1000 * 60 * 60));
					if ((now - lastsave) > (60 * 1000)) {
						controller.provider.savestate()
						lastsave = now
					}
					if (hours == 0) document.getElementById("timer").innerHTML = minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0')
					else document.getElementById("timer").innerHTML = hours.toString().padStart(2, '0') + ":" + minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0')
				}, 100)
			}
		}
		else document.getElementById("b_rl").style.display = "none"
	}

	displayModal() {
		var timed = lasttime - starttime;
		var seconds = Math.floor((timed % (1000 * 60)) / 1000);
		var minutes = Math.floor(timed % (1000 * 60 * 60)/ (1000 * 60));
		var hours = Math.floor(timed / (1000 * 60 * 60));
		document.getElementById("mm-hr").innerHTML = Math.floor(timed / (1000 * 60 * 60));
		document.getElementById("mm-min").innerHTML = Math.floor(timed % (1000 * 60 * 60)/ (1000 * 60));
		document.getElementById("mm-sec").innerHTML = Math.floor((timed % (1000 * 60)) / 1000);
		document.getElementById("mm-c").innerHTML = this.provider.scores[0]
		document.getElementById("mm-w").innerHTML = this.provider.scores[1]
		document.getElementById("mm-d").innerHTML = this.provider.scores[2]
		document.getElementById("mm-s").innerHTML = this.provider.streaks[1]
		modal_display.show()
	}

	updatestats() {
		document.getElementById(this.p_feedback_id + "_c").innerHTML = this.provider.scores[0]
		document.getElementById(this.p_feedback_id + "_w").innerHTML = this.provider.scores[1]
		document.getElementById(this.p_feedback_id + "_bl").innerHTML = this.provider.services_left
		document.getElementById(this.p_feedback_id + "_cs").innerHTML = this.provider.streaks[0]
		document.getElementById(this.p_feedback_id + "_ms").innerHTML = this.provider.streaks[1]
		if (this.provider.services_left <= 200) {
			this.provider.output_rem_buses(this.display)
		}

		if (this.provider.services_left == 0) {
			// end game code
			lasttime = new Date().getTime()
			clearInterval(interval);
			document.getElementById("f_guess").style.display = "none"
			document.getElementById("rds_display").style.display = "none"
			this.displayModal();
		}
	}

	update() {
		if (this.state == "set") {
			var road = this.provider.getroad()
			this.p_info.innerHTML = "Name a bus from <span class='f-b'>" + road + "</span> that you have not named yet:"
			this.i_guess.value = ""
			this.state = "reset"
		} else {
			var guess = this.i_guess.value
			var result = this.provider.submit(guess)
			switch (result) {
				case Result.INVL:
					this.p_info.innerHTML = "Invalid guess, try again (road: " + this.provider.croad + ")"
					break;
				case Result.DUPE:
					this.p_info.innerHTML = "Already named <span class='f-b'>" + guess + "</span>, try again (road: " + this.provider.croad + ")"
					break;
				case Result.AC:
					this.p_info.innerHTML = "You named: <span class='f-c'>" + guess + "</span>!"
					break;
				case Result.NOR:
					this.p_info.innerHTML = "You named: <span class='f-w'>" + guess + "</span>, which is not on <span class='f-b'>" + this.provider.croad + "</span>"
					break;
			}
			if (result == Result.NOR || result == Result.AC) {
				this.state = "set"
				this.updatestats()
			}
		}
	}

}

var controller = new UserController()
controller.load()