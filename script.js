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

	var logoutLink = document.getElementById("logout-link");
	var logoutForm = document.getElementById("logout-form");

	if (logoutLink && logoutForm) {
		logoutLink.addEventListener("click", function (event) {
			event.preventDefault();
			logoutForm.submit();
		});
	}

	var avatarInput = document.getElementById("avatar-input");
	var avatarPreview = document.getElementById("avatar-preview");

	if (avatarInput && avatarPreview) {
		avatarInput.addEventListener("change", function () {
			var file = avatarInput.files && avatarInput.files[0];

			if (file) {
				avatarPreview.src = URL.createObjectURL(file);
			}
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
			var form = document.getElementById("r" + target.getAttribute("data-target"));

			if (form) {
				if (form.classList.toggle("open")) {
					var field = form.querySelector('input[name="text"]');

					if (field) {
						field.focus();
					}
				}
			}

			return;
		}

		var block = target.closest ? target.closest(".comments") : null;

		if (block && target.classList.contains("comments-toggle")) {
			block.querySelector(".comments-body").hidden = false;
			block.querySelector(".comments-bar").hidden = true;
			return;
		}

		if (block && target.classList.contains("comments-all")) {
			Array.prototype.forEach.call(block.querySelectorAll(".comment.folded"), function (node) {
				node.classList.remove("folded");
			});
			var more = block.querySelector(".comments-more");

			if (more) {
				more.hidden = true;
			}

			return;
		}

		if (block && target.classList.contains("comments-hide")) {
			block.querySelector(".comments-body").hidden = true;
			block.querySelector(".comments-bar").hidden = false;
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

			Array.prototype.forEach.call(chatList.querySelectorAll(".replyform.open input"), function (field) {
				if (field.value !== "") {
					typing = true;
				}
			});

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
					}
				})
				.catch(function () {
					return null;
				});
		}, 9000);
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
