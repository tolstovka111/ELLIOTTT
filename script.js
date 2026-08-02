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

	Array.prototype.forEach.call(document.querySelectorAll(".adminswitch input[type=checkbox]"), function (box) {
		var form = box.closest ? box.closest("form") : null;

		if (!form || box.name !== "asadmin") {
			return;
		}

		var field = form.querySelector('input[name="name"]');
		var fixed = form.querySelector(".say-name-fixed");

		var sync = function () {
			if (field) {
				field.hidden = box.checked;
			}

			if (fixed) {
				fixed.hidden = !box.checked;
			}
		};

		try {
			if (localStorage.getItem("postAsAdmin") === "0") {
				box.checked = false;
			}
		} catch (e) {
			box.checked = box.checked;
		}

		box.addEventListener("change", function () {
			try {
				localStorage.setItem("postAsAdmin", box.checked ? "1" : "0");
			} catch (e) {
				sync();
			}

			sync();
		});
		sync();
	});

	var tagText = document.getElementById("tag-text");
	var tagPreview = document.getElementById("tag-preview");

	if (tagText && tagPreview) {
		tagText.addEventListener("input", function () {
			tagPreview.textContent = tagText.value || "nysha4real";
		});
	}

	var tagYellow = document.getElementById("tag-yellow");
	var tagGreen = document.getElementById("tag-green");

	if (tagPreview && tagYellow && tagGreen) {
		var paintName = function () {
			tagPreview.className = tagYellow.checked ? "msg-name admin" : "msg-name";
		};

		tagYellow.addEventListener("change", paintName);
		tagGreen.addEventListener("change", paintName);
	}

	var goPosts = document.querySelector(".goposts");

	if (goPosts) {
		goPosts.addEventListener("click", function (event) {
			var posts = document.getElementById("posts");

			if (!posts) {
				return;
			}

			event.preventDefault();
			posts.scrollIntoView({ behavior: "smooth", block: "start" });
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

	Array.prototype.forEach.call(document.querySelectorAll(".say-clip input[type=file]"), function (field) {
		field.addEventListener("change", function () {
			var label = field.parentNode.querySelector(".clip-name");
			var file = field.files && field.files[0];

			if (label) {
				label.textContent = file ? file.name : "";
			}
		});
	});

	var sayForm = document.getElementById("sayform");
	var saySend = document.getElementById("say-send");
	var sayTimer = document.getElementById("say-timer");

	if (sayForm && saySend && sayTimer) {
		var left = parseInt(sayForm.getAttribute("data-cooldown"), 10) || 0;

		var tick = function () {
			if (left <= 0) {
				sayTimer.hidden = true;
				sayTimer.classList.remove("hot");
				saySend.hidden = false;
				return;
			}

			sayTimer.textContent = String(left);
			sayTimer.classList.toggle("hot", left <= 5);
			left--;
			window.setTimeout(tick, 1000);
		};

		if (left > 0) {
			saySend.hidden = true;
			sayTimer.hidden = false;
			tick();
		}
	}

	var weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	function pad(value) {
		return value < 10 ? "0" + value : String(value);
	}

	function localStamp(seconds, withSeconds) {
		var when = new Date(seconds * 1000);
		var stamp = pad(when.getMonth() + 1) + "/" + pad(when.getDate()) + "/" + pad(when.getFullYear() % 100)
			+ "(" + weekdays[when.getDay()] + ")" + pad(when.getHours()) + ":" + pad(when.getMinutes());

		return withSeconds ? stamp + ":" + pad(when.getSeconds()) : stamp;
	}

	function paintStamps(root) {
		Array.prototype.forEach.call((root || document).querySelectorAll(".msg-date[data-ts]"), function (node) {
			var seconds = parseInt(node.getAttribute("data-ts"), 10);

			if (seconds) {
				node.textContent = localStamp(seconds, true);
			}
		});
	}

	paintStamps(document);

	var chart = document.getElementById("views-chart");
	var chartTip = document.getElementById("chart-tip");

	if (chart && chartTip) {
		var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

		var showTip = function (dot) {
			var parts = (dot.getAttribute("data-date") || "").split("-");
			var hits = dot.getAttribute("data-hits") || "0";
			var label = parts.length === 3
				? parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0]
				: dot.getAttribute("data-date");

			chartTip.innerHTML = "<b>" + hits + "</b> view" + (hits === "1" ? "" : "s") + "<br>" + label;
			chartTip.hidden = false;

			var box = dot.getBoundingClientRect();
			var frame = chart.getBoundingClientRect();
			var left = box.left - frame.left + (box.width / 2) - (chartTip.offsetWidth / 2);

			chartTip.style.left = Math.max(0, Math.min(left, frame.width - chartTip.offsetWidth)) + "px";
			chartTip.style.top = (box.top - frame.top - chartTip.offsetHeight - 8) + "px";
		};

		chart.addEventListener("mouseover", function (event) {
			if (event.target.classList.contains("chart-dot")) {
				event.target.classList.add("on");
				showTip(event.target);
			}
		});

		chart.addEventListener("mouseout", function (event) {
			if (event.target.classList.contains("chart-dot")) {
				event.target.classList.remove("on");
				chartTip.hidden = true;
			}
		});

		chart.addEventListener("touchstart", function (event) {
			if (event.target.classList.contains("chart-dot")) {
				showTip(event.target);
			}
		}, { passive: true });
	}

	var quotePop = null;

	function closeQuotePop() {
		if (quotePop && quotePop.parentNode) {
			quotePop.parentNode.removeChild(quotePop);
		}

		quotePop = null;
	}

	function openQuotePop(link) {
		var id = (link.getAttribute("href") || "").replace(/^#/, "");
		var source = id ? document.getElementById(id) : null;

		if (!source) {
			return;
		}

		closeQuotePop();

		var body = source.classList.contains("thread-post")
			? source.querySelector(".post")
			: source;

		quotePop = document.createElement("div");
		quotePop.className = "quotepop";
		quotePop.innerHTML = (body || source).innerHTML;

		document.body.appendChild(quotePop);

		var box = link.getBoundingClientRect();
		var top = box.bottom + window.pageYOffset + 4;
		var left = box.left + window.pageXOffset;
		var width = quotePop.offsetWidth;

		if (left + width > document.documentElement.clientWidth - 10) {
			left = Math.max(6, document.documentElement.clientWidth - width - 10);
		}

		quotePop.style.top = top + "px";
		quotePop.style.left = left + "px";
	}

	document.addEventListener("mouseover", function (event) {
		var link = event.target.closest ? event.target.closest(".quotelink a") : null;

		if (link) {
			openQuotePop(link);
		}
	});

	document.addEventListener("mouseout", function (event) {
		var link = event.target.closest ? event.target.closest(".quotelink a") : null;

		if (link) {
			closeQuotePop();
		}
	});

	window.addEventListener("scroll", closeQuotePop, { passive: true });

	var chatList = document.getElementById("chat-list");
	var lightbox = document.getElementById("lightbox");
	var lightboxStage = document.getElementById("lightbox-stage");
	var lightboxClose = document.getElementById("lightbox-close");
	var lightboxDownload = document.getElementById("lightbox-download");

	function openLightbox(src, kind) {
		if (!lightbox || !lightboxStage) {
			return;
		}

		lightboxStage.innerHTML = "";

		var node;

		if (kind === "video") {
			node = document.createElement("video");
			node.controls = true;
			node.autoplay = true;
		} else {
			node = document.createElement("img");
			node.alt = "";
		}

		node.src = src;
		lightboxStage.appendChild(node);
		lightboxDownload.href = src;
		lightbox.hidden = false;
	}

	function closeLightbox() {
		if (!lightbox || !lightboxStage) {
			return;
		}

		lightbox.hidden = true;
		lightboxStage.innerHTML = "";
	}

	document.addEventListener("click", function (event) {
		var target = event.target;

		if (!target || !target.classList) {
			return;
		}

		if (target.classList.contains("msg-reply")) {
			var scope = target.closest(".comments") || document;
			var form = scope.querySelector(".commentform") || document.getElementById("sayform");

			if (!form) {
				return;
			}

			var no = target.getAttribute("data-no");

			if (!no) {
				var head = target.closest(".msg-head");
				var label = head ? head.querySelector(".msg-no") : null;
				no = label ? label.textContent.replace(/[^0-9]/g, "") : "";
			}

			var toField = form.querySelector(".reply-to");
			var note = form.querySelector(".reply-note");
			var noteNo = form.querySelector(".reply-note-no");

			if (toField && no) {
				toField.value = no;
			}

			if (note && noteNo && no) {
				noteNo.textContent = ">>" + no;
				note.hidden = false;
			}

			var field = form.querySelector('input[name="text"]');

			if (field) {
				field.focus();
			}

			return;
		}

		if (target.classList.contains("reply-clear")) {
			var owner = target.closest("form");

			if (owner) {
				var clearField = owner.querySelector(".reply-to");
				var clearNote = owner.querySelector(".reply-note");

				if (clearField) {
					clearField.value = "";
				}

				if (clearNote) {
					clearNote.hidden = true;
				}
			}

			return;
		}

		var block = target.closest ? target.closest(".comments") : null;

		if (block && target.classList.contains("comments-all")) {
			Array.prototype.forEach.call(block.querySelectorAll(".comment.folded"), function (node) {
				node.classList.add("unfolded");
			});
			target.hidden = true;
			block.querySelector(".comments-hide").hidden = false;

			return;
		}

		if (block && target.classList.contains("comments-hide")) {
			Array.prototype.forEach.call(block.querySelectorAll(".comment.folded"), function (node) {
				node.classList.remove("unfolded");
			});
			target.hidden = true;
			block.querySelector(".comments-all").hidden = false;

			return;
		}

		var full = target.getAttribute && target.getAttribute("data-full");

		if (full) {
			event.preventDefault();
			openLightbox(full, target.getAttribute("data-kind"));
		}
	});

	if (lightbox && lightboxClose) {
		lightboxClose.addEventListener("click", closeLightbox);
		lightbox.addEventListener("click", function (event) {
			if (event.target === lightbox) {
				closeLightbox();
			}
		});
		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape") {
				closeLightbox();
			}
		});
	}

	if (chatList && window.fetch) {
		window.setInterval(function () {
			if (lightbox && !lightbox.hidden) {
				return;
			}

			var typing = false;

			var sayField = document.querySelector("#sayform .say-text");
			var sayTo = document.querySelector("#sayform .reply-to");

			if ((sayField && sayField.value !== "") || (sayTo && sayTo.value !== "")) {
				typing = true;
			}

			if (typing) {
				return;
			}

			fetch("/c/?list=1", { credentials: "same-origin" })
				.then(function (response) {
					return response.ok ? response.text() : null;
				})
				.then(function (html) {
					if (html !== null && html !== chatList.innerHTML) {
						chatList.innerHTML = html;
						paintStamps(chatList);
					}
				})
				.catch(function () {
					return null;
				});
		}, 9000);
	}

	var onlineTotal = document.getElementById("online-total");

	if (window.fetch) {
		var pingOnline = function () {
			fetch("/api/online.php", { credentials: "same-origin" })
				.then(function (response) {
					return response.ok ? response.json() : null;
				})
				.then(function (data) {
					if (onlineTotal && data && typeof data.online === "number") {
						onlineTotal.textContent = data.online.toLocaleString("en-US");
					}
				})
				.catch(function () {
					if (onlineTotal) {
						onlineTotal.textContent = "—";
					}
				});
		};

		pingOnline();
		window.setInterval(pingOnline, 60000);
	} else if (onlineTotal) {
		onlineTotal.textContent = "—";
	}

	var viewsTotal = document.getElementById("views-total");

	if (viewsTotal && window.fetch) {
		fetch("/api/views.php", { credentials: "same-origin" })
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
