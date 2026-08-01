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
	var blogEmpty = document.getElementById("blog-empty");
	var blogNav = document.getElementById("blog-nav");
	var blogPos = document.getElementById("blog-pos");
	var blogPrev = document.getElementById("blog-prev");
	var blogNext = document.getElementById("blog-next");
	var current = 0;
	var rendered = [];

	function ageLabel(seconds) {
		if (seconds < 60) {
			return "just now";
		}
		if (seconds < 3600) {
			var minutes = Math.floor(seconds / 60);
			return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
		}
		if (seconds < 86400) {
			var hours = Math.floor(seconds / 3600);
			return hours + (hours === 1 ? " hour ago" : " hours ago");
		}
		return "yesterday";
	}

	function showPost(index) {
		if (!rendered.length) {
			return;
		}
		current = (index + rendered.length) % rendered.length;
		rendered.forEach(function (node, i) {
			node.style.display = i === current ? "" : "none";
		});
		blogPos.textContent = current + 1 + "/" + rendered.length;
	}

	function buildPost(post) {
		var wrap = document.createElement("div");
		wrap.className = "post";

		if (post.images && post.images.length) {
			var strip = document.createElement("div");
			strip.className = "post-images";

			post.images.forEach(function (image) {
				var holder;

				if (image.link) {
					holder = document.createElement("a");
					holder.href = image.link;
					holder.target = "_blank";
					holder.rel = "noopener noreferrer";
					holder.className = "post-image linked";
				} else {
					holder = document.createElement("span");
					holder.className = "post-image";
				}

				var picture = document.createElement("img");
				picture.src = image.src;
				picture.alt = "";
				holder.appendChild(picture);

				if (image.link) {
					var badge = document.createElement("span");
					badge.className = "click";
					badge.textContent = "Click";
					holder.appendChild(badge);
				}

				strip.appendChild(holder);
			});

			wrap.appendChild(strip);
		}

		if (post.text) {
			var text = document.createElement("p");
			text.className = "post-text";
			text.textContent = post.text;
			wrap.appendChild(text);
		}

		var date = document.createElement("div");
		date.className = "date";
		date.textContent = ageLabel(post.age);
		wrap.appendChild(date);

		return wrap;
	}

	function renderBlog(posts) {
		if (!posts.length) {
			return;
		}

		blogEmpty.style.display = "none";
		rendered = posts.map(function (post) {
			var node = buildPost(post);
			blogPosts.appendChild(node);
			return node;
		});

		if (posts.length > 1) {
			blogNav.hidden = false;
			blogPrev.addEventListener("click", function () {
				showPost(current - 1);
			});
			blogNext.addEventListener("click", function () {
				showPost(current + 1);
			});
		}

		showPost(0);
	}

	if (blogPosts && blogEmpty && window.fetch) {
		fetch("api/posts.php", { credentials: "same-origin" })
			.then(function (response) {
				if (!response.ok) {
					throw new Error("bad status " + response.status);
				}
				return response.json();
			})
			.then(function (data) {
				renderBlog(Array.isArray(data.posts) ? data.posts : []);
			})
			.catch(function () {
				blogEmpty.style.display = "";
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
