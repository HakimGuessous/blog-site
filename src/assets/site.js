// Small enhancements; articles stay readable without this file.
(function () {
  // Clips pause, and gain controls, for readers who ask for reduced motion.
  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  function motion() {
    document.querySelectorAll("video[autoplay]").forEach(function (v) {
      if (still.matches) { v.pause(); v.controls = true; } else { v.play().catch(function () {}); }
    });
  }
  if (still.addEventListener) still.addEventListener("change", motion);
  motion();

  // Fixed-size widgets (```widget page.html 1280x720) are drawn at their own size and
  // scaled to the figure's width.
  document.querySelectorAll(".embed--scaled").forEach(function (box) {
    var w = Number(box.dataset.width), frame = box.querySelector("iframe");
    function fit() { frame.style.transform = "scale(" + box.clientWidth / w + ")"; }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
    else window.addEventListener("resize", fit);
  });

  // Responsive widgets grow to the height of their content. This reads the page inside
  // the frame, which works because widgets are served from the same site.
  document.querySelectorAll(".embed--fit iframe[data-autoheight]").forEach(function (frame) {
    var watching = false;
    function size() {
      try {
        var doc = frame.contentDocument;
        if (!doc || !doc.body) return;
        var h = Math.ceil(doc.body.getBoundingClientRect().height);
        var cs = doc.defaultView.getComputedStyle(doc.body);
        h += parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
        if (h > 0) frame.style.height = h + "px";
        if (!watching && window.ResizeObserver) { new ResizeObserver(size).observe(doc.body); watching = true; }
      } catch (e) { /* a page from another site keeps its default height */ }
    }
    frame.addEventListener("load", function () { watching = false; size(); });
    if (frame.contentDocument && frame.contentDocument.readyState === "complete") size();
  });

  // ```widget ... replay: a button that restarts an animation that plays once.
  document.querySelectorAll("figure[data-replay]").forEach(function (fig) {
    var frame = fig.querySelector("iframe");
    if (!frame) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "replay";
    button.textContent = "Replay";
    button.addEventListener("click", function () { frame.src = frame.src; });
    var cap = fig.querySelector("figcaption");
    if (cap) cap.appendChild(button); else fig.appendChild(button);
  });
})();
