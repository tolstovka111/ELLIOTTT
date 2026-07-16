const nav = document.getElementById("nav");
const pill = document.getElementById("pill");
const themeBtn = document.getElementById("themeBtn");
const buttons = document.querySelectorAll(".nav-btn");

function updatePill(btn) {
  pill.style.left = btn.offsetLeft + "px";
  pill.style.width = btn.offsetWidth + "px";
}

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".nav-btn.active")?.classList.remove("active");
    btn.classList.add("active");
    updatePill(btn);
  });
});

themeBtn.addEventListener("click", () => {
  const root = document.documentElement;
  const isDark = root.getAttribute("data-theme") === "dark";
  root.setAttribute(
    "data-theme",
    isDark ? "light" : "dark"
  );
  setTimeout(() => {
    const active = document.querySelector(".nav-btn.active");
    if (active) updatePill(active);
  }, 100);
});

window.addEventListener("resize", () => {
  const active = document.querySelector(".nav-btn.active");
  if (active) updatePill(active);
});

window.addEventListener("load", () => {
  updatePill(document.querySelector(".nav-btn.active"));
});

updatePill(document.querySelector(".nav-btn.active"));
