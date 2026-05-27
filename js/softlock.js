function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    } 
}

var starttime
var interval

class DataProvider {
	constructor() {
		this.datapath = "data/data_softlock.json"
		this.data = {}
		this.keys = []
	}

	async loadData() {
		var response = await fetch(this.datapath)
		this.data = await response.json()
		console.log(this.data)
		this.AL = this.data["services_al"]
		this.LI = this.data["services_li"]
		this.keys = Object.keys(this.LI)
	}

	getData(bus) {
		if (this.keys.includes(bus)) return this.data[bus]
		else return {}
	}
}


class GameController {

	constructor(disp_id) {
		const params = new URLSearchParams(window.location.search);

		this.provider = new DataProvider()
		this.bus = ""
		this.firstbus = ""
		this.scores = [0, "-"] // cur, best
		this.curoptions = []

		this.run = []
		this.trun = []
	}

	async loadData() {
		await this.provider.loadData()
	}

	addBus(bus) {
		if (this.provider.keys.includes(bus) == false) return -3
		if (this.provider.AL[this.bus].includes(bus) == false) return -2
		if (this.provider.LI[bus] != 0) return -1
		this.bus = bus
		this.run.push(bus)
		this.trun.push(bus)
		this.scores[0]++
		this.provider.LI[bus] = 1
		let options = 0
		this.curoptions = []
		for (var b of this.provider.AL[bus]) {
			if (this.provider.LI[b] == 0) {
				options++;
				this.curoptions.push(b)
			}
		}
		return options
	}

	resetGame() {
		if (this.scores[1] == "-") {
			this.scores[1] = this.scores[0]
		} else {
			if (this.scores[1] > this.scores[0]) this.scores[1] = this.scores[0]
		}
		this.scores[0] = 0
		this.curoptions = []
	}

	startGame() {
		this.run = []
		this.trun = []
		for (var bsx of this.provider.keys) {
			this.provider.LI[bsx] = 0
		}
		this.bus = this.provider.keys[Math.floor(Math.random() * this.provider.keys.length)]
		this.scores[0] = 0
		this.trun.push(this.bus)
		this.curoptions = this.provider.AL[this.bus]
		this.provider.LI[this.bus] = 1
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
		this.p_feedback_id = "p_feedback"
		this.p_feedback = document.getElementById("p_feedback")
		this.p_loading = document.getElementById("p_loading")
		this.f_start = document.getElementById("f_start")
		this.b_start = document.getElementById("b_start")
		this.f_guess = document.getElementById("f_guess")
		this.p_currentbus = document.getElementById("p_current_bus")
		this.p_info = document.getElementById("p_info")
		this.i_guess = document.getElementById("i_guess")
		this.b_guess = document.getElementById("b_guess")
		this.det = document.getElementById("detail")
		this.load()
		this.state = "set"
	}

	async load() {
		this.f_start.style.display = "none"
		this.f_guess.style.display = "none"
		await this.controller.loadData()
		this.resetgame()
	}

	resetgame() {
		this.f_start.style.display = ""
		this.p_loading.style.display = "none"
		this.b_start.onclick = function () {
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
			controller.update()
		}
	}

	fastreset() {
		this.controller.startGame()
		this.resettimer()
	}

	resettimer() {
		starttime = new Date().getTime()
		interval = setInterval(function () {
			var now = new Date().getTime()
			var timed = now - starttime
			console.log(starttime)
			var seconds = Math.floor((timed % (1000 * 60)) / 1000);
			var minutes = Math.floor(timed / (1000 * 60));
			document.getElementById("timer").innerHTML = minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0')
		}, 100)
	}

	updatestats() {
		document.getElementById(this.p_feedback_id + "_run").innerHTML = this.controller.trun.join("-")
		document.getElementById(this.p_feedback_id + "_cs").innerHTML = this.controller.scores[0]
		document.getElementById(this.p_feedback_id + "_ms").innerHTML = this.controller.scores[1]
		this.p_currentbus.innerHTML = this.controller.bus
		this.det.innerHTML = "Buses available: " + this.controller.curoptions.length
	}

	update() {
		if (this.state == "set") {
			this.fastreset()
			this.state = "reset"
			this.p_info.innerHTML = "Transfer to:"
			this.updatestats()
			return
		}
		var guess = this.i_guess.value
		var result = this.controller.addBus(guess.toUpperCase())
		if (result==-3) {
			this.p_info.innerHTML = "Invalid guess, try again:"
		} else if (result==-1) {
			this.p_info.innerHTML = "Already named <span class='f-b'>" + guess + "</span>, try again:"
		} else if (result==-2) {
			this.p_info.innerHTML = "Can't transfer to <span class='f-w'>" + guess + "</span>, try again:"
		} else if (result==0) {
			this.state = "set"
			this.p_info.innerHTML = "<span class='f-c'> Softlocked! Press enter to continue: </span>"
			this.controller.resetGame()
			this.updatestats()
			this.i_guess.value = ""
		} else {
			this.p_info.innerHTML = "Transfer to:"
			this.updatestats()
			this.i_guess.value = ""
		}

	}

}

var controller = new UserController()
controller.load()