function includePartials() {
  const targets = Array.from(document.querySelectorAll("[data-include]"));
  return Promise.all(
    targets.map((el) =>
      fetch(el.getAttribute("data-include"))
        .then((res) => res.text())
        .then((html) => {
          el.outerHTML = html;
        })
        .catch((err) =>
          console.error("Failed to load partial:", el.getAttribute("data-include"), err)
        )
    )
  );
}
