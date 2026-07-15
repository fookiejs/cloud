const search = document.getElementById("search");
const cards = [...document.querySelectorAll(".card[data-search]")];
const navLinks = [...document.querySelectorAll(".nav-link")];
const sections = [...document.querySelectorAll("section[id]")];

function filterCards(query) {
  const q = query.trim().toLowerCase();
  cards.forEach((card) => {
    const hay = card.dataset.search ?? "";
    card.classList.toggle("hidden", q.length > 0 && !hay.includes(q));
  });
}

search?.addEventListener("input", (e) => filterCards(e.target.value));

document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const pre = btn.parentElement?.querySelector("pre");
    if (!pre) return;
    const text = pre.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      const prev = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = prev; }, 1400);
    } catch {
      btn.textContent = "Failed";
    }
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
      });
    });
  },
  { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
);

sections.forEach((section) => observer.observe(section));
