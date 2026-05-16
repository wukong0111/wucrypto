(function () {
	var table = document.getElementById("coins-table");
	if (!table) return;
	var tbody = table.querySelector("tbody");
	var headers = table.querySelectorAll("th[data-sort]");
	var saved = null;
	try {
		saved = JSON.parse(localStorage.getItem("wucrypto-sort"));
	} catch (e) {}

	function applySort(col, dir) {
		var rows = Array.from(tbody.querySelectorAll("tr"));
		var headerIdx = -1;
		headers.forEach(function (h, i) {
			if (h.dataset.sort === col) headerIdx = i;
		});
		if (headerIdx < 0) return;

		var isNum = ["holding", "value", "pnl", "pnlPct"].indexOf(col) >= 0;
		rows.sort(function (a, b) {
			var va = a.children[headerIdx].dataset.value;
			var vb = b.children[headerIdx].dataset.value;
			if (isNum) {
				var na = va === "" ? null : parseFloat(va);
				var nb = vb === "" ? null : parseFloat(vb);
				if (na === null && nb === null) return 0;
				if (na === null) return 1;
				if (nb === null) return -1;
				return dir === "asc" ? na - nb : nb - na;
			}
			if (va == null) va = "";
			if (vb == null) vb = "";
			var cmp = va.localeCompare(vb);
			return dir === "asc" ? cmp : -cmp;
		});
		rows.forEach(function (r) {
			tbody.appendChild(r);
		});
		updateIndicators(col, dir);
	}

	function updateIndicators(col, dir) {
		headers.forEach(function (h) {
			var icon = h.querySelector(".sort-icon");
			if (h.dataset.sort === col) {
				if (icon) icon.textContent = dir === "asc" ? " \u25B2" : " \u25BC";
				h.style.color = "#e5e7eb";
			} else {
				if (icon) icon.textContent = "";
				h.style.color = "";
			}
		});
	}

	headers.forEach(function (h) {
		h.addEventListener("click", function () {
			var col = h.dataset.sort;
			var prev = null;
			try {
				prev = JSON.parse(localStorage.getItem("wucrypto-sort"));
			} catch (e) {}
			var dir = prev && prev.col === col && prev.dir === "asc" ? "desc" : "asc";
			var dd = {
				name: "asc",
				ticker: "asc",
				holding: "desc",
				value: "desc",
				pnl: "desc",
				pnlPct: "desc",
			};
			if (prev && prev.col !== col) dir = dd[col] || "asc";
			applySort(col, dir);
			localStorage.setItem("wucrypto-sort", JSON.stringify({ col: col, dir: dir }));
		});
	});

	if (saved && saved.col) {
		applySort(saved.col, saved.dir || "asc");
	}
})();
