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
