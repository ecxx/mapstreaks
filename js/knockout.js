function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
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

class DataProvider {

	#data;
	#roads;
	#svcs;
	#sli;

	constructor() {
		this.datapath = "data/data_knockout.json"
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
		this.keys = Object.keys(this.#svcs).map(item => item.toUpperCase())
		this.scores = [0,0,0]
		this.streaks = [0,0]
	}

	submit(bus) {
		if (!(this.keys.includes(bus.toUpperCase()))) return Result.INVL
		if (this.#svcs[bus] == 1) {
			this.scores[2]++
			return Result.DUPE
		}
		// below this are scored
		if (this.#roads[this.croad].map(item => item.toUpperCase()).includes(bus.toUpperCase())) {
			this.#svcs[bus] = 1
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
			var road = keys[ keys.length * Math.random() << 0]
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
			interval = setInterval(function () {
				var now = new Date().getTime()
				var timed = now - starttime
				var seconds = Math.floor((timed % (1000 * 60)) / 1000);
				var minutes = Math.floor(timed / (1000 * 60));
				document.getElementById("timer").innerHTML = minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0')
			}, 100)
		}
	}

	displayModal() {
		var timed = lasttime - starttime;
		var seconds = Math.floor((timed % (1000 * 60)) / 1000);
		var minutes = Math.floor(timed / (1000 * 60));
		document.getElementById("mm-min").innerHTML = Math.floor(timed / (1000 * 60));
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
		if (this.provider.services_left <= 100) {
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
					this.p_info.innerHTML = "Invalid guess, try again:"
					break;
				case Result.DUPE:
					this.p_info.innerHTML = "Already named <span class='f-b'>" + guess + "</span>, try again:"
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