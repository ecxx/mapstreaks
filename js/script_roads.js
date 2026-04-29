function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    } 
}

const DisplayTypes = ['routes', 'roads_easy', 'roads_hard']
class Display {
	constructor(divid, data_mode) {
		this.divid = divid
		this.disp = document.getElementById(divid)
		this.data_mode = data_mode
	}

	setData(data) {
		data = data[this.data_mode]
		let display_array = []
		if (this.data_mode != 'routes') {
			for (let _rt of data) {
				let rt = _rt.slice(0)
				shuffleArray(rt)
				for (let a of rt) {
					display_array.push(a + "<br>")
				}
			}
		} else {
			let k = 1
			for (let rt of data) {
				display_array.push("<b class='f-c'>Route " + k + "</b><br>")
				k += 1
				let route_array = []
				for (let a of rt) {
					route_array.push(a)
				}
				display_array.push(route_array.join(", "))
				display_array.push("<br><br>")
			}
		}
		this.disp.innerHTML = display_array.join("")
	}
}

class DataProvider {
	constructor() {
		this.datapath = "data/data_roads.json"
		this.data = {}
		this.keys = []
		this.keys_upper = []
	}

	async loadData() {
		var response = await fetch(this.datapath)
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

	constructor(disp_id) {
		const params = new URLSearchParams(window.location.search);
		this.display_type = params.get("mode")
		if (!DisplayTypes.includes(this.display_type)) this.display_type = "routes"

		this.provider = new DataProvider()
		this.display = new Display(disp_id, this.display_type)
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
		this.display.setData(this.#busdata)
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
		div_id = "rds_display",
		p_feedback_id = "p_feedback",
		p_loading_id = "p_loading",
		f_start_id = "f_start",
		b_start_id = "b_start",
		f_guess_id = "f_guess",
		p_info_id = "p_info",
		i_guess_id = "i_guess",
		b_guess_id = "b_guess"
	) {
		this.controller = new GameController(div_id)
		this.div_id = div_id
		this.p_feedback_id = p_feedback_id
		this.p_feedback = document.getElementById(p_feedback_id)
		this.p_loading = document.getElementById(p_loading_id)
		this.f_start = document.getElementById(f_start_id)
		this.b_start = document.getElementById(b_start_id)
		this.f_guess = document.getElementById(f_guess_id)
		this.p_info = document.getElementById(p_info_id)
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
			this.starttime = new Date().getTime()
			var starttime = this.starttime
			this.interval = setInterval(function () {
				var now = new Date().getTime()
				var timed = now - starttime
				console.log(starttime)
				var seconds = Math.floor((timed % (1000 * 60)) / 1000);
				var minutes = Math.floor((timed % (1000 * 60 * 60)) / (1000 * 60));
				document.getElementById("timer").innerHTML = minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0')
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
			if (result[0] != null) {
				this.state = "set"
				this.updatestats()
			}
		}
	}

}

var controller = new UserController()
controller.load()