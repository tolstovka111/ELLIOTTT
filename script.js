(function () {
	"use strict";

	var intro = document.getElementById("intro");
	var introClose = document.getElementById("intro-close");

	if (intro && introClose) {
		if (sessionStorage.getItem("hideIntro") === "1") {
			intro.style.display = "none";
		}
		introClose.addEventListener("click", function () {
			intro.style.display = "none";
			try {
				sessionStorage.setItem("hideIntro", "1");
			} catch (e) {
				intro.style.display = "none";
			}
		});
	}

	var toggle = document.getElementById("filter-toggle");
	var panel = document.getElementById("boards-filter");
	var input = document.getElementById("filter-input");

	if (toggle && panel && input) {
		toggle.addEventListener("click", function () {
			var open = panel.classList.toggle("open");
			toggle.innerHTML = open ? "filter ▲" : "filter ▼";
			if (open) {
				input.focus();
			} else {
				input.value = "";
				applyFilter("");
			}
		});

		input.addEventListener("input", function () {
			applyFilter(input.value);
		});
	}

	function applyFilter(query) {
		var needle = query.trim().toLowerCase();
		var columns = document.querySelectorAll(".board-col");

		Array.prototype.forEach.call(columns, function (column) {
			var items = column.querySelectorAll("li");
			var visible = 0;

			Array.prototype.forEach.call(items, function (item) {
				var text = item.textContent.toLowerCase();
				var match = needle === "" || text.indexOf(needle) !== -1;
				item.classList.toggle("hidden", !match);
				if (match) {
					visible++;
				}
			});

			column.style.display = visible === 0 ? "none" : "";
		});
	}

	var gallery = document.getElementById("gallery");
	var galleryEmpty = document.getElementById("gallery-empty");

	if (gallery && galleryEmpty) {
		if (gallery.children.length) {
			galleryEmpty.style.display = "none";
		} else {
			gallery.style.display = "none";
		}
	}

	var blogPosts = document.getElementById("blog-posts");
	var blogPos = document.getElementById("blog-pos");
	var blogPrev = document.getElementById("blog-prev");
	var blogNext = document.getElementById("blog-next");
	var slides = blogPosts ? blogPosts.querySelectorAll(".post") : [];
	var current = 0;

	function showPost(index) {
		current = (index + slides.length) % slides.length;
		Array.prototype.forEach.call(slides, function (node, i) {
			node.style.display = i === current ? "" : "none";
		});
		blogPos.textContent = current + 1 + "/" + slides.length;
	}

	if (slides.length > 1 && blogPos && blogPrev && blogNext) {
		blogPrev.addEventListener("click", function () {
			showPost(current - 1);
		});
		blogNext.addEventListener("click", function () {
			showPost(current + 1);
		});
		showPost(0);
	}

	var tracks = document.querySelectorAll(".track");

	function clockText(seconds) {
		if (!isFinite(seconds) || seconds < 0) {
			return "0:00";
		}
		var whole = Math.floor(seconds);
		var minutes = Math.floor(whole / 60);
		var rest = whole % 60;
		return minutes + ":" + (rest < 10 ? "0" : "") + rest;
	}

	Array.prototype.forEach.call(tracks, function (track) {
		var audio = track.querySelector("audio");
		var play = track.querySelector(".track-play");
		var seek = track.querySelector(".track-seek");
		var time = track.querySelector(".track-time");
		var rates = track.querySelectorAll(".track-rates span");
		var scrubbing = false;

		if (!audio || !play || !seek || !time) {
			return;
		}

		play.addEventListener("click", function () {
			if (audio.paused) {
				Array.prototype.forEach.call(document.querySelectorAll(".track audio"), function (other) {
					if (other !== audio) {
						other.pause();
					}
				});
				audio.play();
			} else {
				audio.pause();
			}
		});

		audio.addEventListener("play", function () {
			play.innerHTML = "&#10073;&#10073;";
			play.setAttribute("aria-label", "Pause");
		});

		audio.addEventListener("pause", function () {
			play.innerHTML = "&#9654;";
			play.setAttribute("aria-label", "Play");
		});

		audio.addEventListener("timeupdate", function () {
			time.textContent = clockText(audio.currentTime);

			if (!scrubbing && audio.duration) {
				seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
			}
		});

		audio.addEventListener("ended", function () {
			seek.value = "0";
			time.textContent = "0:00";
		});

		seek.addEventListener("input", function () {
			scrubbing = true;

			if (audio.duration) {
				time.textContent = clockText((Number(seek.value) / 1000) * audio.duration);
			}
		});

		seek.addEventListener("change", function () {
			if (audio.duration) {
				audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
			}

			scrubbing = false;
		});

		Array.prototype.forEach.call(rates, function (button) {
			button.addEventListener("click", function () {
				audio.playbackRate = Number(button.getAttribute("data-rate"));
				Array.prototype.forEach.call(rates, function (other) {
					other.classList.toggle("on", other === button);
				});
			});
		});
	});

	var emojibar = document.getElementById("emojibar");
	var postText = document.getElementById("post-text");

	if (emojibar && postText) {
		emojibar.addEventListener("click", function (event) {
			var code = event.target.getAttribute("data-code");

			if (!code) {
				return;
			}

			var start = postText.selectionStart;
			var end = postText.selectionEnd;
			var value = postText.value;
			var insert = code + " ";

			postText.value = value.slice(0, start) + insert + value.slice(end);
			postText.focus();
			postText.selectionStart = start + insert.length;
			postText.selectionEnd = postText.selectionStart;
		});
	}

	var logoutLink = document.getElementById("logout-link");
	var logoutForm = document.getElementById("logout-form");

	if (logoutLink && logoutForm) {
		logoutLink.addEventListener("click", function (event) {
			event.preventDefault();
			logoutForm.submit();
		});
	}

	var viewsTotal = document.getElementById("views-total");

	if (viewsTotal && window.fetch) {
		fetch("api/views.php", { credentials: "same-origin" })
			.then(function (response) {
				if (!response.ok) {
					throw new Error("bad status " + response.status);
				}
				return response.json();
			})
			.then(function (data) {
				if (typeof data.views !== "number") {
					throw new Error("bad payload");
				}
				viewsTotal.textContent = data.views.toLocaleString("en-US");
			})
			.catch(function () {
				viewsTotal.textContent = "—";
			});
	} else if (viewsTotal) {
		viewsTotal.textContent = "—";
	}
})();
